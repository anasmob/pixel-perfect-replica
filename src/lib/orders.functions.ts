import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCommission, computePackPrice, isMealCountAllowed } from "./pricing";
import { generateOrderCode } from "./validation";

interface CheckoutInput {
  restaurantId: string;
  slotId: string;
  items: { dishId: string; quantity: number }[];
  origin: string;
}

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CheckoutInput): CheckoutInput => {
    if (!input || typeof input.restaurantId !== "string" || typeof input.slotId !== "string") throw new Error("Invalid request.");
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) throw new Error("Your pack is empty.");
    const items = input.items.map((i) => ({ dishId: String(i.dishId), quantity: Math.floor(Number(i.quantity)) }));
    if (items.some((i) => !(i.quantity >= 1 && i.quantity <= 50))) throw new Error("Invalid quantity.");
    let origin: string;
    try {
      const u = new URL(input.origin);
      if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error();
      origin = u.origin;
    } catch {
      throw new Error("Invalid request.");
    }
    return { restaurantId: input.restaurantId, slotId: input.slotId, items, origin };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStudent } = await supabase.rpc("has_role", { _user_id: userId, _role: "student" });
    if (!isStudent) throw new Error("Only student accounts can order packs.");

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("./stripe.server");

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (!authUser?.user?.email_confirmed_at) throw new Error("Please confirm your email address before your first order.");

    const { data: r } = await admin
      .from("restaurants")
      .select("id, slug, name, is_approved, discount_percent, min_meals, max_meals, lead_time_hours")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r || !r.is_approved) throw new Error("This restaurant is not available.");

    // Merge duplicate dish lines.
    const qty = new Map<string, number>();
    for (const i of data.items) qty.set(i.dishId, (qty.get(i.dishId) ?? 0) + i.quantity);
    const { data: dishes } = await admin
      .from("dishes")
      .select("id, name, price_cents")
      .eq("restaurant_id", r.id)
      .eq("is_hidden", false)
      .in("id", [...qty.keys()]);
    if (!dishes || dishes.length !== qty.size) throw new Error("Some dishes are no longer available. Please review your pack.");

    const lines = dishes.map((d) => ({ dish: d, quantity: qty.get(d.id)!, unitPriceCents: d.price_cents }));
    const price = computePackPrice(lines, r.discount_percent);
    if (!isMealCountAllowed(price.mealCount, r.min_meals, r.max_meals)) {
      throw new Error(`Packs from ${r.name} must have ${r.min_meals} to ${r.max_meals} meals.`);
    }

    const { data: slots } = await admin.rpc("available_slots", { _restaurant_id: r.id });
    const slot = (slots ?? []).find((s) => s.slot_id === data.slotId);
    if (!slot) throw new Error("That pickup slot is no longer available. Please choose another one.");

    const { data: priv } = await admin
      .from("restaurant_private")
      .select("commission_percent, stripe_account_id, stripe_payouts_ready")
      .eq("restaurant_id", r.id)
      .single();
    // Restaurants with Stripe payouts set up get their share automatically when the payment is captured.
    const destination = priv?.stripe_payouts_ready && priv.stripe_account_id ? priv.stripe_account_id : null;
    const commissionPercent = Number(priv?.commission_percent ?? 10);
    const commission = computeCommission(price.totalCents, commissionPercent);
    const { data: profile } = await admin.from("profiles").select("first_name").eq("id", userId).maybeSingle();

    let orderId: string | null = null;
    let code = "";
    for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
      code = generateOrderCode();
      const { data: inserted, error } = await admin
        .from("orders")
        .insert({
          code,
          student_id: userId,
          student_first_name: profile?.first_name ?? "",
          student_email: authUser.user.email ?? null,
          restaurant_id: r.id,
          slot_id: slot.slot_id,
          slot_start: slot.start_time,
          status: "pending_payment",
          meal_count: price.mealCount,
          menu_total_cents: price.menuTotalCents,
          discount_percent: r.discount_percent,
          discount_cents: price.discountCents,
          total_cents: price.totalCents,
        })
        .select("id")
        .single();
      if (error) {
        if (error.message.includes("SLOT_FULL")) throw new Error("That pickup slot just filled up. Please choose another one.");
        if (error.code === "23505") continue; // code collision, retry
        console.error(error);
        throw new Error("Could not create your order. Please try again.");
      }
      orderId = inserted.id;
    }
    if (!orderId) throw new Error("Could not create your order. Please try again.");

    await admin.from("order_items").insert(
      lines.map((l) => ({
        order_id: orderId!,
        dish_id: l.dish.id,
        dish_name: l.dish.name,
        unit_price_cents: l.unitPriceCents,
        quantity: l.quantity,
      })),
    );
    await admin.from("order_financials").insert({
      order_id: orderId,
      restaurant_id: r.id,
      commission_percent: commissionPercent,
      commission_cents: commission.commissionCents,
      restaurant_payout_cents: commission.restaurantPayoutCents,
      transfer_destination: destination,
    });

    try {
      const session = await createCheckoutSession(
        {
          mode: "payment",
          // Card only: card authorizations support the hold-then-capture flow reliably.
          payment_method_types: ["card"],
          customer_email: authUser.user.email,
          client_reference_id: orderId,
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          success_url: `${data.origin}/orders/${orderId}?paid=1`,
          cancel_url: `${data.origin}/checkout/${r.slug}?cancelled=1`,
          payment_intent_data: {
            capture_method: "manual",
            ...(destination
              ? { application_fee_amount: commission.commissionCents > 0 ? commission.commissionCents : undefined, transfer_data: { destination } }
              : {}),
            description: `meals4cheap order ${code}`,
            metadata: { order_id: orderId, order_code: code },
          },
          metadata: { order_id: orderId },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: price.totalCents,
                product_data: {
                  name: `Meal pack from ${r.name} (${price.mealCount} meals)`,
                  description: lines.map((l) => `${l.quantity} x ${l.dish.name}`).join(", ").slice(0, 500),
                },
              },
            },
          ],
        },
        `checkout-${orderId}`,
      );
      await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", orderId);
      if (!session.url) throw new Error("No checkout URL");
      return { url: session.url, orderId };
    } catch (e) {
      await admin.from("orders").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", orderId);
      console.error("[checkout] stripe failed", e);
      throw new Error(e instanceof Error && e.message.startsWith("Card payments") ? e.message : "Payment could not be started. Please try again.");
    }
  });

export const getMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: own } = await supabase.from("orders").select("id, status").eq("id", data.orderId).maybeSingle();
    if (!own) return null;
    if (own.status === "pending_payment" || own.status === "awaiting_restaurant") {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { finalizePendingOrder, sweepExpiredOrders } = await import("./orders.server");
      try {
        if (own.status === "pending_payment") await finalizePendingOrder(admin, own.id);
        await sweepExpiredOrders(admin, { orderId: own.id });
      } catch (e) {
        console.error("[order] refresh failed", e);
      }
    }
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, code, status, meal_count, menu_total_cents, discount_percent, discount_cents, total_cents, slot_start, decline_reason, placed_at, response_deadline, created_at, restaurant:restaurants(id, name, address, timezone, slug, logo_url), items:order_items(dish_name, unit_price_cents, quantity)",
      )
      .eq("id", data.orderId)
      .single();
    return order;
  });

export const listMyOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: pending } = await supabase
      .from("orders")
      .select("id, status")
      .in("status", ["pending_payment", "awaiting_restaurant"])
      .limit(10);
    if (pending && pending.length > 0) {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { finalizePendingOrder, sweepExpiredOrders } = await import("./orders.server");
      try {
        for (const p of pending.filter((p) => p.status === "pending_payment").slice(0, 5)) {
          await finalizePendingOrder(admin, p.id);
        }
        await sweepExpiredOrders(admin, { studentId: userId });
      } catch (e) {
        console.error("[orders] refresh failed", e);
      }
    }
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, code, status, meal_count, total_cents, slot_start, created_at, restaurant:restaurants(name, timezone, logo_url)")
      .not("status", "in", "(pending_payment,cancelled)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load your orders.");
    return orders ?? [];
  });

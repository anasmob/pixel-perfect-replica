import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownRestaurant(supabase: any, userId: string) {
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, address, timezone, is_approved, slug")
    .eq("owner_id", userId)
    .maybeSingle();
  return data as { id: string; name: string; address: string; timezone: string; is_approved: boolean; slug: string } | null;
}

export const listRestaurantOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await ownRestaurant(supabase, userId);
    if (!r) throw new Error("No restaurant found for this account.");
    try {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { sweepExpiredOrders } = await import("./orders.server");
      await sweepExpiredOrders(admin, { restaurantId: r.id });
    } catch (e) {
      console.error("[dashboard] sweep failed", e);
    }
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, code, status, student_first_name, slot_start, meal_count, total_cents, menu_total_cents, discount_cents, decline_reason, placed_at, response_deadline, created_at, items:order_items(dish_name, quantity, unit_price_cents), fin:order_financials(commission_percent, commission_cents, restaurant_payout_cents)",
      )
      .eq("restaurant_id", r.id)
      .or(`status.in.(awaiting_restaurant,confirmed,ready),created_at.gte.${since}`)
      .order("slot_start", { ascending: true })
      .limit(300);
    if (error) {
      console.error(error);
      throw new Error("Could not load orders.");
    }
    return { timezone: r.timezone, orders: data ?? [] };
  });

type Action = "confirm" | "decline" | "ready" | "picked_up";

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; action: Action; reason?: string; code?: string }) => {
    const actions: Action[] = ["confirm", "decline", "ready", "picked_up"];
    if (!actions.includes(input.action)) throw new Error("Invalid action.");
    return {
      orderId: String(input.orderId),
      action: input.action,
      reason: input.reason ? String(input.reason).trim().slice(0, 300) : null,
      code: input.code ? String(input.code).trim().toUpperCase() : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const r = await ownRestaurant(supabase, userId);
    if (!r) throw new Error("No restaurant found for this account.");
    // RLS confirms this order belongs to the caller's restaurant.
    const { data: order } = await supabase
      .from("orders")
      .select("id, code, status, restaurant_id, slot_start, stripe_payment_intent_id, response_deadline, student_email")
      .eq("id", data.orderId)
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { sendOrderEmail } = await import("./notify.server");
    const { capturePaymentIntent, cancelPaymentIntent } = await import("./stripe.server");
    const { sweepExpiredOrders } = await import("./orders.server");
    const { formatSlot } = await import("./time");
    const now = new Date().toISOString();
    const emailData = { code: order.code, restaurantName: r.name, restaurantAddress: r.address, pickupWindow: formatSlot(order.slot_start, r.timezone) };

    const claim = async (from: string, patch: Record<string, unknown>) => {
      const { data: row } = await admin
        .from("orders")
        .update(patch as never)
        .eq("id", order.id)
        .eq("status", from as never)
        .select("id")
        .maybeSingle();
      return !!row;
    };

    if (data.action === "confirm" || data.action === "decline") {
      if (order.status !== "awaiting_restaurant") throw new Error("This order is no longer waiting for a response.");
      if (order.response_deadline && new Date(order.response_deadline) < new Date()) {
        await sweepExpiredOrders(admin, { orderId: order.id });
        throw new Error("The 30-minute response window has passed. This order expired and the student was not charged.");
      }
    }

    if (data.action === "confirm") {
      if (!(await claim("awaiting_restaurant", { status: "confirmed", confirmed_at: now }))) throw new Error("This order was already updated.");
      try {
        if (order.stripe_payment_intent_id) await capturePaymentIntent(order.stripe_payment_intent_id);
        await admin.from("order_financials").update({ payment_captured: true }).eq("order_id", order.id);
      } catch (e) {
        console.error("[confirm] capture failed", e);
        await admin.from("orders").update({ status: "awaiting_restaurant", confirmed_at: null }).eq("id", order.id);
        throw new Error("The payment could not be captured. Please try again.");
      }
      await sendOrderEmail("student-order-confirmed", order.student_email, emailData);
      return { status: "confirmed" };
    }

    if (data.action === "decline") {
      if (!(await claim("awaiting_restaurant", { status: "declined", decline_reason: data.reason, closed_at: now }))) {
        throw new Error("This order was already updated.");
      }
      if (order.stripe_payment_intent_id) {
        try {
          await cancelPaymentIntent(order.stripe_payment_intent_id);
        } catch (e) {
          console.error("[decline] cancel failed", e);
        }
      }
      await sendOrderEmail("student-order-declined", order.student_email, { ...emailData, reason: data.reason });
      return { status: "declined" };
    }

    if (data.action === "ready") {
      if (!(await claim("confirmed", { status: "ready", ready_at: now }))) throw new Error("Only confirmed orders can be marked ready.");
      await sendOrderEmail("student-order-ready", order.student_email, emailData);
      return { status: "ready" };
    }

    if (data.code !== order.code) throw new Error("The order code does not match.");
    if (!(await claim("ready", { status: "picked_up", picked_up_at: now, closed_at: now }))) {
      throw new Error("Only orders that are ready can be marked picked up.");
    }
    return { status: "picked_up" };
  });

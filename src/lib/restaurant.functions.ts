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
  .inputValidator((input: { orderId: string; action: Action; reason?: string | undefined; code?: string | undefined }) => {
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

// ----- Payouts (Stripe Connect Express) -----
export interface PayoutStatus {
  paymentsConfigured: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsReady: boolean;
  actionNeeded: boolean;
}

function safeOrigin(origin: string) {
  const u = new URL(origin);
  if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("Invalid request.");
  return u.origin;
}

function connectError(e: unknown): Error {
  console.error("[payouts] stripe error", e);
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("Card payments")) return new Error("Payments are not set up on meals4cheap yet, so payouts can't be connected.");
  if (/signed up for Connect|Connect/i.test(msg)) return new Error("Payouts are not switched on for meals4cheap yet. Please try again later.");
  return new Error("Stripe could not be reached. Please try again.");
}

export const getPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutStatus> => {
    const { supabase, userId } = context;
    const r = await ownRestaurant(supabase, userId);
    if (!r) throw new Error("No restaurant found for this account.");
    const { paymentsConfigured, retrieveAccount, isPayoutReady } = await import("./stripe.server");
    const { data: priv } = await supabase
      .from("restaurant_private")
      .select("stripe_account_id, stripe_details_submitted, stripe_payouts_ready")
      .eq("restaurant_id", r.id)
      .maybeSingle();
    const base: PayoutStatus = {
      paymentsConfigured: paymentsConfigured(),
      connected: !!priv?.stripe_account_id,
      detailsSubmitted: !!priv?.stripe_details_submitted,
      payoutsReady: !!priv?.stripe_payouts_ready,
      actionNeeded: false,
    };
    if (!priv?.stripe_account_id || !base.paymentsConfigured) return base;
    try {
      const acct = await retrieveAccount(priv.stripe_account_id);
      const ready = isPayoutReady(acct);
      if (ready !== priv.stripe_payouts_ready || acct.details_submitted !== priv.stripe_details_submitted) {
        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        await admin
          .from("restaurant_private")
          .update({ stripe_details_submitted: acct.details_submitted, stripe_payouts_ready: ready })
          .eq("restaurant_id", r.id);
      }
      return {
        ...base,
        detailsSubmitted: acct.details_submitted,
        payoutsReady: ready,
        actionNeeded: (acct.requirements?.currently_due?.length ?? 0) > 0,
      };
    } catch (e) {
      console.error("[payouts] status refresh failed", e);
      return base;
    }
  });

export const startPayoutSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => ({ origin: safeOrigin(String(input.origin)) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const r = await ownRestaurant(supabase, userId);
    if (!r) throw new Error("No restaurant found for this account.");
    const { createExpressAccount, createAccountLink } = await import("./stripe.server");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: priv } = await admin
      .from("restaurant_private")
      .select("stripe_account_id, email")
      .eq("restaurant_id", r.id)
      .single();
    try {
      let accountId = priv?.stripe_account_id ?? null;
      if (!accountId) {
        const acct = await createExpressAccount(
          {
            type: "express",
            country: "US",
            email: priv?.email ?? undefined,
            business_profile: { name: r.name, product_description: "Restaurant meal packs for student pickup" },
            capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
            metadata: { restaurant_id: r.id },
          },
          `connect-account-${r.id}`,
        );
        accountId = acct.id;
        await admin.from("restaurant_private").update({ stripe_account_id: accountId }).eq("restaurant_id", r.id);
      }
      const link = await createAccountLink(
        accountId,
        `${data.origin}/dashboard/payouts?refresh=1`,
        `${data.origin}/dashboard/payouts?return=1`,
      );
      return { url: link.url };
    } catch (e) {
      throw connectError(e);
    }
  });

export const openPayoutDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await ownRestaurant(supabase, userId);
    if (!r) throw new Error("No restaurant found for this account.");
    const { data: priv } = await supabase
      .from("restaurant_private")
      .select("stripe_account_id, stripe_details_submitted")
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (!priv?.stripe_account_id || !priv.stripe_details_submitted) throw new Error("Finish setting up payouts first.");
    const { createLoginLink } = await import("./stripe.server");
    try {
      const link = await createLoginLink(priv.stripe_account_id);
      return { url: link.url };
    } catch (e) {
      throw connectError(e);
    }
  });

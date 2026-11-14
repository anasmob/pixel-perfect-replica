// Server-only order lifecycle helpers. Use the admin client (bypasses RLS); callers must authorize first.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeResponseDeadline } from "./deadline";
import { formatSlot } from "./time";
import { sendOrderEmail } from "./notify.server";
import { cancelPaymentIntent, retrieveCheckoutSession } from "./stripe.server";

type Admin = SupabaseClient<Database>;

async function loadRestaurant(admin: Admin, restaurantId: string) {
  const { data: r } = await admin.from("restaurants").select("id, name, address, timezone").eq("id", restaurantId).single();
  const { data: p } = await admin.from("restaurant_private").select("email").eq("restaurant_id", restaurantId).maybeSingle();
  return { name: r?.name ?? "", address: r?.address ?? "", timezone: r?.timezone ?? "America/Chicago", email: p?.email ?? null };
}

/** Check Stripe for a pending order; if the card is authorized, move it to "Waiting for restaurant". */
export async function finalizePendingOrder(admin: Admin, orderId: string): Promise<string> {
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order) return "missing";
  if (order.status !== "pending_payment" || !order.stripe_session_id) return order.status;

  const session = await retrieveCheckoutSession(order.stripe_session_id);
  const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;

  if (pi && pi.status === "requires_capture") {
    const placedAt = new Date();
    const slotStart = new Date(order.slot_start);
    const { data: slots } = await admin
      .from("pickup_slots")
      .select("start_time")
      .eq("restaurant_id", order.restaurant_id)
      .gte("start_time", new Date(placedAt.getTime() - 60 * 60 * 1000).toISOString())
      .lte("start_time", order.slot_start);
    const deadline = computeResponseDeadline(
      placedAt,
      (slots ?? []).map((s) => new Date(s.start_time)),
      slotStart,
    );
    const { data: updated } = await admin
      .from("orders")
      .update({
        status: "awaiting_restaurant",
        stripe_payment_intent_id: pi.id,
        placed_at: placedAt.toISOString(),
        response_deadline: deadline.toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();
    if (updated) {
      const r = await loadRestaurant(admin, order.restaurant_id);
      await sendOrderEmail("restaurant-new-order", r.email, {
        code: order.code,
        restaurantName: r.name,
        pickupWindow: formatSlot(order.slot_start, r.timezone),
        totalCents: order.total_cents,
        mealCount: order.meal_count,
      });
    }
    return "awaiting_restaurant";
  }

  if (session.status === "expired" || (pi && pi.status === "canceled")) {
    await admin.from("orders").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", orderId).eq("status", "pending_payment");
    return "cancelled";
  }
  return "pending_payment";
}

/** Expire orders the restaurant did not answer in time: cancel the card hold, free the slot, email the student. */
export async function sweepExpiredOrders(
  admin: Admin,
  filter: { restaurantId?: string; studentId?: string; orderId?: string } = {},
) {
  const nowIso = new Date().toISOString();
  let q = admin.from("orders").select("*").eq("status", "awaiting_restaurant").lt("response_deadline", nowIso).limit(25);
  if (filter.restaurantId) q = q.eq("restaurant_id", filter.restaurantId);
  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  if (filter.orderId) q = q.eq("id", filter.orderId);
  const { data: expired } = await q;

  for (const order of expired ?? []) {
    const { data: claimed } = await admin
      .from("orders")
      .update({ status: "expired", closed_at: nowIso })
      .eq("id", order.id)
      .eq("status", "awaiting_restaurant")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    if (order.stripe_payment_intent_id) {
      try {
        await cancelPaymentIntent(order.stripe_payment_intent_id);
      } catch (e) {
        console.error("[sweep] cancel failed", order.id, e);
      }
    }
    const r = await loadRestaurant(admin, order.restaurant_id);
    await sendOrderEmail("student-order-expired", order.student_email, {
      code: order.code,
      restaurantName: r.name,
      pickupWindow: formatSlot(order.slot_start, r.timezone),
    });
  }

  // Unfinished checkouts older than 40 minutes: finalize if paid, otherwise cancel (frees the slot hold).
  let pq = admin
    .from("orders")
    .select("id")
    .eq("status", "pending_payment")
    .lt("created_at", new Date(Date.now() - 40 * 60 * 1000).toISOString())
    .limit(10);
  if (filter.restaurantId) pq = pq.eq("restaurant_id", filter.restaurantId);
  if (filter.studentId) pq = pq.eq("student_id", filter.studentId);
  if (filter.orderId) pq = pq.eq("id", filter.orderId);
  const { data: stale } = await pq;
  for (const o of stale ?? []) {
    try {
      await finalizePendingOrder(admin, o.id);
    } catch (e) {
      console.error("[sweep] finalize failed", o.id, e);
    }
  }
}

export { loadRestaurant };

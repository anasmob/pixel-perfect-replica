// Order emails. The email provider is not connected yet, so each message is
// logged instead of sent. Swap the body of `deliver` once a provider is chosen.
export type OrderEmailKind =
  | "restaurant-new-order"
  | "student-order-confirmed"
  | "student-order-declined"
  | "student-order-expired"
  | "student-order-ready";

export interface OrderEmailData {
  code: string;
  restaurantName: string;
  restaurantAddress?: string;
  pickupWindow?: string;
  reason?: string | null;
  totalCents?: number;
  mealCount?: number;
}

async function deliver(kind: OrderEmailKind, to: string, data: OrderEmailData) {
  console.info(`[email:not-connected] ${kind} -> ${to}`, JSON.stringify(data));
}

export async function sendOrderEmail(kind: OrderEmailKind, to: string | null | undefined, data: OrderEmailData) {
  if (!to) return;
  try {
    await deliver(kind, to, data);
  } catch (e) {
    console.error(`[email] ${kind} failed`, e);
  }
}

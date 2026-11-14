export type OrderStatus =
  | "pending_payment"
  | "awaiting_restaurant"
  | "confirmed"
  | "ready"
  | "picked_up"
  | "declined"
  | "expired"
  | "cancelled";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Payment not completed",
  awaiting_restaurant: "Waiting for restaurant",
  confirmed: "Confirmed",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const ACTIVE_STATUSES: OrderStatus[] = ["awaiting_restaurant", "confirmed", "ready"];

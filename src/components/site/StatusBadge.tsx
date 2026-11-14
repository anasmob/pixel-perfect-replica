import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const variant =
    status === "confirmed" || status === "ready" || status === "picked_up"
      ? "success"
      : status === "declined" || status === "expired" || status === "cancelled"
        ? "muted"
        : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

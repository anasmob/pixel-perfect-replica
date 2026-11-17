import { createFileRoute, Link } from "@tanstack/react-router";
import { RestaurantLogo } from "@/components/site/RestaurantLogo";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { StatusBadge } from "@/components/site/StatusBadge";
import { getMyOrder } from "@/lib/orders.functions";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { formatCents } from "@/lib/pricing";
import { formatSlot } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  validateSearch: (s: Record<string, unknown>): { paid?: string | undefined } => ({
    paid: typeof s["paid"] === "string" ? s["paid"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Order status — meals4cheap" },
      { name: "description", content: "Track your meal pack order and pickup window." },
      { property: "og:title", content: "Order status — meals4cheap" },
      { property: "og:description", content: "Track your meal pack order and pickup window." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

const FLOW: OrderStatus[] = ["awaiting_restaurant", "confirmed", "ready", "picked_up"];

function OrderPage() {
  const { orderId } = Route.useParams();
  const fetchOrder = useServerFn(getMyOrder);
  const q = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder({ data: { orderId } }),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "pending_payment" || s === "awaiting_restaurant" || s === "confirmed" ? 15_000 : false;
    },
  });

  const order = q.data;
  const rest = order?.restaurant as { id: string; name: string; address: string; timezone: string; slug: string; logo_url: string | null } | null | undefined;

  // Once payment is through, the pack in this browser is no longer needed.
  useEffect(() => {
    if (rest?.id && order && order.status !== "pending_payment" && order.status !== "cancelled") {
      window.localStorage.removeItem(`m4c-pack-${rest.id}`);
    }
  }, [rest?.id, order]);

  if (q.isLoading) return <LoadingBlock label="Loading your order…" />;
  if (q.isError) return <div className="container-page py-12"><ErrorState message="This order could not be loaded." onRetry={() => q.refetch()} /></div>;
  if (!order || !rest) {
    return (
      <div className="container-page py-12">
        <EmptyState title="Order not found" action={<Button asChild variant="outline"><Link to="/orders">My orders</Link></Button>} />
      </div>
    );
  }

  const status = order.status as OrderStatus;
  const items = (order.items ?? []) as { dish_name: string; unit_price_cents: number; quantity: number }[];
  const stepIndex = FLOW.indexOf(status);

  return (
    <div className="container-page max-w-2xl py-10">
      <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">← My orders</Link>

      <div className="ticket mt-4 p-6 sm:p-8">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>Order code</span>
          <StatusBadge status={status} />
        </div>
        <p className="mt-2 text-5xl font-semibold tracking-[0.2em] sm:text-6xl">{order.code}</p>
        <p className="mt-2 font-sans text-sm text-muted-foreground">Show this code when you pick up.</p>

        <div className="ticket-divider my-6" />
        <StatusMessage status={status} reason={order.decline_reason} />

        {status === "pending_payment" ? null : stepIndex >= 0 ? (
          <ol className="mt-6 grid grid-cols-4 gap-2 font-sans text-xs">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-success" : "bg-panel")} />
                <span className={cn("flex items-center gap-1", i <= stepIndex ? "text-foreground" : "text-muted-foreground")}>
                  {i < stepIndex ? <Check className="h-3 w-3" aria-hidden /> : null}
                  {STATUS_LABEL[s]}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="ticket-divider my-6" />
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Restaurant</dt><dd className="flex items-center gap-2 text-right"><RestaurantLogo name={rest.name} logoUrl={rest.logo_url} size="sm" />{rest.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Address</dt><dd className="text-right">{rest.address}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pickup</dt><dd className="text-right">{formatSlot(order.slot_start, rest.timezone)}</dd></div>
        </dl>
        <div className="ticket-divider my-6" />
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.dish_name} className="flex justify-between gap-3">
              <span>{i.quantity} x {i.dish_name}</span>
              <span>{formatCents(i.unit_price_cents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="ticket-divider my-4" />
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Menu price</span><span>{formatCents(order.menu_total_cents)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Discount {order.discount_percent}%</span><span>-{formatCents(order.discount_cents)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatCents(order.total_cents)}</span></div>
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ status, reason }: { status: OrderStatus; reason: string | null }) {
  const text: Record<OrderStatus, string> = {
    pending_payment: "We're checking your payment. This usually takes a few seconds.",
    awaiting_restaurant: "Waiting for the restaurant to confirm. Your card is on hold and will only be charged once it confirms.",
    confirmed: "Confirmed. Your card has been charged. We'll let you know when your pack is ready.",
    ready: "Your pack is ready. Head over during your pickup window.",
    picked_up: "Picked up. Enjoy your meals.",
    declined: "The restaurant declined this order. The card hold was released and you were not charged.",
    expired: "The restaurant did not respond in time. The card hold was released and you were not charged.",
    cancelled: "Payment was not completed. You were not charged.",
  };
  return (
    <div className="font-sans text-sm">
      <p className="text-base font-medium">{STATUS_LABEL[status]}</p>
      <p className="mt-1 text-muted-foreground">{text[status]}</p>
      {status === "declined" && reason ? <p className="mt-2 text-muted-foreground">Reason: {reason}</p> : null}
    </div>
  );
}

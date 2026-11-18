import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { StatusBadge } from "@/components/site/StatusBadge";
import { useRestaurantOrders } from "@/hooks/use-restaurant-orders";
import { updateOrderStatus } from "@/lib/restaurant.functions";
import type { OrderStatus } from "@/lib/order-status";
import { formatCents } from "@/lib/pricing";
import { formatDateTime, formatSlot } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: OrdersTab,
});

type Tab = "new" | "confirmed" | "ready" | "completed";
const TABS: { id: Tab; label: string; statuses: OrderStatus[] }[] = [
  { id: "new", label: "New", statuses: ["awaiting_restaurant"] },
  { id: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { id: "ready", label: "Ready", statuses: ["ready"] },
  { id: "completed", label: "Completed", statuses: ["picked_up", "declined", "expired"] },
];

function OrdersTab() {
  const q = useRestaurantOrders(true);
  const [tab, setTab] = useState<Tab>("new");

  if (q.isLoading) return <LoadingBlock label="Loading orders…" />;
  if (q.isError) return <ErrorState message="Orders could not be loaded." onRetry={() => q.refetch()} />;

  const tz = q.data!.timezone;
  const orders = q.data!.orders;
  const current = TABS.find((t) => t.id === tab)!;
  let list = orders.filter((o) => current.statuses.includes(o.status as OrderStatus));
  if (tab === "completed") list = [...list].sort((a, b) => b.slot_start.localeCompare(a.slot_start));

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => {
          const count = orders.filter((o) => t.statuses.includes(o.status as OrderStatus)).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm",
                tab === t.id ? "border-foreground bg-card text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="font-mono text-xs">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState title={`No ${current.label.toLowerCase()} orders`}>
            {tab === "new" ? "New orders appear here. You have 30 minutes of pickup hours to confirm or decline each one." : null}
            {tab === "completed" ? "Orders from the last 30 days show here." : null}
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((o) => (
              <OrderCard key={o.id} order={o} timezone={tz} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Order = NonNullable<ReturnType<typeof useRestaurantOrders>["data"]>["orders"][number];

function OrderCard({ order, timezone }: { order: Order; timezone: string }) {
  const qc = useQueryClient();
  const update = useServerFn(updateOrderStatus);
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const status = order.status as OrderStatus;
  const items = (order.items ?? []) as { dish_name: string; quantity: number }[];
  const finRaw = order.fin as unknown;
  const fin = (Array.isArray(finRaw) ? finRaw[0] : finRaw) as
    | { commission_percent: number; commission_cents: number; restaurant_payout_cents: number; transfer_destination: string | null }
    | null;

  const act = async (action: "confirm" | "decline" | "ready" | "picked_up") => {
    setBusy(true);
    try {
      await update({ data: { orderId: order.id, action, reason: reason || undefined, code: code || undefined } });
      const msg = { confirm: "Order confirmed. Payment captured.", decline: "Order declined. The student was not charged.", ready: "Marked ready. The student will be notified.", picked_up: "Marked picked up." };
      toast.success(msg[action]);
      setDeclineOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["restaurant-orders"] });
    }
  };

  return (
    <article className="surface flex flex-col p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-lg font-semibold tracking-widest">{order.code}</span>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1">{order.student_first_name || "Student"}</p>
      <p className="font-mono text-xs text-muted-foreground">{formatSlot(order.slot_start, timezone)}</p>
      {status === "awaiting_restaurant" && order.response_deadline ? (
        <p className="mt-1 text-xs text-muted-foreground">Respond by {formatDateTime(order.response_deadline)}</p>
      ) : null}
      <div className="ticket-divider my-3" />
      <ul className="space-y-0.5 font-mono text-xs">
        {items.map((i) => (
          <li key={i.dish_name}>{i.quantity} x {i.dish_name}</li>
        ))}
      </ul>
      <div className="ticket-divider my-3" />
      <dl className="space-y-0.5 font-mono text-xs">
        <div className="flex justify-between"><dt className="text-muted-foreground">Order total ({order.meal_count} meals)</dt><dd>{formatCents(order.total_cents)}</dd></div>
        {fin ? (
          <>
            <div className="flex justify-between"><dt className="text-muted-foreground">Commission {Number(fin.commission_percent)}%</dt><dd>-{formatCents(fin.commission_cents)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>You receive</dt><dd>{formatCents(fin.restaurant_payout_cents)}</dd></div>
            <p className="pt-1 font-sans text-muted-foreground">
              {fin.transfer_destination ? "Sent to your Stripe account when you confirm." : "Paid out by meals4cheap (Stripe payouts not set up for this order)."}
            </p>
          </>
        ) : null}
      </dl>
      {status === "declined" && order.decline_reason ? (
        <p className="mt-2 text-xs text-muted-foreground">Reason: {order.decline_reason}</p>
      ) : null}

      <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
        {status === "awaiting_restaurant" ? (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => act("confirm")}>Confirm</Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setDeclineOpen(true)}>Decline</Button>
          </div>
        ) : null}
        {status === "confirmed" ? (
          <Button variant="success" disabled={busy} onClick={() => act("ready")}>Mark ready</Button>
        ) : null}
        {status === "ready" ? (
          <div className="space-y-2">
            <Label htmlFor={`code-${order.id}`} className="text-xs">Check the student's order code</Label>
            <div className="flex gap-2">
              <Input
                id={`code-${order.id}`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="6 characters"
                className="h-11 font-mono uppercase tracking-widest"
                autoComplete="off"
              />
              <Button variant="success" disabled={busy || code.trim() !== order.code} onClick={() => act("picked_up")}>
                Mark picked up
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline order {order.code}?</DialogTitle>
            <DialogDescription>The card hold is released and the student is not charged. The slot opens up again.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor={`reason-${order.id}`}>Reason (optional)</Label>
            <Textarea id={`reason-${order.id}`} className="mt-1.5" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Keep order</Button>
            <Button variant="destructive" disabled={busy} onClick={() => act("decline")}>Decline order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

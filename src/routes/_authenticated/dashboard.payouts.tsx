import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/site/States";
import { getPayoutStatus, openPayoutDashboard, startPayoutSetup } from "@/lib/restaurant.functions";

export const Route = createFileRoute("/_authenticated/dashboard/payouts")({
  validateSearch: (s: Record<string, unknown>): { refresh?: string | undefined; return?: string | undefined } => ({
    refresh: typeof s["refresh"] === "string" ? s["refresh"] : undefined,
    return: typeof s["return"] === "string" ? s["return"] : undefined,
  }),
  component: PayoutsTab,
});

function PayoutsTab() {
  const search = Route.useSearch();
  const fetchStatus = useServerFn(getPayoutStatus);
  const start = useServerFn(startPayoutSetup);
  const openDash = useServerFn(openPayoutDashboard);
  const q = useQuery({ queryKey: ["payout-status"], queryFn: () => fetchStatus() });
  const [busy, setBusy] = useState(false);
  const restarted = useRef(false);

  const go = async (fn: () => Promise<{ url: string }>) => {
    setBusy(true);
    try {
      const { url } = await fn();
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  const setup = () => go(() => start({ data: { origin: window.location.origin } }));

  // Stripe sends people back with ?refresh=1 when a setup link expired: open a fresh one.
  useEffect(() => {
    if (search.refresh && !restarted.current) {
      restarted.current = true;
      void setup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.refresh]);

  if (q.isLoading || (search.refresh && busy)) return <LoadingBlock label="Loading payouts…" />;
  if (q.isError) return <ErrorState message="Payout status could not be loaded." onRetry={() => q.refetch()} />;
  const s = q.data!;

  let title: string;
  let body: string;
  let action: React.ReactNode = null;
  if (!s.paymentsConfigured) {
    title = "Payouts are not available yet";
    body = "Card payments are not switched on for meals4cheap yet. You can set up payouts once they are.";
  } else if (!s.connected || !s.detailsSubmitted) {
    title = s.connected ? "Finish setting up payouts" : "Get paid automatically";
    body =
      "Connect a Stripe account to receive your share of each order. Stripe asks for your business details and the bank account to pay into. It takes about 5 minutes.";
    action = (
      <Button onClick={setup} disabled={busy}>
        {busy ? "Opening Stripe…" : s.connected ? "Continue setup" : "Set up payouts"}
      </Button>
    );
  } else if (!s.payoutsReady || s.actionNeeded) {
    title = s.payoutsReady ? "Stripe needs more information" : "Stripe is reviewing your details";
    body = s.payoutsReady
      ? "Payouts still work, but Stripe needs a few more details to keep them running."
      : "This usually takes a few minutes. Orders are paid out by meals4cheap until Stripe finishes.";
    action = (
      <div className="flex flex-wrap gap-2">
        <Button onClick={setup} disabled={busy}>Update details</Button>
        <Button variant="outline" onClick={() => q.refetch()} disabled={busy || q.isFetching}>Check again</Button>
      </div>
    );
  } else {
    title = "Payouts are on";
    body = "When you confirm an order, the order total minus commission goes to your Stripe account. Stripe then pays it into your bank on its regular schedule.";
    action = (
      <Button variant="outline" onClick={() => go(() => openDash())} disabled={busy}>
        {busy ? "Opening Stripe…" : "Open Stripe dashboard"}
      </Button>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="surface p-6">
        <div className="flex items-center gap-2">
          <span
            className={s.payoutsReady ? "h-2.5 w-2.5 rounded-full bg-success" : "h-2.5 w-2.5 rounded-full bg-border"}
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{body}</p>
        {search.return && !s.payoutsReady && s.paymentsConfigured ? (
          <p className="mt-3 rounded-lg bg-panel p-3 text-sm">Thanks. Your details were sent to Stripe.</p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
      <aside className="surface h-fit bg-panel p-5 text-sm">
        <h3 className="font-semibold">How payouts work</h3>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-muted-foreground">
          <li>The student's card is only charged when you confirm the order.</li>
          <li>At that moment your share is sent to your Stripe account. Commission stays with meals4cheap.</li>
          <li>Orders placed before payouts were on are paid out by meals4cheap.</li>
        </ul>
      </aside>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PackTicket } from "@/components/site/PackTicket";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { FieldError } from "@/components/site/AuthCard";
import { useAuth } from "@/hooks/use-auth";
import { usePack } from "@/hooks/use-pack";
import { restaurantQuery, slotsQuery } from "@/lib/queries";
import { createCheckout } from "@/lib/orders.functions";
import { isMealCountAllowed } from "@/lib/pricing";
import { dayKey, formatDay, formatSlot, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/checkout/$slug")({
  validateSearch: (s: Record<string, unknown>): { cancelled?: string | undefined } => ({
    cancelled: typeof s["cancelled"] === "string" ? s["cancelled"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — meals4cheap" },
      { name: "description", content: "Choose a pickup window and pay for your meal pack." },
      { property: "og:title", content: "Checkout — meals4cheap" },
      { property: "og:description", content: "Choose a pickup window and pay for your meal pack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { role, ready } = useAuth();
  const rq = useQuery(restaurantQuery(slug));
  const r = rq.data?.restaurant;
  const sq = useQuery({ ...slotsQuery(r?.id ?? ""), enabled: !!r?.id });
  const { pack, loaded } = usePack(r?.id);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkout = useServerFn(createCheckout);

  const lines = useMemo(
    () =>
      (rq.data?.dishes ?? [])
        .filter((d) => (pack[d.id] ?? 0) > 0)
        .map((d) => ({ id: d.id, name: d.name, quantity: pack[d.id] ?? 0, unitPriceCents: d.price_cents })),
    [rq.data, pack],
  );

  const days = useMemo(() => {
    const map = new Map<string, { label: string; slots: NonNullable<typeof sq.data> }>();
    for (const s of sq.data ?? []) {
      const k = dayKey(s.start_time, r!.timezone);
      if (!map.has(k)) map.set(k, { label: formatDay(s.start_time, r!.timezone), slots: [] });
      map.get(k)!.slots.push(s);
    }
    return [...map.values()];
  }, [sq.data, r]);

  if (rq.isLoading || !ready) return <LoadingBlock />;
  if (rq.isError) return <div className="container-page py-12"><ErrorState message="Checkout could not be loaded." onRetry={() => rq.refetch()} /></div>;
  if (!r) return <div className="container-page py-12"><EmptyState title="Restaurant not found" /></div>;

  if (role === "restaurant") {
    return (
      <div className="container-page py-12">
        <EmptyState title="Restaurant accounts can't place orders">Log in with a student account to order packs.</EmptyState>
      </div>
    );
  }

  const mealCount = lines.reduce((n, l) => n + l.quantity, 0);
  if (loaded && !isMealCountAllowed(mealCount, r.min_meals, r.max_meals)) {
    return (
      <div className="container-page py-12">
        <EmptyState
          title="Your pack isn't ready yet"
          action={<Button asChild variant="outline"><Link to="/restaurants/$slug" params={{ slug }}>Back to {r.name}</Link></Button>}
        >
          Packs from {r.name} need {r.min_meals} to {r.max_meals} meals.
        </EmptyState>
      </div>
    );
  }

  const selected = sq.data?.find((s) => s.slot_id === slotId);

  const pay = async () => {
    if (!slotId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await checkout({
        data: {
          restaurantId: r.id,
          slotId,
          items: lines.map((l) => ({ dishId: l.id, quantity: l.quantity })),
          origin: window.location.origin,
        },
      });
      window.location.href = res.url;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Payment could not be started.");
      sq.refetch();
    }
  };

  return (
    <div className="container-page py-10">
      <Link to="/restaurants/$slug" params={{ slug }} className="text-sm text-muted-foreground hover:text-foreground">
        ← Edit pack
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Checkout</h1>
      {search.cancelled ? (
        <p className="mt-4 rounded-lg bg-panel p-3 text-sm">Payment was cancelled. Your card was not charged.</p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="slot-heading">
          <h2 id="slot-heading" className="text-lg font-semibold">Choose a pickup window</h2>
          <p className="mt-1 text-sm text-muted-foreground">1-hour windows at {r.name}, {r.address}. Times are local to the restaurant.</p>
          <div className="mt-5 space-y-6">
            {sq.isLoading ? (
              <LoadingBlock label="Loading pickup windows…" />
            ) : sq.isError ? (
              <ErrorState message="Pickup windows could not be loaded." onRetry={() => sq.refetch()} />
            ) : days.length === 0 ? (
              <EmptyState title="No pickup windows available">This restaurant has no open pickup windows in the next 7 days.</EmptyState>
            ) : (
              days.map((d) => (
                <fieldset key={d.label}>
                  <legend className="mb-2 text-sm font-medium">{d.label}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {d.slots.map((s) => (
                      <label
                        key={s.slot_id}
                        className={cn(
                          "surface flex min-h-12 cursor-pointer items-center justify-center px-3 py-2 text-center font-mono text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                          slotId === s.slot_id ? "border-foreground bg-panel" : "hover:border-foreground/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={s.slot_id}
                          checked={slotId === s.slot_id}
                          onChange={() => setSlotId(s.slot_id)}
                          className="sr-only"
                        />
                        {formatTime(s.start_time, r.timezone)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PackTicket
            restaurantName={r.name}
            lines={lines}
            discountPercent={r.discount_percent}
            minMeals={r.min_meals}
            maxMeals={r.max_meals}
            pickup={selected ? formatSlot(selected.start_time, r.timezone) : "Not selected"}
            footer={
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The restaurant must confirm your order. Your card is only charged after it confirms. If it declines or does not
                  respond in time, the hold is released.
                </p>
                <FieldError>{error}</FieldError>
                <Button className="w-full" size="lg" disabled={!slotId || busy} onClick={pay}>
                  {busy ? "Opening payment…" : "Pay by card"}
                </Button>
              </div>
            }
          />
        </aside>
      </div>
    </div>
  );
}

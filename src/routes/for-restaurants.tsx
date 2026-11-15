import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeProjection, formatCents } from "@/lib/pricing";

export const Route = createFileRoute("/for-restaurants")({
  head: () => ({
    meta: [
      { title: "For restaurants — meals4cheap" },
      { name: "description", content: "Sell pre-scheduled meal packs to college students. You set the discount, pack size and pickup hours." },
      { property: "og:title", content: "For restaurants — meals4cheap" },
      { property: "og:description", content: "Sell pre-scheduled meal packs to college students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForRestaurants,
});

const COMMISSION = 10;

const benefits = [
  { title: "New customers", body: "Reach students who meal prep for the week and would otherwise cook." },
  { title: "Larger orders", body: "Each order is a pack of several meals, within the range you set." },
  { title: "Planned ahead", body: "Orders arrive at least your lead time before pickup, in 1-hour windows you choose, with a cap per slot." },
  { title: "You stay in control", body: "Confirm or decline every order. Cards are only charged when you confirm." },
];

function ForRestaurants() {
  const [v, setV] = useState({ avgDishPrice: "12", foodCostPercent: "30", packsPerWeek: "20", mealsPerPack: "5", discountPercent: "20" });
  const n = (s: string) => (Number.isFinite(Number(s)) ? Math.max(0, Number(s)) : 0);
  const r = computeProjection({
    avgDishPrice: n(v.avgDishPrice),
    foodCostPercent: Math.min(100, n(v.foodCostPercent)),
    packsPerWeek: Math.floor(n(v.packsPerWeek)),
    mealsPerPack: Math.max(1, Math.floor(n(v.mealsPerPack))),
    discountPercent: Math.min(50, Math.max(5, n(v.discountPercent))),
    commissionPercent: COMMISSION,
  });

  const field = (id: keyof typeof v, label: string, hint?: string, step = "1") => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} step={step} className="mt-1.5 h-11 font-mono" value={v[id]} onChange={(e) => setV({ ...v, [id]: e.target.value })} />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold sm:text-5xl">Sell meal packs to students</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Students buy several meals from you at once, pay upfront, and pick everything up in one 1-hour window. Pickup only, no
          delivery.
        </p>
      </div>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((b) => (
          <li key={b.title} className="surface p-5">
            <h2 className="text-base font-semibold">{b.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
          </li>
        ))}
      </ul>

      <section className="mt-16 grid gap-8 lg:grid-cols-2" aria-labelledby="calc">
        <div className="surface space-y-4 p-6">
          <h2 id="calc" className="text-2xl font-semibold">Calculator</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("avgDishPrice", "Average dish price ($)", undefined, "0.5")}
            {field("foodCostPercent", "Food cost (%)", "Share of the menu price.")}
            {field("packsPerWeek", "Packs per week")}
          </div>
          <div className="ticket-divider pt-4">
            <p className="text-sm font-medium">Assumptions</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {field("mealsPerPack", "Meals per pack")}
              {field("discountPercent", "Your discount (%)", "5% to 50%.")}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Platform commission: {COMMISSION}% of the discounted pack price.</p>
          </div>
        </div>

        <div className="ticket h-fit p-6 text-sm">
          <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Projection</span>
            <span>Not a guarantee</span>
          </div>
          <div className="ticket-divider my-4" />
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Per pack</p>
          <dl className="space-y-1.5">
            <Row label="Discounted pack price" value={formatCents(r.packPriceCents)} />
            <Row label={`Commission (${COMMISSION}%)`} value={`-${formatCents(r.commissionPerPackCents)}`} />
            <Row label="Amount you receive" value={formatCents(r.receivedPerPackCents)} strong />
            <Row label="Left after food cost" value={formatCents(r.leftPerPackCents)} />
          </dl>
          <div className="ticket-divider my-4" />
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Per week</p>
          <dl className="space-y-1.5">
            <Row label="Commission" value={formatCents(r.weeklyCommissionCents)} />
            <Row label="Amount you receive" value={formatCents(r.weeklyReceivedCents)} strong />
            <Row label="Left after food cost" value={formatCents(r.weeklyLeftCents)} strong />
          </dl>
          <p className="mt-4 font-sans text-xs text-muted-foreground">
            Projection based on your inputs only. Card processing fees and taxes are not included.
          </p>
        </div>
      </section>

      <div className="mt-12">
        <Button asChild size="lg">
          <Link to="/restaurant-signup">Apply as a restaurant</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-muted-foreground"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

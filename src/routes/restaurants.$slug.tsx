import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackTicket } from "@/components/site/PackTicket";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { EmptyState } from "@/components/site/States";
import { usePack } from "@/hooks/use-pack";
import { restaurantQuery } from "@/lib/queries";
import { computePackPrice, formatCents, isMealCountAllowed } from "@/lib/pricing";

export const Route = createFileRoute("/restaurants/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(restaurantQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.restaurant.name, cuisine: data.restaurant.cuisine, discount: data.restaurant.discount_percent };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} meal packs — meals4cheap` },
          { name: "description", content: `${loaderData.cuisine} meal packs at ${loaderData.discount}% off for students.` },
          { property: "og:title", content: `${loaderData.name} meal packs — meals4cheap` },
          { property: "og:description", content: `${loaderData.cuisine} meal packs at ${loaderData.discount}% off for students.` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Restaurant unavailable — meals4cheap" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="container-page py-16">
      <EmptyState title="Restaurant not found" action={<Button asChild variant="outline"><Link to="/restaurants">Back to restaurants</Link></Button>}>
        This restaurant is not available.
      </EmptyState>
    </div>
  ),
  component: RestaurantPage,
});

function RestaurantPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantQuery(slug));
  const navigate = useNavigate();
  const r = data!.restaurant;
  const dishes = data!.dishes;
  const { pack, setPack } = usePack(r.id);

  const lines = dishes
    .filter((d) => (pack[d.id] ?? 0) > 0)
    .map((d) => ({ id: d.id, name: d.name, quantity: pack[d.id], unitPriceCents: d.price_cents }));
  const price = computePackPrice(lines, r.discount_percent);
  const inRange = isMealCountAllowed(price.mealCount, r.min_meals, r.max_meals);
  const atMax = price.mealCount >= r.max_meals;

  const goCheckout = () => navigate({ to: "/checkout/$slug", params: { slug: r.slug } });

  return (
    <div className="container-page pb-28 pt-10 lg:pb-12">
      <Link to="/restaurants" className="text-sm text-muted-foreground hover:text-foreground">
        ← All restaurants
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold sm:text-4xl">{r.name}</h1>
            {r.is_demo ? <Badge variant="muted">Demo</Badge> : null}
          </div>
          <p className="mt-1 text-muted-foreground">
            {r.cuisine} · {r.address}
          </p>
        </div>
        <Badge variant="discount" className="px-3 py-1.5 text-sm">
          {r.discount_percent}% off packs of {r.min_meals} to {r.max_meals}
        </Badge>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Dishes">
          {dishes.length === 0 ? (
            <EmptyState title="No dishes yet">This restaurant has not added its menu yet.</EmptyState>
          ) : (
            <ul className="surface divide-y">
              {dishes.map((d) => {
                const q = pack[d.id] ?? 0;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <h3 className="font-medium">{d.name}</h3>
                      {d.description ? <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p> : null}
                      <p className="price mt-1 text-sm">{formatCents(d.price_cents)}</p>
                    </div>
                    <QuantityStepper
                      label={d.name}
                      value={q}
                      canIncrease={!atMax}
                      onChange={(v) => setPack({ ...pack, [d.id]: v })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {atMax ? (
            <p className="mt-3 text-sm text-muted-foreground">You've reached the maximum of {r.max_meals} meals for this pack.</p>
          ) : null}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PackTicket
            restaurantName={r.name}
            lines={lines}
            discountPercent={r.discount_percent}
            minMeals={r.min_meals}
            maxMeals={r.max_meals}
            footer={
              <Button className="w-full" size="lg" disabled={!inRange} onClick={goCheckout}>
                Continue to checkout
              </Button>
            }
          />
        </aside>
      </div>

      {/* Mobile bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 lg:hidden">
        <div className="container-page flex items-center justify-between gap-3 px-2">
          <div className="font-mono text-sm">
            <div className="font-semibold">{formatCents(price.totalCents)}</div>
            <div className="text-xs text-muted-foreground">
              {price.mealCount} of {r.min_meals}–{r.max_meals} meals
            </div>
          </div>
          <Button disabled={!inRange} onClick={goCheckout}>
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}

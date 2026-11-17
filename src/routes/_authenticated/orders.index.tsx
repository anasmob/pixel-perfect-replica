import { createFileRoute, Link } from "@tanstack/react-router";
import { RestaurantLogo } from "@/components/site/RestaurantLogo";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { StatusBadge } from "@/components/site/StatusBadge";
import { listMyOrders } from "@/lib/orders.functions";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { formatCents } from "@/lib/pricing";
import { formatSlot } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — meals4cheap" },
      { name: "description", content: "Your current and past meal pack orders." },
      { property: "og:title", content: "My orders — meals4cheap" },
      { property: "og:description", content: "Your current and past meal pack orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const fetchOrders = useServerFn(listMyOrders);
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders(), refetchInterval: 30_000 });

  const current = (q.data ?? []).filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const past = (q.data ?? []).filter((o) => !ACTIVE_STATUSES.includes(o.status as OrderStatus));

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-semibold">My orders</h1>
      <div className="mt-8">
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.isError ? (
          <ErrorState message="Your orders could not be loaded." onRetry={() => q.refetch()} />
        ) : q.data!.length === 0 ? (
          <EmptyState title="No orders yet" action={<Button asChild><Link to="/restaurants">Browse restaurants</Link></Button>}>
            When you order a pack, it shows up here.
          </EmptyState>
        ) : (
          <div className="space-y-10">
            {[
              { title: "Current", list: current },
              { title: "Past", list: past },
            ].map((g) =>
              g.list.length ? (
                <section key={g.title}>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">{g.title}</h2>
                  <ul className="surface divide-y">
                    {g.list.map((o) => {
                      const rest = o.restaurant as { name: string; timezone: string; logo_url: string | null } | null;
                      return (
                        <li key={o.id}>
                          <Link
                            to="/orders/$orderId"
                            params={{ orderId: o.id }}
                            search={{}}
                            className="flex flex-col gap-2 p-4 hover:bg-panel sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-start gap-3">
                              {rest ? <RestaurantLogo name={rest.name} logoUrl={rest.logo_url} /> : null}
                              <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{o.code}</span>
                                <StatusBadge status={o.status as OrderStatus} />
                              </div>
                              <p className="mt-1 font-medium">{rest?.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {rest ? formatSlot(o.slot_start, rest.timezone) : ""}
                              </p>
                              </div>
                            </div>
                            <div className="font-mono text-sm sm:text-right">
                              <div>{formatCents(o.total_cents)}</div>
                              <div className="text-xs text-muted-foreground">{o.meal_count} meals</div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

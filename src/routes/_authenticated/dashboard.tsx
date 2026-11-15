import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { myRestaurantQuery } from "@/lib/dashboard-queries";
import { useRestaurantOrders } from "@/hooks/use-restaurant-orders";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Restaurant dashboard — meals4cheap" },
      { name: "description", content: "Manage orders, menu, offer and pickup slots." },
      { property: "og:title", content: "Restaurant dashboard — meals4cheap" },
      { property: "og:description", content: "Manage orders, menu, offer and pickup slots." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { session, role, ready } = useAuth();
  const rq = useQuery(myRestaurantQuery(session?.user.id));
  const orders = useRestaurantOrders(!!rq.data);
  const newCount = (orders.data?.orders ?? []).filter((o) => o.status === "awaiting_restaurant").length;

  if (!ready || rq.isLoading) return <LoadingBlock />;
  if (role !== "restaurant") {
    return (
      <div className="container-page py-12">
        <EmptyState title="This area is for restaurants">Log in with a restaurant account to see the dashboard.</EmptyState>
      </div>
    );
  }
  if (rq.isError) return <div className="container-page py-12"><ErrorState message="Your restaurant could not be loaded." onRetry={() => rq.refetch()} /></div>;
  if (!rq.data) return <div className="container-page py-12"><EmptyState title="No restaurant found for this account" /></div>;

  const r = rq.data;
  const tab = "relative inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "border-foreground text-foreground" };

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Restaurant dashboard</p>
          <h1 className="text-2xl font-semibold">{r.name}</h1>
        </div>
        {r.is_approved ? (
          <Link to="/restaurants/$slug" params={{ slug: r.slug }} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            View public page
          </Link>
        ) : null}
      </div>
      {!r.is_approved ? (
        <div className="mt-4 rounded-lg border bg-panel p-4 text-sm">
          <p className="font-medium">Your application is pending approval.</p>
          <p className="mt-1 text-muted-foreground">Students can't see your restaurant yet. You can set up your menu, offer and pickup hours in the meantime.</p>
        </div>
      ) : null}
      <nav className="mt-6 flex gap-6 border-b" aria-label="Dashboard">
        <Link to="/dashboard" activeOptions={{ exact: true }} className={tab} activeProps={active}>
          Orders
          {newCount > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-xs text-primary-foreground" aria-label={`${newCount} new orders`}>
              {newCount}
            </span>
          ) : null}
        </Link>
        <Link to="/dashboard/menu" className={tab} activeProps={active}>Menu and offer</Link>
        <Link to="/dashboard/slots" className={tab} activeProps={active}>Pickup slots</Link>
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}

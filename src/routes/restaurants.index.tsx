import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RestaurantCard } from "@/components/site/RestaurantCard";
import { EmptyState, ErrorState } from "@/components/site/States";
import { restaurantsQuery } from "@/lib/queries";

export const Route = createFileRoute("/restaurants/")({
  head: () => ({
    meta: [
      { title: "Restaurants — meals4cheap" },
      { name: "description", content: "Local restaurants offering discounted meal packs for students, with 1-hour pickup windows." },
      { property: "og:title", content: "Restaurants — meals4cheap" },
      { property: "og:description", content: "Local restaurants offering discounted meal packs for students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.prefetchQuery(restaurantsQuery()),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const q = useQuery(restaurantsQuery());
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Restaurants</h1>
      <p className="mt-2 text-muted-foreground">Pick a restaurant to build your pack.</p>
      <div className="mt-8">
        {q.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface h-44 animate-pulse bg-panel" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState message="Restaurants could not be loaded." onRetry={() => q.refetch()} />
        ) : q.data && q.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((r) => (
              <RestaurantCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <EmptyState title="No restaurants yet">New restaurants appear here once they are approved.</EmptyState>
        )}
      </div>
    </div>
  );
}

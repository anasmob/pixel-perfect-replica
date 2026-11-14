import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { RestaurantCard as Card } from "@/lib/public.functions";
import { formatSlot } from "@/lib/time";

export function RestaurantCard({ r }: { r: Card }) {
  return (
    <Link
      to="/restaurants/$slug"
      params={{ slug: r.slug }}
      className="surface group flex flex-col gap-4 p-5 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-tight group-hover:underline">{r.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{r.cuisine}</p>
        </div>
        {r.is_demo ? <Badge variant="muted">Demo</Badge> : null}
      </div>
      <Badge variant="discount" className="self-start px-2.5 py-1 text-xs">
        {r.discount_percent}% off packs of {r.min_meals} to {r.max_meals}
      </Badge>
      <div className="ticket-divider pt-3 text-sm">
        <span className="text-muted-foreground">Next pickup: </span>
        <span className="font-mono text-foreground">
          {r.next_slot ? formatSlot(r.next_slot, r.timezone) : "No open slots this week"}
        </span>
      </div>
    </Link>
  );
}

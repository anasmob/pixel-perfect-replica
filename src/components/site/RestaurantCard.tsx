import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { RestaurantCard as Card } from "@/lib/public.functions";
import { formatSlot } from "@/lib/time";
import { RestaurantCover, RestaurantLogo } from "./RestaurantLogo";

export function RestaurantCard({ r }: { r: Card }) {
  return (
    <Link
      to="/restaurants/$slug"
      params={{ slug: r.slug }}
      className="surface group flex flex-col overflow-hidden transition-colors hover:border-foreground/30"
    >
      <div className="relative">
        <RestaurantCover url={r.cover_url} className="aspect-[16/9] border-b" />
        <Badge variant="discount" className="absolute left-3 top-3 px-2.5 py-1 text-xs">
          {r.discount_percent}% off
        </Badge>
        {r.is_demo ? <Badge variant="muted" className="absolute right-3 top-3">Demo</Badge> : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <RestaurantLogo name={r.name} logoUrl={r.logo_url} />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold leading-tight group-hover:underline">{r.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {r.cuisine} · packs of {r.min_meals} to {r.max_meals}
            </p>
          </div>
        </div>
        <div className="ticket-divider mt-auto pt-3 text-sm">
          <span className="text-muted-foreground">Next pickup: </span>
          <span className="font-mono text-foreground">
            {r.next_slot ? formatSlot(r.next_slot, r.timezone) : "No open slots this week"}
          </span>
        </div>
      </div>
    </Link>
  );
}

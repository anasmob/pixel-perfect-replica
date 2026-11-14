import type { ReactNode } from "react";
import { computePackPrice, formatCents, isMealCountAllowed } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface TicketLine {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export function PackTicket({
  restaurantName,
  lines,
  discountPercent,
  minMeals,
  maxMeals,
  pickup,
  footer,
  className,
}: {
  restaurantName: string;
  lines: TicketLine[];
  discountPercent: number;
  minMeals: number;
  maxMeals: number;
  pickup?: string | null;
  footer?: ReactNode;
  className?: string;
}) {
  const price = computePackPrice(lines, discountPercent);
  const inRange = isMealCountAllowed(price.mealCount, minMeals, maxMeals);
  return (
    <div className={cn("ticket p-5 text-sm", className)} aria-label="Pack summary">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Pickup ticket</span>
        <span className="truncate pl-3 normal-case tracking-normal">{restaurantName}</span>
      </div>
      <div className="ticket-divider my-4" />
      {lines.length === 0 ? (
        <p className="text-muted-foreground">No meals yet. Add dishes to start your pack.</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                {l.quantity} x {l.name}
              </span>
              <span className="shrink-0">{formatCents(l.unitPriceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ticket-divider my-4" />
      <div className="flex justify-between">
        <span>Meals</span>
        <span className={cn(!inRange && price.mealCount > 0 && "text-primary")}>
          {price.mealCount} of {minMeals}–{maxMeals}
        </span>
      </div>
      {!inRange ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {price.mealCount < minMeals
            ? `Add ${minMeals - price.mealCount} more to reach the minimum.`
            : `Remove ${price.mealCount - maxMeals} to stay within the maximum.`}
        </p>
      ) : null}
      {pickup ? (
        <div className="mt-2 flex justify-between gap-3">
          <span>Pickup</span>
          <span className="text-right">{pickup}</span>
        </div>
      ) : null}
      <div className="ticket-divider my-4" />
      <div className="space-y-1.5">
        <div className="flex justify-between text-muted-foreground">
          <span>Menu price</span>
          <span>{formatCents(price.menuTotalCents)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Discount {discountPercent}%</span>
          <span>-{formatCents(price.discountCents)}</span>
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <span>{formatCents(price.totalCents)}</span>
        </div>
      </div>
      {footer ? <div className="mt-5 font-sans">{footer}</div> : null}
    </div>
  );
}

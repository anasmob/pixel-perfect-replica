import { cn } from "@/lib/utils";

const SIZES = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl" } as const;

/** Restaurant logo in a rounded square; falls back to the restaurant's initials. */
export function RestaurantLogo({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl?: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-panel font-display font-semibold text-muted-foreground",
        SIZES[size],
        className,
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" loading="lazy" width={80} height={80} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

/** Cover photo with a neutral panel when the restaurant has none. */
export function RestaurantCover({ url, className, eager }: { url?: string | null | undefined; className?: string; eager?: boolean }) {
  return (
    <div className={cn("overflow-hidden bg-panel", className)}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading={eager ? "eager" : "lazy"} width={1280} height={720} />
      ) : null}
    </div>
  );
}

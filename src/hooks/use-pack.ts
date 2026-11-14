import { useCallback, useEffect, useState } from "react";

export type Pack = Record<string, number>;
const key = (restaurantId: string) => `m4c-pack-${restaurantId}`;

/** The student's pack for one restaurant, kept in this browser until checkout. */
export function usePack(restaurantId: string | undefined) {
  const [pack, setPack] = useState<Pack>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    try {
      const raw = window.localStorage.getItem(key(restaurantId));
      setPack(raw ? (JSON.parse(raw) as Pack) : {});
    } catch {
      setPack({});
    }
    setLoaded(true);
  }, [restaurantId]);

  const update = useCallback(
    (next: Pack) => {
      setPack(next);
      if (!restaurantId) return;
      const clean = Object.fromEntries(Object.entries(next).filter(([, q]) => q > 0));
      window.localStorage.setItem(key(restaurantId), JSON.stringify(clean));
    },
    [restaurantId],
  );

  const clear = useCallback(() => {
    setPack({});
    if (restaurantId) window.localStorage.removeItem(key(restaurantId));
  }, [restaurantId]);

  return { pack, setPack: update, clear, loaded };
}

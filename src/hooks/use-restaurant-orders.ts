import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRestaurantOrders } from "@/lib/restaurant.functions";

export function useRestaurantOrders(enabled: boolean) {
  const fetchOrders = useServerFn(listRestaurantOrders);
  return useQuery({
    queryKey: ["restaurant-orders"],
    queryFn: () => fetchOrders(),
    enabled,
    refetchInterval: 20_000,
  });
}

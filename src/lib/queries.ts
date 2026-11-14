import { queryOptions } from "@tanstack/react-query";
import { getAvailableSlots, getRestaurant, listRestaurants } from "./public.functions";

export const restaurantsQuery = () =>
  queryOptions({ queryKey: ["restaurants"], queryFn: () => listRestaurants(), staleTime: 60_000 });

export const restaurantQuery = (slug: string) =>
  queryOptions({ queryKey: ["restaurant", slug], queryFn: () => getRestaurant({ data: { slug } }), staleTime: 60_000 });

export const slotsQuery = (restaurantId: string) =>
  queryOptions({
    queryKey: ["slots", restaurantId],
    queryFn: () => getAvailableSlots({ data: { restaurantId } }),
    staleTime: 15_000,
  });

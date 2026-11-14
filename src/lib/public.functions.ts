import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export interface RestaurantCard {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  address: string;
  timezone: string;
  is_demo: boolean;
  discount_percent: number;
  min_meals: number;
  max_meals: number;
  next_slot: string | null;
}

export const listRestaurants = createServerFn({ method: "GET" }).handler(async (): Promise<RestaurantCard[]> => {
  const { data, error } = await publicClient().rpc("restaurant_cards");
  if (error) {
    console.error(error);
    throw new Error("Could not load restaurants.");
  }
  return (data ?? []) as RestaurantCard[];
});

export const getRestaurant = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: r, error } = await sb
      .from("restaurants")
      .select("id, slug, name, cuisine, address, timezone, is_demo, discount_percent, min_meals, max_meals, lead_time_hours")
      .eq("slug", data.slug)
      .eq("is_approved", true)
      .maybeSingle();
    if (error) {
      console.error(error);
      throw new Error("Could not load this restaurant.");
    }
    if (!r) return null;
    const { data: dishes } = await sb
      .from("dishes")
      .select("id, name, description, price_cents")
      .eq("restaurant_id", r.id)
      .eq("is_hidden", false)
      .order("sort_order")
      .order("created_at");
    return { restaurant: r, dishes: dishes ?? [] };
  });

export const getAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { restaurantId: string }) => ({ restaurantId: String(input.restaurantId) }))
  .handler(async ({ data }) => {
    const { data: slots, error } = await publicClient().rpc("available_slots", { _restaurant_id: data.restaurantId });
    if (error) {
      console.error(error);
      throw new Error("Could not load pickup slots.");
    }
    return (slots ?? []) as { slot_id: string; start_time: string; capacity: number; remaining: number }[];
  });

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const myRestaurantQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-restaurant", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug, name, cuisine, address, timezone, is_approved, is_demo, discount_percent, min_meals, max_meals, lead_time_hours, logo_url, cover_url")
        .eq("owner_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

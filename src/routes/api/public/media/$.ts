import { createFileRoute } from "@tanstack/react-router";

// Serves restaurant logos and cover photos from the private "restaurant-media" bucket with stable,
// cacheable URLs. Storage itself is owner-only; this route only serves files that a restaurant is
// currently using as its logo or cover photo, so other uploaded files stay private.
const MEDIA_PREFIX = "/api/public/media/";
const SAFE_PATH = /^[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9_-]{1,140}\.(png|jpe?g|webp)$/;

export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = String((params as { _splat?: string })._splat ?? "");
        if (!SAFE_PATH.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = `${MEDIA_PREFIX}${path}`;
        const [{ count: logos }, { count: covers }] = await Promise.all([
          supabaseAdmin.from("restaurants").select("id", { count: "exact", head: true }).eq("logo_url", url),
          supabaseAdmin.from("restaurants").select("id", { count: "exact", head: true }).eq("cover_url", url),
        ]);
        if (!logos && !covers) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("restaurant-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const ext = path.split(".").pop()?.toLowerCase();
        const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        return new Response(data, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});

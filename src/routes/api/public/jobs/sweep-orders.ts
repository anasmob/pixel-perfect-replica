import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled backstop: expires unanswered orders (cancels card holds) and cleans up unfinished checkouts.
export const Route = createFileRoute("/api/public/jobs/sweep-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sweepExpiredOrders } = await import("@/lib/orders.server");
        await sweepExpiredOrders(supabaseAdmin);
        return Response.json({ ok: true });
      },
    },
  },
});

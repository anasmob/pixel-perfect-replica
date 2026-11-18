<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (meals4cheap)

- Pricing math lives only in `src/lib/pricing.ts` (integer cents); server code recomputes every price, never trusts client totals.
- Commission and payout amounts live in `order_financials` / `restaurant_private`, readable only by the owning restaurant, so students can never query them.
- All order status changes and order inserts go through server functions with the admin client (Stripe calls); clients have read-only RLS access to orders.
- Stripe is called via fetch in `src/lib/stripe.server.ts` (edge-runtime safe) and only accepts test-mode keys; Checkout uses manual capture: capture on confirm, cancel on decline/expiry.
- Payouts use Stripe Connect Express destination charges (`application_fee_amount` = commission) only when `restaurant_private.stripe_payouts_ready`; status is refreshed from Stripe on the Payouts tab because there is no webhook.
- Restaurant logos/covers live in the private `restaurant-media` bucket (`<restaurant_id>/...`, owner-only writes) and are served via `/api/public/media/*` so URLs are stable and cacheable (public buckets are blocked).
- The 30-minute response window counts only pickup-hour minutes (`src/lib/deadline.ts`), capped at the booked slot start.
- Expiry runs lazily on order/dashboard reads plus a 15-minute scheduled call to `/api/public/jobs/sweep-orders`.
- Pickup slots are materialized 7 days ahead from weekly `pickup_hours` by `regenerate_slots()` (on save + daily pg_cron); a DB trigger enforces slot capacity on order insert.
- Signup role/profile/restaurant rows are created by the `handle_new_user` trigger, which also rejects non-.edu student emails.
- Order emails go through `src/lib/notify.server.ts`; provider not connected yet, so messages are only logged.
- Dark mode follows the system via `prefers-color-scheme`; no theme toggle.

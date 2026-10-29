# Medical Digital Solutions — Payments & Billing

Standalone Next.js portal deployed independently of the main MDS website.

## Architecture

Next.js 16 / React 19, Supabase-hosted PostgreSQL using a scoped server-side connection, Kashier payment sessions and token charges, Resend transactional email. No WordPress or WooCommerce.

## Installation

1. Configure deployment environment variables using `.env.example` names. Do not commit real secrets.
2. `npm install`
3. `npm run db:migrate` to create tables, restrictive RLS, and the initial Finance account.
4. `npm run build:offline` or `npm run build` (includes idempotent migration).
5. Run `npm start`.

Initial Finance username/password are injected only at deployment. The initial credential requires an immediate password change on first successful sign-in. The seed never overwrites a changed password.

## Financial control

Only finance-approved, client-specific offers can generate private links. Finance can remove unused offers permanently; offers referenced by payments or agreements are archived to preserve accounting history. Active collection schedules must be stopped before removing their offer. Unapproved ratecard source files are not public. Live transactions require `KASHIER_MODE=live` and `ENABLE_LIVE_PAYMENTS=true`, plus organizational Finance sign-off. Monthly Flex is a one-month commitment; automatic monthly renewal is an explicit Finance-approved choice with a maximum of 12 tokenized payments (review before continuing). Fixed-term schedules collect only as authorized. Keep `ENABLE_RECURRING_CHARGES=false` for first live checkout release; enabling real recurring charges also requires a Vercel `CRON_SECRET`, account-approved tokenization, and a separately approved renewal launch. The renewal job only processes subscriptions whose initial payment was made in live mode. Server callbacks determine paid states. Failed-payment auto-retries, automatic term extension, VAT claims, and public catalog publishing are off until approved.

## Operational routes

- `/payments`: public billing gateway
- `/pay/:token`: expiring private offer and checkout
- `/payment-status`: server-confirmed payment state
- `/login`: client email code / Finance sign-in
- `/billing`: client portal
- `/billing/admin`: Finance console including CEO information checklist
- `/api/webhooks/kashier`: signed webhook ingress
- `/api/cron/renewals`: daily authorized recurring token charges

## Notes

Kashier transfer/payout webhooks have a separate Transfer API Key/signature flow; they are not used for payment confirmation until separately implemented. Official tax invoices require Finance-approved ETA operating route. Statements are clearly identified as such. Cron requires `CRON_SECRET` and should be disabled until production launch approval. Avoid using a Vercel Hobby plan for commercial production activity.

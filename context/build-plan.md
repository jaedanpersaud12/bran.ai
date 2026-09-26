# Build plan

The order bran gets built in. Each line is one feature, opened with `/feature start NN`.
The source of truth for product rules is `flvsbran-pkg/docs/flvs-bran-blueprint.md`;
where this plan departs from it, the reason is written here.

## Where we start from (2026-09-26)

The app is a UI shell. Auth is real (shared FLVS accounts via Better Auth), the `bran`
schema holds only `workspaces` and `workspace_members`, and every screen reads hardcoded
data from `src/lib/demo.ts` / `src/lib/metrics.ts`. Nothing writes.

## Decisions that shape the order

- **Neon + Better Auth + R2, not Supabase.** The blueprint assumes Supabase. bran shares
  FLVS's backend instead (see `AGENTS.md`), so its schema is ported to the `bran`
  Postgres schema and tenancy is enforced by every query filtering on `workspace_id`,
  not by RLS.
- **bran owns the catalog, stock and sales.** The FLVS storefront has no stock tracking
  (`public.products.stock` is null) and a handful of orders, so there is nothing to score
  against there. bran is the system of record — the blueprint's DM-Commerce mode — and
  storefronts, FLVS included, become import sources later.
- **DeepSeek is the model provider for all AI** (chosen 2026-09-26; the blueprint says
  Claude). Every AI call goes through one module so the provider is a one-file change.
- **Formula first, words second.** Restock verdicts come from the blueprint's transparent
  formula; the model only writes the plain-language "why". Scoring never depends on an
  AI call succeeding.

## Features

- **01 Restock engine** — `bran` tables for products, variants, stock and sales; a seed
  that creates a demo workspace with ninety days of history; the blueprint §3 scoring
  (days of cover, trend, REORDER/WATCH/HOLD, suggested quantity) as tested pure code; the
  inventory page reading it from the database; "Draft purchase order" saving a real draft.
- **02 Catalog & stock editing** — add and edit products, variants, costs, lead times and
  stock counts in the dashboard, so a brand with no website can run on bran alone.
- **03 AI layer on DeepSeek** — the provider module, env config, failure handling and
  logging; first use is the restock "why" for each verdict, cached per scoring run.
- **04 Orders** — bran-owned orders (manual entry and DM-commerce), the order state
  machine from the prototype, and an importer for FLVS storefront orders. Sales feed
  restock.
- **05 Courier adapter** — the `estimate/createShipment/track/cancel/label` interface;
  manual mode first, oDeliver sandbox second.
- **06 Demand signals** — import FLVS `product_view` / `add_to_bag` events and waitlist
  sign-ups into restock's demand score.
- **07 Instagram DMs + chatbot** — Meta app (start review early), webhook, DeepSeek
  replies with DM-history retrieval, escalation.
- **08 Content pool + scheduler** — uploads to R2, AI captions, scheduled IG publishing.
- **09 Billing & tiers** — plans, the US$50 single-charge cap, weekly billing, tier
  gating by automation level. Provider undecided: the blueprint says Stripe, FLVS already
  uses Wam Pay.
- **10 Onboarding & multi-tenant** — sign-up wizard, workspace creation, support-access
  logging surfaced to the owner.

## Open questions

- Billing provider for 09 (Stripe vs Wam Pay).
- Whether the scoring cron runs on Vercel Cron or on-demand when the inventory page
  loads (01 decides for now; revisit when there are real tenants).

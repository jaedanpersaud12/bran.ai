# Plan — 01 Restock engine

## What we're building
Five `bran` tables (products, variants, sales, purchase_orders, purchase_order_lines), a
deterministic seed for a demo "FLVS Swim" workspace, a pure `scoreVariant` function that
implements blueprint §3 with the prototype's constants, a server-side loader that turns
the tables into scored lines for the inventory page, and a `draftPurchaseOrder` server
action the planner calls.

## Decisions
- **Money is integer cents.** Neon's driver returns `numeric` as a string; integers come
  back as numbers and never round. Columns end in `_cents`.
- **Stock lives on the variant** (`on_hand`), not in a movements ledger. A ledger is right
  once orders (04) and receiving exist to write to it; today nothing does, and a ledger
  with one writer is ceremony.
- **Sales are a ledger** (`bran.sales`: variant, quantity, sold_at, source). Orders (04)
  and the FLVS importer will append to it; restock only reads it.
- **Scoring runs on page load**, not in a cron. One grouped query over ninety days of sales
  for a few hundred variants is milliseconds, and it means a stock change shows up on the
  next reload. Persisted runs arrive with 03, when the model's "why" needs caching.
- **Formula** (blueprint §3; prototype constants where the blueprint is vague):
  - `pace` = units sold in the last 14 days / 14
  - `cover` = (on hand + on order) / pace, `null` when pace is 0
  - `trend` = last 7 days / prior 7 days, `null` when the prior week sold nothing;
    rising > 1.3, falling < 0.7
  - **REORDER** when pace ≥ 0.5/day and cover < lead time + 7-day buffer. Quantity =
    ceil(pace × (lead time + 30) − on hand − on order), at least the variant's minimum
    order (default 5)
  - **HOLD** when cover > 35 days, or the trend is falling, or nothing sold
  - **WATCH** otherwise
  - Lead time is per product, default 21 days
- **"On order"** is the sum of lines on purchase orders with status `sent`. Drafts don't
  count — a draft is a thought, not stock.
- **Sales at risk** = for each REORDER line, the units short before a new order could
  land, (pace × lead time − on hand − on order) clamped at 0, times the unit price.
- **Reference numbers** are per-workspace integers (`number`, unique with `workspace_id`),
  shown as `PO-0001`. The insert computes `max + 1`; the unique constraint turns a race
  into a retry.
- **The planner's lines keep the model's suggestion** (`suggested_quantity` beside
  `quantity`), so "what it thought before you overrode it" survives into the record.
- **Workspace resolution** moves to one server helper, `currentWorkspace()`. Signed in: the
  first workspace the user belongs to. Signed out in development only: the workspace named
  by `DEMO_WORKSPACE_SLUG`, so the screen can be worked on without a session. Production
  never falls back.
- **The action never trusts the client's workspace.** It resolves the workspace itself and
  checks every variant id against it in the same query that reads costs.
- **Tests run on Node's own runner** (`node --test`, type stripping in Node 24). The scoring
  module has no imports, so it needs no build step and no new dependency.

## Departures from app-ui
- **bran's own `Page` furniture, not `@ja3dan/app-shell`.** Every screen already uses
  `PageHeader`/`StatRow`/`Panel` from `src/components/bran/Page.tsx`; switching one screen
  would split the vocabulary. The skeleton reuses those same containers.
- **The planner is not a paged table.** It is one form submitted as a whole; paging would
  hide selected lines from the total you are approving. It stays a single scrolling table.

## Assumptions
- A few hundred variants per workspace for the foreseeable future, so loading all of them
  unpaged is fine.
- Pace from 14 days understates demand for a line that was out of stock part of that
  window. Accepted for now; the blueprint's DM signals (06) are the fix.
- The FLVS storefront's products are not imported in this feature (no stock data there).

## How to build it
1. Schema: the five tables in `db/schema.sql`, idempotent.
2. `src/lib/restock.ts` (pure scoring + summary) and `src/lib/restock.test.ts`; `pnpm test`.
3. `scripts/seed.mjs` + `pnpm db:seed`, deterministic, resetting the demo workspace.
4. `src/lib/workspace.ts` (`currentWorkspace`) and `src/lib/inventory.ts` (the loader);
   the layout uses `currentWorkspace` too.
5. `src/actions/purchase-orders.ts` (`draftPurchaseOrder`).
6. Inventory page reads the loader; planner calls the action; recommendation card built
   from the scored lines; `loading.tsx`; signed-out empty state.
7. Verify in the browser and in SQL; log evidence.

## Out of scope
See `spec.md`.

# 01 Restock engine

## What
The inventory screen runs on real data. bran gets its own tables for products, variants,
stock, sales and purchase orders; the blueprint's restock formula scores every variant
from that data; and "Draft purchase order" saves a real draft with a sequential
reference. A seed script fills a demo workspace so the screen has something to score.

## Why
Restock is the blueprint's stated priority and the most-built screen, and it is still
reading a hardcoded array. It is also the smallest slice that proves the whole stack —
schema, tenancy, a server action, a scoring engine — end to end, which every later
feature reuses.

## Done when
- [x] `pnpm db:setup` creates the new `bran` tables idempotently (running it twice is a no-op), and nothing in `public` changes
- [x] `pnpm db:seed` creates the "FLVS Swim" workspace with products, variants, ninety days of sales and one sent purchase order; running it again resets that workspace rather than duplicating it
- [x] The scoring function has tests covering REORDER, WATCH, HOLD, an out-of-stock line, a line with stock on order, and zero sales, and `pnpm test` passes
- [x] `/inventory` shows the seeded variants from the database, not `src/lib/demo.ts`: changing a variant's stock in SQL and reloading changes its verdict and suggested quantity
- [x] The stat row (lines to reorder, units, cost, sales at risk, median cover) is computed from the same scored lines the planner shows
- [x] "Draft purchase order" inserts a `bran.purchase_orders` row plus one line per selected variant, with the quantity entered and the model's suggestion kept alongside; the confirmation shows the stored reference (e.g. `PO-0002`), and references go up by one per workspace
- [x] The server action rejects lines whose variant belongs to another workspace, and quantities outside 1–999, without writing anything
- [x] Every new query names the `bran` schema and filters by `workspace_id`
- [x] `/inventory` has a `loading.tsx` skeleton in the page's own layout
- [x] Signed out in production, `/inventory` shows an empty state and reads no workspace's data
- [x] `pnpm check` passes

## Out of scope
- Editing products, costs or stock in the UI (02)
- Model-written "why" text — verdict reasons are templated from the formula until 03
- Sending a purchase order to a supplier, or receiving one into stock
- DM, cart and page-view demand signals (06); demand is sales velocity for now
- A nightly scoring cron; scoring runs when the page loads

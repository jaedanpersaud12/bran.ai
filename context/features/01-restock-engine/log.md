# Log — 01 Restock engine

- **2026-09-26** — Feature opened. Plan confirmed by the developer ("do whatever we think
  is a priority … let's not get held up"): decisions taken in `plan.md` without a
  question-by-question pass, on that instruction.
- **2026-09-26** — Checked the shared database before designing: `public.products.stock`
  is null for every FLVS product and there are two orders, so FLVS cannot feed restock
  yet. bran owns stock; see `build-plan.md`.
- **2026-09-26** — Seed tuned so every verdict appears (Flame · S on hand 24 → 19 gives a
  Watch line); without it the seed produced no Watch rows.
- **2026-09-26** — Analytics' "best sellers" also read the demo `STOCK` array; pointed it at
  `loadInventory` (forecast = pace × 14) rather than keep demo inventory alive for it.
- **2026-09-26** — `RecommendationCard` gained an optional `onAccept` that resolves to the
  button's confirmation text, or null on failure; "Accept" on the model's call now drafts the
  PO with the model's own quantities.

## Evidence

- **`pnpm db:setup` idempotent, `public` untouched** — ran it twice back to back, both
  "Applied". The new DDL only names `bran.*`; the one reference to `public` is the
  `created_by` FK to `public."user"`, read-only. *(script)*
- **`pnpm db:seed` creates and resets** — ran twice: both print "12 variants, 1020 sales,
  1 sent PO"; the second run replaced the workspace rather than failing on the unique slug.
  *(script)*
- **Scoring tests** — `pnpm test`: 10 pass, 0 fail. Covers reorder, out of stock, on order
  (short and over-covered), supplier minimum, watch, hold on cover, hold on falling trend,
  slow line, zero sales, summary. *(test)*
- **Page reads the database; SQL change moves the verdict** — set Flame · S `on_hand` 19 → 3
  in SQL and reloaded: Watch (30d) became Reorder "Order 30"; the order bar went from
  5 lines / 294 units to 6 lines / 324 units. Restored to 19. `src/lib/demo.ts` no longer
  has an inventory section. *(SQL + browser)*
- **Stat row from the same lines** — 5 flagged, 294 units, TT$22,082 at cost: hand-summed
  from the five Reorder rows (59+76+51+61+47; 4,012+5,168+3,876+4,514+4,512). *(browser)*
- **Draft saves a real PO** — raised Black · M from 59 to 61 in the planner and drafted:
  "Drafted PO-0002". SQL shows five lines on PO 2, Black · M `quantity` 61 /
  `suggested_quantity` 59, the rest equal. The card's "Draft order" then produced PO-0003:
  references go up by one. Suggestions didn't change after drafting (drafts aren't on
  order). *(browser + SQL)*
- **Action rejects foreign variants and bad quantities without writing** — ran the real
  action through a temporary dev-only route (deleted after) against a throwaway second
  workspace: foreign variant, own + foreign, 0, 1000, 2.5, a non-UUID string, a duplicate
  and an empty list all returned `ok: false`; `count(*)` of purchase orders was 3 before and
  3 after. Throwaway workspace deleted. *(script + SQL)*
- **Every query names `bran` and filters by workspace** — read through `inventory.ts`,
  `workspace.ts`, `purchase-orders.ts`: every table reference is `bran.*`; the sales and
  on-order subqueries and the variant/product joins each filter `workspace_id`. *(code read)*
- **`loading.tsx`** — navigating to `/inventory` showed the skeleton's text ("Loading",
  panel titles, no figures) before the scored page streamed in. *(browser)*
- **Signed out in production shows nothing** — `pnpm build`, then `next start` on :3002
  with `DEMO_WORKSPACE_SLUG` still set: `/inventory` rendered only "Sign in with your FLVS
  account to see your workspace's stock." *(browser, production build)*
- **`pnpm check`** — 0 errors; 4 warnings, all pre-existing (`<img>` in StreamingText,
  an expression in ToolChips). *(script)*

## Notes for later

- Pace understates demand on a line that was out part of the window (Black · M reads
  1.1/day after three days out). Known, in `plan.md`; demand signals (06) are the fix.
- The browser pane's screenshots of a scrolled page show a blank band at the top; the DOM
  is correct (sidebar at top 0). A capture artifact, not a layout bug.
- The review step was not run as a subagent in this session; run `/review` before opening
  the PR if a fresh-eyes pass is wanted.

# Review — 08 Orders

_Reviewed 2026-09-26 against spec.md and plan.md, by a subagent that saw only the spec,
plan, log, the diff against `feat/07-catalog-import`, and the rules. It re-ran `pnpm test`
(69 pass); it did not run `check`/`build` or the browser._

## Layer 1 — Spec alignment
**ISSUES**
- [x] "`/orders` from the database in a TableCard…; demo gone" — met. `loadOrders`, fixed `COLUMNS`, comfortable density, `PadRows` + `TablePager`; `ORDERS`/`DISPATCH` removed. The card collapses when a filter matches nothing (Important 2).
- [x] "Stat strip… with a hint line" — met. The fourth stat, "Last 30 days", is unplanned but logged.
- [x] "Filtering narrows table and pager; open first, oldest first" — met; the filter resets to page 1, and `queueOrder` is tested.
- [x] "New order modal…; prices default from the catalogue" — met. Hidden fields still validate and save (Important 1).
- [x] "Create is one statement…; oversell refused naming the variant" — met. Data-modifying CTEs always run in Postgres, so `shelf` executes; `checkStock` names the variant, and the 23514 backstop re-checks.
- [x] "Row menu…; only valid transitions; server refuses others" — met. Guards: `status = stepFrom(step)`, `status = any(CANCELLABLE)`, `payment <> 'paid'`.
- [x] "Cancel confirms in an alert dialog; returns stock, removes sales; delivered can't be cancelled" — met. The alert dialog is missing app-ui §7's media tile (Minor).
- [x] "Detail modal with lines, totals, customer/delivery, history" — met.
- [x] "`/inventory` reflects it" — met: `refresh()` revalidates `/inventory`, and the sales carry `order_id`.
- [x] "Import from storefront…; idempotent on ref" — met: anti-join, a unique constraint, and the 23505 matched by constraint name. The effect on stock of importing shipped or delivered orders is questionable (Important 3).
- [x] "Unmatched lines must be matched; match remembered" — met.
- [x] "Workspace from session; scoped writes" — met in code; every statement was checked, including the joins in `loadOrders` and `storefront_links`. Never exercised with a second workspace.
- [x] "Nothing written to `public`" — met; grep finds no insert/update/delete/alter/truncate on `public`.
- [x] "`loading.tsx` matching the layout" — met in code; not screenshotted. It copies `StatRow`'s classes by hand, so it will drift if `StatRow` changes.
- [x] "Tests; check; test" — 8 + 11 tests; 69 pass.
- [ ] App-ui "no element changes size" — not fully met (Important 2).
- Planned but missing: plan step 8's `ui-registry.md` and `library-docs.md` updates.
- Built but unplanned: `@base-ui/react` (logged), the fourth stat (logged), and `scripts/.q.mjs` (Important 4).

## Layer 2 — System integrity
**ISSUES**

The boundaries are sound. The server modules are `server-only`, the actions live in
`src/actions`, clients import only types, and the pure modules are shared by both sides.
Every query names `bran.`, `public` is read-only, `schema.sql` is idempotent, and 05's
patterns are reused. The issues:
- a throwaway SQL runner is staged;
- the docs step was skipped;
- the cancel alert dialog doesn't follow app-ui §7's anatomy;
- `StorefrontImport` fetches through a server action in `useEffect`, which is defensible
  for an on-demand dialog but departs from "never fetch in Client Components";
- `alert-dialog.tsx` keeps shadcn's radii, the same as `dialog.tsx`.

## Layer 3 — Production readiness
**ISSUES**

The SQL core is solid:
- each write is one atomic statement, and every data-modifying CTE runs;
- `takesStock` correctly skips both the shelf update and the sales insert for cancelled imports;
- a double cancel is a no-op;
- imported cancelled or delivered orders can't be cancelled;
- a stock race fails the whole statement;
- duplicate variants are merged before the SQL runs.

The problems are at the edges: form state, FLVS semantics, and layout stability.

## Outcome

Fixed on 2026-09-27: Important 1–5; Minor: time zones, discard prompt, shared tones, skipped refs reported, docs. Evidence in `log.md` → "Review fixes". Other minors open, listed in the PR.

## Findings

### Critical — breaks something, or will
None.

### Important — should be fixed before merge
1. **Hidden delivery fee and area are still validated and saved after switching to Pickup.** `OrderDialog.tsx` hides the fields but keeps their values, and `parseOrder` parses the fee regardless of delivery.
   - An invalid fee typed before switching blocks the save with no visible error.
   - A valid fee saves a pickup order with a TT$35 delivery fee.
   - A hidden area over 120 characters also blocks the save.
2. **The card changes height with data and status.**
   - The row-action error paragraph pushes the table down and is never cleared.
   - A filter with no matches swaps the 719px table for a ~260px empty state.
3. **Importing FLVS orders that are already shipped or delivered takes stock off today's shelf, and can be refused for lack of it.**
   - `takesStock = status !== "cancelled"`, and the preview auto-ticks every matched order.
   - Historical storefront orders, already gone before the owner counted stock into bran, get subtracted a second time.
   - A months-old delivered order for a variant now at 0 is refused as out of stock.
   - `checkStock` also runs for cancelled imports, which take no stock.
   - Needs a decision from the developer.
4. **`scripts/.q.mjs` is staged for commit.** It's an arbitrary-SQL runner against the database the storefront shares.
5. **The verification orders are left in `flvs-swim`,** the workspace linked to the real storefront. ORD-0001's sale and its −2 stock count toward restock for Flame · M.

### Minor — worth knowing
- 23514 is always reported as "not enough stock", even when the check that failed is the `order_lines.quantity ≤ 999` cap. A merged FLVS quantity over 999 would trip it.
- Malformed FLVS items are dropped silently, so the order imports with fewer lines. A non-numeric `unitPrice` becomes a TT$0 line.
- Ticked refs that another tab already imported vanish without feedback, and the modal closes as if it succeeded. The import also reads `public.orders` twice.
- The preview allows ticking orders that are short of stock; per line only, and not summed across merged items.
- An optimistic match isn't rolled back when `linkStorefrontItem` fails.
- The preview's status pills use different tones from the table's.
- The cancel alert dialog has no media tile (app-ui §7).
- The New order modal has no discard prompt (app-ui §7: "unsaved drafts ask").
- Dates are formatted without a time zone in SSR'd client components: an order placed after 20:00 in Trinidad can cause a hydration mismatch. 05 has the same issue.
- Merging duplicate lines keeps the first price without saying so.
- `order_lines.variant_id … on delete restrict` could block a future workspace delete.
- A crafted `lines: [null]` makes `createOrderAction` throw.
- The "Awaiting payment" hint can wrap, and so resize its tile, at narrow widths.
- Docs step (`ui-registry.md`, `library-docs.md`) skipped.

# Log — 08 Orders

## Decisions
- 2026-09-26 — Plan confirmed by the developer.
- 2026-09-26 — **`FilterChip` from `@ja3dan` brings `@base-ui/react`.** The registry item is
  built on Base UI's `Menu`, so the install added it as a dependency next to `radix-ui`.
  Kept: app-ui names this component for table filters. `alert-dialog` (shadcn; `@ja3dan`
  has none — 404) shipped `bg-black/10` on its overlay; changed to `bg-foreground/10`, the
  same as our `dialog.tsx`.
- 2026-09-26 — **FLVS stores the town in `contact.city`**, not the `area` column (empty on
  both orders), so the mapping falls back to it. Contact keys seen: name, phone, email,
  country, city, street, postcode (keys only were read).
- 2026-09-26 — `FLVS_STOREFRONT_WORKSPACE=flvs-swim` added to `.env.local` (and documented
  in `.env.example`, along with 07's `AI_VISION_MODEL`).
- 2026-09-26 — Cancel's confirmation built its sentence from JSX pieces and rendered
  "units goback" inside the alert dialog's description; it's one template string now.
- 2026-09-26 — Built a 4th stat ("Last 30 days", order value excluding cancelled) to fill
  the page's four-up `StatRow`; the spec named three.

## Evidence

Browser on the dev server (:3001, demo workspace `flvs-swim`), SQL through a throwaway
Neon script.

- **`/orders` from the database, TableCard, density, fixed columns, 10 rows, pager; demo
  gone** — browser: empty state, then rows from `bran.orders`; `ORDERS`/`DISPATCH` and the
  "Sample" label, "Dispatch" and "Print packing slips" removed (`demo.ts` Orders block
  deleted, grep finds no other readers). Comfortable density, `COLUMNS` fixed widths; the
  table measured 719px with 10 `tbody` rows both unfiltered and filtered to one order;
  pager "1–1 of 1 orders".
- **Stat strip from the database, with hints** — browser, after each step: "Open orders
  1 · 1 not packed yet", "Awaiting payment 1 · TT$555 unpaid or cash on delivery", then 0 ·
  "Nothing owed" after Mark paid; "Shipped" and "Last 30 days TT$555 · 1 order, cancelled
  ones excluded" (the cancelled TT$780 order not counted).
- **Filter by status narrows table and pager; open first, oldest first** — browser: Status
  chip → Cancelled showed only ORD-0002, "1–1 of 1 orders", chip "Status = Cancelled";
  clearing restored all. With ORD-0002 new and ORD-0001 delivered, ORD-0002 sorted first.
  Ordering rule is unit-tested (`queueOrder`).
- **New order modal fields; prices default from the catalogue** — browser: customer,
  phone, channel, delivery, area, fee, payment, variant picker with "N on hand" and
  out-of-stock variants disabled; picking Flame · M filled TT$260; live totals 520 + 35 =
  555.
- **Create is one statement; reference; oversell refused with the variant named, nothing
  written** — browser: qty 500 → "Only 73 of Maracas bandeau, Flame · M on hand — the
  order asks for 500."; SQL after: 0 orders, 1020 sales, on_hand 73. Saved with qty 2 →
  ORD-0001; SQL: on_hand 73 → 71, sales 1020 → 1021 (`source 'dm'`, `order_id` set),
  event `created`.
- **Row menu: icon items, only valid transitions, server refuses others** — browser: menu
  for new + COD was View / Mark packed / Mark paid / Cancel; after packed: Mark shipped;
  after shipped: Mark delivered. A second tab still showing "Shipped" tried Mark delivered
  after the first tab delivered → "That order has changed since you opened it."; its
  Cancel on the now-delivered order was refused the same way (SQL: still delivered,
  on_hand 71, sale kept).
- **Cancel confirms in an alert dialog; returns stock, removes sales; delivered can't be
  cancelled** — browser: `role="alertdialog"` "Cancel ORD-0002? 3 units go back on the
  shelf…"; confirmed. SQL: on_hand 68 → 71, sales 1022 → 1021, ORD-0002's sales 0, its
  line kept, status cancelled. Delivered: no Cancel in the menu, and refused server-side
  (above).
- **Detail modal: lines, totals, customer, delivery, history** — browser via
  `/orders?open=ORD-0001`: line, subtotal/delivery/total, customer, phone, delivery; history
  "Order entered, Marked packed, Marked shipped, Marked delivered", then "Marked paid" after
  Mark paid from the modal. (No "by" names: the dev demo fallback has no signed-in user.)
- **`/inventory` reflects it** — server-rendered `/inventory` after ORD-0001: Flame · M
  `onHand 71`, pace 1.571/day = 22 sold in 14 days (was 20, i.e. 1.43).
- **Import from storefront (FLVS workspace only), read-only, preview, idempotent** —
  browser: button shows for `flvs-swim` (env set); preview listed FLVS-8LXO75AT (TT$335,
  Unpaid — "online") and FLVS-6X3HR12B (TT$600, Cash on delivery — "cash"). Imported the
  second → ORD-0003, channel storefront, pickup, 60000 cents, sale `source storefront`
  dated 2026-09-25 (the FLVS order's date), event `imported`, on_hand 65 → 64. Reopened:
  only FLVS-8LXO75AT listed. A direct duplicate insert of the same ref failed on the unique
  constraint. `public.orders`: 2 rows and md5 `5eb5448a…` before and after.
- **Unmatched lines must be matched; match remembered** — browser: both orders'
  checkboxes disabled until matched; picking a variant saved a `bran.storefront_links` row
  immediately (SQL) and enabled that order's checkbox.
- **Workspace from the session, scoped writes** — code: every action calls
  `currentWorkspace()`; every order/line/event/sales statement is `workspace_id`-scoped;
  `createOrder` looks variants up with `workspace_id = ${ws}` (another workspace's id → "not
  in your catalogue"); transitions match `id and workspace_id`, so another workspace's
  order id matches nothing (the same path as the stale-tab refusal observed above). Not
  exercised with a second workspace — there's only one in this database.
- **Nothing written to `public`** — `grep` for insert/update/delete on `public.` in
  `src`, `scripts`, `db`: none. Reads: `public.orders` (2 selects), `public."user"` (join
  for history names). Row count and hash of `public.orders` unchanged across the import.
- **`loading.tsx` matching the layout** — code: `src/app/(app)/orders/loading.tsx` uses the
  same `PageHeader`, a four-up stat row with the `StatRow` paddings, and the table card at
  05's measured heights (header strip, 39px band, ten 68px rows, 52px pager). Not
  screenshotted mid-load.
- **Tests, check** — `order-status.test.ts` (8), `order-input.test.ts` (11); `pnpm test` 69
  pass; `pnpm check` 0 errors; `pnpm build` passes.

Test data: ORD-0001 (delivered, paid) and ORD-0002 (cancelled) remain in `flvs-swim`, both
named "(08 verify)". The storefront test import (ORD-0003, a real FLVS customer mapped to a
demo variant) and its match were deleted, and the unit put back on the shelf.

## Review fixes (2026-09-27)

The developer said continue on the proposal: fix Important 1–5, with the recommended rule
for 3, plus the minors on time zones, the discard prompt and the docs.

- **I1 — pickup ignores area and fee.** `parseOrder` reads area and fee only for courier;
  the modal's total drops the fee for pickup. Tests: "switching to pickup drops the area
  and fee…" (a 200-char area and fee "abc" parse fine as pickup, area null, fee 0). Also
  hardened: a `null` line is an empty line, not a thrown TypeError (test).
- **I2 — the card keeps its height.** Row-action errors render in the header's one-line
  note; the empty state is `h-[719px]`. Browser: the chip-to-pager span measured 815px with
  2 orders and 815px filtered to "Packed" (no orders, empty state shown).
- **I3 — storefront orders that already shipped don't take stock.** Decision (proposed,
  accepted): an import takes stock only when FLVS says `new` or `packed`
  (`importTakesStock`, tested); shipped/delivered imports still record their sales. New
  column `bran.orders.took_stock` (default true); `createOrder` skips the shelf update and
  the stock check when it's false (still checks the variants are this workspace's), and
  cancel returns stock only `where c.took_stock`. The preview says "Already shipped on the
  storefront: it counts as a sale, and your shelf count isn't changed" and shows the
  short-stock warning only for orders that take stock. Browser: ORD-0002 set to shipped +
  `took_stock = false` with its sale (simulating an import), cancelled from the menu →
  Flame · M stayed 71 (not 74), its sale removed. The cancel dialog and history now say
  "none go back" / "Cancelled" for such orders, and "stock returned" only when it was.
  Not exercised end to end with a real shipped FLVS order: both storefront orders are `new`.
  23514 is now reported as "not enough stock" only for the `on_hand` check.
- **I4 — `scripts/.q.mjs`** unstaged and deleted; never committed.
- **I5 — test orders removed.** Both "(08 verify)" orders deleted (lines, events and sales
  cascade), ORD-0001's 2 units put back. SQL after: 0 orders, 0 events, 0 order sales,
  1020 sales (the seeded count), Flame · M 73, 0 storefront links — the pre-08 baseline.
- **Minor — dates in Trinidad time** (`TIME_ZONE` in `order-status.ts`) in the table,
  detail history and import preview.
- **Minor — discard prompt.** Browser: typed a name, Escape → "Discard this order? What
  you've entered hasn't been saved."; Keep editing kept "Half entered"; Cancel → Discard
  closed both.
- **Minor — shared tones.** The import preview uses the table's `STATUS_TONE` /
  `PAYMENT_TONE`, now exported from `order-status.ts`.
- **Minor — ticked refs no longer on offer** are reported as skipped ("already imported,
  or no longer on the storefront") instead of vanishing; the import reads `public.orders`
  once per step, not through a `Promise.all` of one.
- **Minor — docs.** `library-docs.md` (FilterChip on Base UI, shadcn alert-dialog,
  Radix Select positioning) and `ui-registry.md` (order queue).
- `pnpm test` 72 pass.

Still open (minor, listed in the PR): malformed FLVS items dropped silently; preview allows
ticking short-stock orders (per line, not summed); optimistic match not rolled back on
failure; the cancel alert dialog has no media tile; duplicate-line price merge is silent;
`order_lines … on delete restrict`; the "Awaiting payment" hint can wrap; `loading.tsx`
copies `StatRow`'s classes.

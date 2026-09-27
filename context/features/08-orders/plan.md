# Plan — 08 Orders

## What we're building
`/orders` backed by three new `bran` tables: orders, order lines, and order events. The
page has a stat strip, a status filter and a paged `TableCard`. "New order" opens a modal
that creates an order in one SQL statement: the order, its lines, stock taken off
`on_hand`, sales rows for restock, and a "created" event. Row menus move an order along
its fulfilment path, mark it paid, or cancel it. Cancelling returns the stock and removes
the sales in one statement. A detail modal shows lines, totals, customer and history. For
the workspace linked to FLVS, "Import from storefront" previews `public.orders` not yet
imported. Lines are matched to variants (remembered in `bran.storefront_links`), and the
previewed orders are imported through the same create path.

## Decisions
- **Tables** (`db/schema.sql`, idempotent):
  - `bran.orders`: `id`, `workspace_id`, `number` (unique per workspace, `ORD-0001`),
    `channel` (`instagram` | `whatsapp` | `tiktok` | `in_person` | `storefront` | `other`),
    `customer_name`, `customer_phone`, `delivery` (`courier` | `pickup`), `area`,
    `payment` (`paid` | `unpaid` | `cod`), `status` (`new` | `packed` | `shipped` |
    `delivered` | `cancelled`), `delivery_fee_cents`, `notes`, `external_source`,
    `external_ref` (unique with `workspace_id, external_source`), `placed_at`,
    `created_by`, `created_at`.
  - `bran.order_lines`: `(order_id, variant_id)` PK, `quantity`, `unit_price_cents`. A
    variant appears once per order; the modal merges duplicates.
  - `bran.order_events`: `order_id`, `kind` (`created` | `packed` | `shipped` |
    `delivered` | `paid` | `cancelled` | `imported`), `by` (user id, nullable), `at`.
  - `bran.sales` gains `order_id` (nullable FK, `on delete cascade`), so a cancel can find
    and delete an order's sales. Seed and manual sales keep it null.
  - `bran.storefront_links`: `(workspace_id, source, item_key)` → `variant_id`.
    `item_key` is the storefront product id plus its sorted choices
    (`flvs-kino|Colour=…|Size=XS`).
- **A sale counts at creation** (confirmed in spec). Create inserts
  `bran.sales(quantity, sold_at = placed_at, source, order_id)`. Channel maps to source:
  DM channels → `dm`, `storefront` → `storefront`, the rest → `manual`. Cancel deletes
  those rows and adds the quantities back. That's one statement with a `status <>
  'cancelled' and status <> 'delivered'` guard, so a double cancel is a no-op.
- **Overselling is caught twice.** The action checks each line against `on_hand` first,
  to name the variant in its message. The existing `check (on_hand >= 0)` is the backstop:
  a race still fails the whole statement (23514), mapped back to the same message.
- **The state machine is a pure module** (`src/lib/order-status.ts`): `new → packed →
  shipped → delivered`, `cancel` from anything but `delivered`/`cancelled`, `paid` from
  `unpaid`/`cod`. It gives the row menu its items and gives each action the `from` states
  for its guarded `update … where status in (…)`, like 05's transitions. Every transition
  writes its event in the same statement. It's tested under `node --test`.
- **Payment is a separate field from status.** Delivering a `cod` order doesn't mark it
  paid, because the courier collecting cash isn't the owner having it. "Mark paid" stays
  available, and the "Awaiting payment" stat counts `unpaid` + `cod` among open and
  delivered orders.
- **Money:** lines store `unit_price_cents`, defaulting to the variant's price, editable
  in the modal through 02's `parseMoney`. Totals are computed, not stored.
- **References:** `ORD-0001`, per-workspace `max(number)+1` with the same retry-on-23505
  loop as `createDraftOrder`.
- **One create path, `createOrder(workspaceId, userId, input)`** in
  `src/lib/orders.ts`. It's server-only, returns `{ok, reference}`, and is shared by the
  modal's action, the storefront import, and later 11's DM bot. It re-reads prices and
  stock from the workspace's own variants, so a foreign variant id isn't found.
- **FLVS link: env `FLVS_STOREFRONT_WORKSPACE=<slug>`.** Exactly one workspace is FLVS's,
  and that's a deployment fact, not tenant data. 14 (onboarding / multi-tenant) replaces
  this with a per-workspace store connection. The import button and both import actions
  check it on the server.
- **Storefront import is read-only on `public`.** One `select` on `public.orders`.
  - **Mapping:** FLVS money is whole TT$, ×100. `payment_status = 'paid'` → `paid`;
    otherwise `payment = 'cash'` → `cod`, else `unpaid`. `fulfilment_status` maps known
    values (`new`, `packed`, `shipped`, `delivered`, `cancelled`) and anything else →
    `new`. Delivery method: `pickup` → pickup, else courier. `placed_at` = the FLVS
    `created_at`, so sales land on the day sold.
  - **Import status:** an imported order that FLVS already calls delivered or cancelled
    imports in that status. A cancelled one is skipped by default, since it takes no stock.
  - **Preview:** the storefront's orders not yet imported (anti-joined on `external_ref`).
    Each line shows its matched variant, or a variant picker if unmatched. Orders whose
    lines are all matched and in stock get a tick; the rest can't be ticked until fixed.
    Choosing a match saves the link immediately, so it's remembered even if you close
    the preview.
- **UI follows 05 and app-ui.** A `TableCard` (comfortable density, `StackedCell` for
  customer + channel), `usePaged(…, 10)` + `PadRows` + `TablePager`, and `StatusPill`
  tones: new = info, packed = warning, shipped = neutral, delivered = success,
  cancelled = neutral with no dot. Payment is a second, dotless pill. The `⋯` menu has
  icon items. The status filter is `FilterChip`s in the header toolbar.
  - **Detail:** a `Dialog`, deep-linkable with `?open=ORD-0004` like 05.
  - **Stat strip:** the page's existing `StatRow`, with counts from the same load.
  - **Cancel:** confirms in an `AlertDialog`. If the registry/shadcn install isn't
    available, it follows 05's confirm dialog and says so in `log.md`.
- **The demo goes.** `ORDERS`/`DISPATCH` are removed from `demo.ts` if nothing else reads
  them, along with the page's "Sample" label and its "Dispatch"/"Print packing slips"
  buttons, which are 09's.

## Assumptions
- `public.orders.items[].id` is the storefront product id and `choices` fully identifies
  the variant bought. Seen on the 2 existing rows only.
- FLVS `fulfilment_status` values other than `new` exist in the storefront's admin. Not
  seen in data; anything unknown maps to `new`.
- Neon runs each multi-CTE statement as one transaction (it holds for 05 and 07).
- Order volumes are dozens a week, so the list loads all orders and pages on the client
  like the catalogue. Past ~2,000 orders it would want server paging.
- `demo.ts`'s dashboard numbers don't read `ORDERS`. To be checked before deleting.

## How to build it
1. Schema: the tables, `sales.order_id`, indexes (`orders (workspace_id, status)`,
   `sales (order_id)`); `pnpm db:setup`.
2. `src/lib/order-status.ts` + tests: transitions, menu items, labels and tones.
   `src/lib/order-input.ts` + tests: parse the modal's input (lines, quantities, money,
   phone, required fields), reusing `parseMoney`. Also the FLVS item-key and field
   mapping, pure and tested.
3. `src/lib/orders.ts` (server-only): `loadOrders` (summaries + lines + events in three
   queries), `createOrder`, `transitionOrder`, `cancelOrder`.
4. `src/actions/orders.ts`: `createOrderAction`, `advanceOrder`, `markPaid`,
   `cancelOrderAction`, each resolving the workspace from the session and calling
   `revalidatePath` for `/orders` and `/inventory`.
5. The UI:
   - `/orders/page.tsx`, `loading.tsx`.
   - `OrdersTable.tsx`: table, filter, menu, detail and cancel.
   - `OrderDialog.tsx`: the create modal with a variant picker per line and live totals.
   - Remove the demo.
6. Storefront import: `src/lib/storefront-flvs.ts` (server-only read of `public.orders` +
   links), actions `previewStorefrontImport`, `linkStorefrontItem` and
   `importStorefrontOrders`, and `StorefrontImport.tsx` (the preview modal).
7. Verify every criterion in the browser and SQL:
   - counts before and after create and cancel;
   - `/inventory` on-hand and pace moving;
   - importing twice creating nothing;
   - a row count on `public.orders` before and after;
   - a grep for writes to `public`.
   Then `pnpm check`, `pnpm test`, `pnpm build`.
8. Docs: `ui-registry.md` (order row, stat strip on a list screen), `library-docs.md` if
   anything surprised.

## Out of scope
- Couriers, tracking, labels, dispatch (09). "Shipped" is manual here
- DM-bot orders (11), which will call `createOrder`
- Taking payment; editing lines; returns, refunds, partial fulfilment
- Writing status back to FLVS; other storefront platforms
- A customer list

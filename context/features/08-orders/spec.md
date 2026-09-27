# 08 Orders

## What
`/orders` becomes real: bran-owned orders, entered by hand (a DM or WhatsApp sale) or
imported from the FLVS storefront, in one queue. Each order has lines against catalogue
variants, a customer and delivery details, a payment status and a fulfilment status that
moves New → Packed → Shipped → Delivered (or Cancelled). Orders take stock off the shelf and
feed restock's sales, so the restock engine finally scores from real selling, not the seed.

## Why
Restock is only as good as its sales data, and today the only sales are seeded. bran is the
system of record for DM-commerce brands (build plan, "bran owns the catalog, stock and
sales"), so it needs the order itself — not just a sales count. It's also the base 09
(courier), 10 (demand signals) and 11 (the DM bot creating orders) build on.

## Done when
- [x] `/orders` lists the workspace's orders from the database in a `TableCard`: declared density, fixed column widths, ten rows per page padded to ten, pager always shown; the demo `ORDERS` data and the "Sample" label are gone
- [x] A stat strip above the table shows open orders, awaiting payment, and shipped-not-delivered, each counted from the database, with a hint line
- [x] Filtering by fulfilment status narrows the table and the pager count; open orders (not delivered, not cancelled) show first, oldest first
- [x] "New order" opens a modal: customer name, phone, channel (Instagram DM, WhatsApp, TikTok, In person, Other), delivery method (courier, pickup) and area, payment (paid, unpaid, cash on delivery), and one or more lines picked from active variants with quantities; prices default from the catalogue and can be changed
- [x] Creating an order is one statement: the order, its lines, stock taken off each variant's `on_hand`, and a `bran.sales` row per line (`source` from the channel); it gets a per-workspace reference (`ORD-0001`); a line for more than is on hand is refused with a message naming the variant, and nothing is written
- [x] Each row's `⋯` menu (icon items) offers View, the next fulfilment step (Mark packed / Mark shipped / Mark delivered), Mark paid when unpaid, and Cancel; only valid transitions are offered, and the server refuses any other
- [x] Cancel confirms in an alert dialog; cancelling puts each line's quantity back on `on_hand` and removes its sales rows, so restock no longer counts it; delivered orders can't be cancelled
- [x] View opens a detail modal with the lines, totals (subtotal, delivery fee, total in TT$), customer and delivery details, and a status history (who changed what, when)
- [x] After an order is created or cancelled, `/inventory` reflects it on the next load: on-hand and the variant's sales pace move
- [x] "Import from storefront" (only for the workspace linked to the FLVS storefront) reads `public.orders` read-only, previews the orders not yet imported, and imports them as bran orders with channel Storefront; importing twice creates nothing new (keyed on the FLVS `ref`)
- [x] A storefront line that can't be matched to a bran variant is shown in the preview and must be matched to a variant (or the order skipped) before import; the match is remembered for the next import
- [x] Every order action resolves the workspace from the session and scopes reads and writes by `workspace_id`; an order id from another workspace changes nothing
- [x] Nothing is written to `public` (the storefront's schema) — checked by grep for writes and by row counts
- [x] `/orders` has a `loading.tsx` skeleton matching the stat strip and table layout
- [x] The order state machine and money/line parsing have tests; `pnpm check` and `pnpm test` pass

App-ui criteria: all apply — skeleton, fixed-height paged table, icon row menu, create in a
modal, destructive (cancel) confirmed in an alert dialog, stat strip with hints, and no
element changes size when status or data changes.

## Out of scope
- Booking a courier, tracking numbers, labels (09) — "Shipped" is a manual mark here
- Orders created by the DM chatbot (11); 08 provides the create path it will call
- Payment links or taking payment (WiPay etc.); payment status is recorded, not collected
- Editing an order's lines after it's created (cancel and re-enter)
- Returns and refunds, partial fulfilment, splitting an order
- Writing fulfilment status back to the FLVS storefront
- Importing from Shopify / WooCommerce / other platforms (the adapter layer)
- Customer records beyond what's on the order (no customer list or history screen)

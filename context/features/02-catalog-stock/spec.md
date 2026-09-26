# 02 Catalog & stock editing

## What
A catalog screen at `/inventory/catalog` where a brand owner adds products and variants,
edits names, SKUs, costs, prices, lead times and minimum orders, sets stock counts, and
archives variants they no longer sell. Everything restock scores can now be maintained in
the app instead of through `pnpm db:seed`.

## Why
Feature 01 made restock real but left no way to put real stock into it. A brand with no
website — the blueprint's DM-Commerce mode — needs bran to be its catalogue; until this
exists, only the seed can feed the engine.

## Done when
- [x] `/inventory/catalog` lists the workspace's variants in a `TableCard`: comfortable density, fixed column widths, ten rows per page padded to ten, and a pager footer that always renders
- [x] Searching by product name or SKU narrows the rows and the pager count; "Show archived" includes archived variants, off by default
- [x] "Add product" opens a modal that creates a product and its first variant; the new row appears without a manual reload, and restock scores it on `/inventory`
- [x] Each row's `⋯` menu (icon items) offers Edit variant, Edit product, Add variant, and Archive/Restore; each edit opens a modal pre-filled with that row's values
- [x] Clicking a row's on-hand count swaps in an input; Enter saves, Escape cancels, and the new count shows immediately; on `/inventory` the verdict reflects it
- [x] Archived variants disappear from `/inventory` scoring and totals, keep their sales and purchase-order history, and come back on Restore
- [x] Money is entered in TT$ (e.g. `68` or `68.50`) and stored as cents; invalid input (negative, non-numeric, a duplicate SKU in the workspace, empty names) is refused with a message under the field, and nothing is written
- [x] Every catalog action resolves the workspace from the session and scopes its write by `workspace_id`; an id from another workspace changes nothing
- [x] The input parser has tests, and `pnpm test` passes
- [x] `/inventory/catalog` has a `loading.tsx` skeleton matching its layout
- [x] `pnpm check` passes

## Out of scope
- Recording sales or orders (04) — stock moves only by setting a count
- A stock-movement ledger or adjustment history
- Product images and descriptions (08 brings R2 uploads)
- Hard deleting products or variants — archiving is the only removal
- Importing the FLVS storefront's catalogue

# Plan — 02 Catalog & stock editing

## What we're building
An `archived_at` column on variants; a pure input parser (`src/lib/catalog-input.ts`) with
tests; six server actions in `src/actions/catalog.ts`; a catalog loader; and the
`/inventory/catalog` screen — a paged `TableCard` with search, an archived filter, inline
stock editing, row menus and create/edit modals.

## Decisions
- **Lives under Inventory, not a new nav item.** `sectionFor` matches by prefix, so
  `/inventory/catalog` lights Inventory; the Inventory header links to it. A separate nav
  entry would need a new tint token for a screen that is Inventory's back room.
- **One row per variant**, product name over variant label in a `StackedCell`. Variants
  are what's stocked and costed; a product-per-row table would hide the field people edit.
  Product-level fields (name, lead time, supplier) are edited from any of its rows.
- **Archive, never delete.** A variant with sales or purchase-order lines can't be deleted
  without losing history (sales cascade; PO lines restrict). `archived_at` hides it from
  restock and the default catalog view and keeps everything. Products aren't archived on
  their own — a product with no active variants simply isn't scored.
- **Stock is set, not adjusted.** "On hand" is a count the owner types after counting the
  shelf. A movements ledger comes with orders (04), when there is a second writer.
- **Parsing is pure and shared.** `parseProductInput` / `parseVariantInput` take strings,
  return `{ ok, value } | { ok: false, errors: Record<field, message> }`. The actions call
  them; the modals show `errors` under their fields. No schema library for six fields.
- **Actions take plain objects, not FormData**, called from a transition; they return
  `{ ok: true } | { ok: false, errors }`. Each resolves `currentWorkspace()`, writes with
  `workspace_id = $ws` in the `WHERE` (or checks the parent product belongs to it on
  insert), and calls `revalidatePath` for the catalog and `/inventory`.
- **Duplicate SKUs** are caught by the existing `unique (workspace_id, sku)` and returned
  as a field error on `sku`, not pre-checked (a pre-check races).
- **Filtering and paging happen on the client.** A few hundred variants arrive in one
  query; search and paging over that in memory are instant and keep the URL simple.
- **Inline stock edit is optimistic** (`useOptimistic`), rolled back with the error shown
  in the cell if the action fails.

## Departures from app-ui
- **No `@ja3dan/table-pager`, `dialog`, `dropdown` or `loading-button`** — not published on
  the registry (404 on 2026-09-26). Built to the app-ui spec locally: `usePaged`, `PadRows`,
  `TablePager` in `src/components/bran/TablePager.tsx`; the existing shadcn `Dialog` and
  `DropdownMenu`; a small `LoadingButton` that holds its width across states.
- **No `AlertDialog`** — there is no destructive action; archiving is reversible and
  happens in one click from the menu.
- **Page furniture stays bran's `PageHeader`** (as in 01); the table is the registry's
  `TableCard`.

## Assumptions
- A workspace has at most a few hundred variants, so loading them all is fine.
- TT$ is the only currency.

## How to build it
1. Schema: `archived_at` on `bran.variants`; restock loader filters it out.
2. `src/lib/catalog-input.ts` + tests.
3. `src/lib/catalog.ts` loader; `src/actions/catalog.ts`.
4. `TablePager`, `LoadingButton`.
5. Catalog page, table, modals, inline stock cell; `loading.tsx`; link from Inventory.
6. Verify in browser and SQL; log evidence.

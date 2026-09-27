# UI Registry

The project-specific decisions the token contract doesn't make: how `@ja3dan` registry
components get composed into this project's own sections, and which contract token a
custom (non-registry) component chose for each visual role. Written and kept current by
the `imprint` skill — run `/imprint` after building a composition or a custom component,
not just once at the end.

This file starts empty on purpose. An entry here is a decision someone actually made on
this project; writing an example from nowhere would defeat the point — see `imprint`'s own
rule against recording anything that isn't a real, current pattern in this codebase.

Read this before composing a new section or building a new custom component: match an
existing entry rather than inventing a new arrangement or a new token choice for something
this project has already decided once.

---

### Catalog table (app-ui table card — departures only)

File: src/components/bran/CatalogTable.tsx, src/components/bran/TablePager.tsx, src/components/bran/LoadingButton.tsx
Last updated: 2026-09-26
Built from: @ja3dan/table-card, @ja3dan/empty-state, @ja3dan/status-pill; shadcn dialog, dropdown-menu, switch, input

| Property            | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Pager               | Local `usePaged` / `PadRows` / `TablePager` — `@ja3dan/table-pager` 404s |
| Loading button      | Local `LoadingButton` (both labels in one grid cell) — registry item 404s |
| Toolbar             | search (`flex-1 min-w-48`, `h-8 pl-8`) · labelled `Switch` · primary `size="sm"` |
| Columns             | fixed widths, trailing `""` spacer before the `w-14` actions column       |
| Archived rows       | `text-muted-foreground` row + neutral `StatusPill` beside the variant label |

**Pattern notes:** Swap the local pager and loading button for the registry items once
they're published; the props match app-ui §5/§8. Search or filter changes reset to page 1.
A `Switch` is named with `id` + `<label htmlFor>` — wrapping it in a label doesn't name a
button-based switch.

### Inline stock cell

File: src/components/bran/CatalogTable.tsx (`StockCell`)
Last updated: 2026-09-26

| Property           | Token                                                          |
| ------------------ | -------------------------------------------------------------- |
| Resting            | plain `mono` figure; `hover:bg-muted`, `rounded-md px-1.5`      |
| Zero               | `text-negative`                                                 |
| Editing            | `h-7 w-16 rounded-md border border-border bg-background`, right-aligned `mono` |
| Focus              | `focus-visible:ring-[3px] focus-visible:ring-ring/25`           |
| Error              | `text-[11px] text-negative` under the figure, `role="alert"`    |

**Pattern notes:** Any "one field people change constantly" editor should match this: the
input selects its contents on open (typing replaces, never appends), Enter saves, Escape
and blur cancel, the value is optimistic and rolls back with the reason on failure.

### Review table in a modal (catalog import)

File: src/components/bran/CatalogImport.tsx (`Review`)
Last updated: 2026-09-26
Built from: shadcn dialog, input, checkbox; @ja3dan/status-pill; AI Elements prompt-input, attachments

| Property        | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Modal width     | `sm:max-w-lg` for the input step, `sm:max-w-6xl` once there's a table        |
| Table frame     | `max-h-[55vh] overflow-auto rounded-lg border border-border`, `table-fixed`, `<colgroup>` widths |
| Header          | `sticky top-0 bg-muted text-[11px] font-medium text-muted-foreground`         |
| Cells           | every cell an `Input` `h-8 px-2 text-xs`, `aria-label="{Column}, row N"`      |
| Cell note       | `text-[11px] leading-tight` under the input: `text-negative` error, else `text-muted-foreground` note ("New product", "Suggested by bran") |
| Discarded row   | inputs `disabled` (the shadcn input fades itself); notes hidden               |
| Footer          | "N of M ticked rows are ready" (`tabular-nums`, `mr-auto`) · Back · `LoadingButton` "Import M" |
| AI marker       | `AiMark label="Read by AI"` after the row count, not a banner                 |

**Pattern notes:** For any "AI drafted it, you check it" batch: one row per record, all
cells editable, a keep checkbox, the same parser the server runs checking on every
keystroke, and the primary action disabled until every kept row is clean. The server's
errors are merged over the client's per row and cleared when that row is edited. The
page-level fixed-height/pager rules don't apply inside a modal.


### Order queue (list screen with a stat strip)

File: src/app/(app)/orders/page.tsx, src/components/bran/OrdersTable.tsx, src/app/(app)/orders/loading.tsx
Last updated: 2026-09-27
Built from: `StatRow` (Page.tsx), @ja3dan/table-card, @ja3dan/status-pill, @ja3dan/filter-chip, shadcn alert-dialog

| Property          | Value                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Page order        | `PageHeader` → four-up `StatRow` → `mt-6` table card                          |
| Stats             | counts from the page's own load, each with a one-line note (no deltas yet)   |
| Toolbar           | `FilterChip` "Status" on the left; secondary + primary buttons `ml-auto`      |
| Columns           | ref + date (StackedCell) · customer + channel (StackedCell) · status pill · payment pill · items · total · `""` destination · `w-14` actions |
| Status tones      | `STATUS_TONE` / `PAYMENT_TONE` in `src/lib/order-status.ts`, shared by every screen showing an order |
| Row-action errors | in the `TableCardHeader` note (one truncated line, `text-negative`, `role="alert"`), never a band above the table |
| Empty / filtered  | `EmptyState className="h-[719px] justify-center py-0"` — the height of the ten-row table it replaces |
| Dates             | `timeZone: "America/Port_of_Spain"` on every `toLocale*` in a server-rendered client component |

**Pattern notes:** A destructive confirm is an `AlertDialog` whose copy says exactly what
happens to stock and restock ("3 units go back on the shelf…"), and changes when that's not
true (an order that never took stock). A create modal marks itself dirty from its change
handlers, and closing it while dirty asks "Discard this order?" first.

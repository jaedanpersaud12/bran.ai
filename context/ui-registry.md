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

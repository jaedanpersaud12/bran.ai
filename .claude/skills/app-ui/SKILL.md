---
name: app-ui
description: How a groundwork app's signed-in screens look and behave — the sidebar shell, instant navigation with loading skeletons, fixed-height paged tables, row actions in an icon menu, CRUD in modals, stat strips and panels. Read before building or reviewing any admin, dashboard, portal or other app screen.
---

The token contract fixes which colour is correct. This fixes what an app screen *is*: its
frame, its furniture, how it moves and how it waits. The reference is a production CMS
where every rule below replaced something that looked fine in isolation and wrong
across forty screens.

Two failures this exists to stop. **Drift** — three stat tiles, two panel headers and a
table per screen, so every page teaches the reader a slightly different alphabet.
**Movement** — rows that grow with their data, pages that wait blank on the old screen,
buttons that change width mid-click, so nothing is where the eye left it.

Public marketing pages are out of scope; they follow the project's own `ui-rules.md`.

## How to use this

- **Before building** an app screen: read the sections for what the screen contains, and
  reach for the named `@ja3dan` item. If the item isn't installed yet, install it
  (`bunx shadcn add @ja3dan/<item>`). If it isn't published yet, build to the spec here and
  note it in `log.md` — don't invent a variant.
- **In `/architect`:** any decision this file already makes is not a question for the
  developer. Only a reason to depart from it is.
- **In `/review`:** every rule here is a Layer 2 check. A screen that departs without a
  stated reason in `plan.md` is a finding.
- **When a rule makes a real screen worse,** that's a finding about the rule — `/harvest`
  it. Don't quietly work around it.

---

## 1. The shell

One frame for every signed-in screen. `@ja3dan/app-shell` (sidebar + header + page header).

- **Sidebar, collapsible to an icon rail.** Width `16rem` open, `3rem` collapsed, `18rem`
  as a sheet on mobile. ⌘/Ctrl+B toggles; the choice persists in a cookie.
- **Grouped by when a section gets opened**, not by what it manages: the daily desk first
  (inbox, orders), growth levers, content that changes in batches, catalog, settings last.
  Group labels `text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground`.
- **Nav is data** — one `nav.ts` array of `{ key, label, href, icon, tint, needs }`.
  `sectionFor(pathname)` picks the active row: the root (`/admin`) matches exactly, the rest
  by prefix. Items the viewer can't open are removed, and groups that empty out are dropped
  whole. Hiding a link is a courtesy; the page and every action still check permission.
- **Each destination has its own tint** (`nav-1` … `nav-8` tokens). The row re-points
  `--sidebar-accent` / `--sidebar-accent-foreground` to a mix of its tint, so hover and
  active states come out in that section's colour with nothing to override. Icon in the
  tint; `strokeWidth` 2 when active, 1.5 otherwise. Rows `h-9 gap-3 px-3 text-[13.5px]
  font-medium`, active `font-semibold`. The brand colour is not a nav tint.
- **Collapse animates as one piece:** `duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]`.
  Padding holds still across the collapse (changing it steps content sideways); the logo
  scales down rather than swapping for a second mark; footer text fades (`opacity` + `blur`)
  instead of `display:none`, at a fixed width so it never reflows while the panel grows.
  `motion-reduce:transition-none` everywhere.
- **Keyboard toggles are instant.** The provider sets `data-instant` when the shortcut
  fired; animated parts carry `in-data-[instant]:transition-none`. Animation is for the
  pointer, where the eye is following; a shortcut user already knows where it's going.
- **Footer:** "View website" (new tab) and "Sign out" as menu rows with tooltips when
  collapsed; the signed-in email truncated beside the theme switch.
- **Header:** sticky `h-14`, `border-b bg-background/95 backdrop-blur`, sidebar trigger, a
  `h-4 w-px bg-border` divider, then a small uppercase area label. Nothing else lives here.
- **Content:** `p-4 sm:p-6 lg:p-8`. The whole shell sets `tracking-tight` once at the root
  rather than per element.
- **`scrollbar-gutter: stable`** on `html`, so pages don't shift 15px between short and long.

## 2. Page header

`PageHeader` from `@ja3dan/app-shell`. Every app screen opens with it.

- **Sticky under the shell header** (`sticky top-14`, `bg-background/85 backdrop-blur`,
  bleeding to the content edges with negative margins that match the content padding).
  Admin screens are long tables; a title that scrolls away takes the filters and the "add"
  button with it.
- Title `font-heading text-2xl leading-none`; beside it on the baseline a **one-line**
  summary (`text-xs text-muted-foreground`, truncated) saying what the screen answers — not
  a paragraph about the feature. Controls (filters, toggles, the primary action) on the
  right.
- A screen that genuinely needs explanation gets a `Preamble` under the header
  (`max-w-3xl text-sm text-muted-foreground`), not a longer summary.

## 3. Navigation is instant; waiting is a skeleton

- **Every dynamic route has a `loading.tsx`.** Next prefetches nothing for a dynamic route
  without a loading boundary, so the browser sits on the old screen — no title, nothing —
  until every query finishes. With one, the transition starts on click and the shell stays
  live while the page streams in. A route group's `loading.tsx` is the backstop; busy
  screens write their own.
- **No page-transition animations.** Route changes swap immediately into the skeleton.
- **Skeletons reuse the real furniture** (`@ja3dan/skeleton`): `PageHeaderSkeleton`,
  `StatStripSkeleton`, `PanelSkeleton`, `TableSkeleton`, `ToolbarSkeleton`,
  `CardGridSkeleton`, built from `Bar` and `Block` placed inside the same `PageHeader`,
  `StatStrip`, `TableCard` containers the page uses. Same containers, same paddings, so
  content lands in place. A skeleton that reflows turns one wait into two.
- `Bar` is `inline-block h-[1em]` so it inherits the type size of the slot it sits in; fill
  is `animate-pulse bg-foreground/10`, never `bg-muted` (too close to the ground to see).
  Panel rows taper (`w-4/5, w-3/5, w-2/3…`) so a ranked list reads as data arriving.
- `LoadingScreen` wraps the whole skeleton with one `role="status" aria-busy` and a single
  sr-only "Loading" — never forty announcements.
- **Error boundary inside the app group** (`app/<area>/(group)/error.tsx`), so one failing
  screen keeps the shell and a way back. Show the digest. For an unrecognised server action
  (a tab left open across a deploy), offer a full reload, not retry.

## 4. Surfaces, radii, depth

- **Three radii, named for what they sit on:** `rounded-chip` (badges, tags, menu items,
  small thumbnails), `rounded-control` (buttons, inputs, selects, icon buttons, toggles),
  `rounded-surface` (cards, panels, dialogs, popovers, images). `rounded-full` only for true
  circles. An element inset inside another takes the next step down, so corners stay
  concentric.
- **Raised things use `shadow-border`**, not a border: a transparent hairline plus soft lift
  that keeps its weight on any ground. Hover: `shadow-border-hover`. Floating things (menus,
  popovers): `shadow-popover`. Dividers and table hairlines stay real `border-border`.
- `scroll-slim` on any panel or table that scrolls.

## 5. Tables

`@ja3dan/table-card` + `@ja3dan/table-pager`. Every list screen is the same card.

- **`TableCard` > `TableCardHeader`** (icon tile `size-7 rounded-control bg-muted/60`,
  `font-heading text-lg` title, optional one-line `text-[11px]` note, controls) >
  **`DataTable`** > `Thead` (sentence case, `text-[13px]`, `bg-muted/40` band) / `Tbody`
  (`divide-border/70`).
- **Row height is declared, not discovered:** `density` = `compact` 48px (one line),
  `comfortable` 68px (two stacked lines), `rich` 80px (lines plus pills/buttons/thumbs).
  Cells truncate; a third line never appears. Two-line cells are `StackedCell`.
- **Fixed column widths** via `columns={["w-56", "", "w-36", …]}` (one `""` takes the
  rest) and a `minWidth` so phones scroll inside the card, never the page.
- **Size every column to its content, never bigger.** A column is as wide as its longest
  realistic value plus cell padding, and no wider — a name column spanning half the table while
  dates and statuses truncate beside it is the failure. Rules:
  - **Short, fixed-shape values never truncate:** dates, times, money, counts, refs, status pills
    and the actions column get a width that fits their longest value (`"Sep 17, 2026"` in mono,
    the longest status label, `w-14` for a ⋯ menu). Measure the longest one; don't guess.
  - **The flexible `""` column is the one whose content is genuinely long and variable** (a
    description, an address, a summary) — not the primary name column by default. Names get a
    fixed width sized to a realistic long name (`w-56`–`w-64`) and truncate beyond it.
  - **If no column is genuinely long, don't leave spare width to one column:** let the table
    end at its content (`w-auto` on the table, or a trailing empty `""` column) rather than
    stretching a name across the card.
  - Check at the card's widest real width (desktop, sidebar open *and* collapsed): nothing
    short is cut off, and no column holds more than ~2× its content's width in empty space.
- **Fixed page length:** `usePaged(rows, 10)`, render `paged.rows`, then
  `<PadRows count={paged.pad} columns={n} />` so a short page is still ten rows tall (padding
  rows are `aria-hidden`). The **`TablePager` footer always renders** — even on one page —
  `h-[52px]`, "1–10 of 42 leads" on the left, `Pagination` on the right. The card is the
  same height on every page with every dataset.
- **Filters in the header toolbar:** search field, `FilterChip`s, `ClearFilters` while any
  is set; bulk actions appear in a `FilterBand` only while rows are selected.
- Numbers, refs, money and dates in `font-mono tabular-nums` (`mono`), right-aligned when
  they're amounts.
- **Status is a `StatusPill`** (leading dot; `dot={false}` for labels that name a thing, not
  a state). Tones map to meaning once per project and don't change per screen.
- **Empty is explained:** `EmptyState` with the screen's icon, a title, one line, and the
  next action when there is an obvious one. "Nothing yet." is not an empty state.
- **Inline edits for the one field people change constantly** (stock, a rate): reads as plain
  text/badge until clicked, then swaps in a small input; Enter saves, Escape cancels.
- **Optimistic toggles** (`useOptimistic`) for reversible one-click changes, rolled back on
  error.

## 6. Row actions

- **The last column is actions, and actions are icons.** A single `⋯` (`MoreHorizontal`)
  ghost icon button opens a **`DropdownMenu`** (`@ja3dan/dropdown`). Not a row of text
  buttons, not "Edit" links.
- **Every menu item has an icon:** Edit `Pencil`, Duplicate `Copy`, Publish/Hide
  `Eye`/`EyeOff`, Download `Download`, Delete `Trash2`. Labels are verb + noun ("Edit
  product", "Delete permanently").
- **Destructive items go last, `destructive`, with `separated`** (hairline above).
- The trigger's accessible name names the row: `label="Actions for Rosette dress"`.
- The menu is portalled and `fixed`-positioned so `overflow-hidden` cards don't clip it,
  flips upward near the viewport bottom, and end-aligns in the last column. One travelling
  highlight, spring motion, `prefers-reduced-motion` respected.
- **Reordering** is a mode ("Arrange"), not permanent arrows: while on, the action column
  becomes up/down `size="icon-sm"` ghost buttons (and drag handles); off, it's the menu again.
- Clicks inside the action and inline-edit cells `stopPropagation()` when rows are clickable.
- **Picking a value** (not firing an action) uses `Dropdown` — the listbox shape of the same
  component, with a tick on the selection.

## 7. CRUD happens in modals

- **Create and edit open a `Dialog`** (`@ja3dan/dialog`) over the list — not a separate
  page. The list stays behind it; saving closes it and the row updates in place.
- **Modal anatomy:** `DialogContent className="p-5"`. Header row: a `size-9 rounded-full
  bg-muted` icon, then `DialogTitle` (`text-base font-semibold`) — the item's name when
  editing, "Add a …" when creating — and a one-line `DialogDescription` (`text-xs
  text-muted-foreground`). Form `space-y-3.5`; labels `text-xs font-medium
  text-muted-foreground`; inputs `h-9` with `mt-1`; hints `text-[11px]
  text-muted-foreground` under the field; related fields two-up `sm:grid-cols-2`. Footer:
  secondary action left (delete when editing), Cancel + primary right.
- **Sizes:** `default` (`sm:max-w-lg`) for forms, `lg` (`sm:max-w-3xl`) for richer editors,
  `full` (`h-[calc(100dvh-2rem)]`, max `88rem`) for workspaces that scroll themselves
  (media, multi-step wizards).
- **Overlay** `bg-black/25` with `backdrop-blur-xs`; open/close is a 100ms fade + `zoom-95`.
  Nothing slower.
- **Key the form on the item** (`key={item?.id ?? "new"}`) so reopening on another row never
  shows the last one's values. **Close once per result:** track the handled action state in a
  ref; a lingering `success` must not close the next opening, and a lingering error must not
  greet it.
- **Warn in the field, not after:** a field whose change costs something (a code that
  retires links, a status that sends an email) says so under itself as the value changes.
- **Unsaved drafts ask before closing** — an `AlertDialog` "Discard this draft?" with "Keep
  editing" / "Discard changes", and discarding cleans up anything already uploaded.
- **Destructive confirmation is an `AlertDialog`** (`@ja3dan/alert-dialog`): media tile
  (`bg-destructive/10 text-destructive`, `Trash2`), "Delete {name}?", one sentence of
  consequence that names the reversible alternative ("Hiding is the safer option"), Cancel +
  `variant="destructive"` action with a pending label. Never `window.confirm`.
- Multi-step creation (a product with media and variants) is a wizard inside a `full`
  dialog, not a long page.

## 8. Buttons report on their own work

- **`LoadingButton`** (`@ja3dan/loading-button`) for any action that takes a round trip:
  idle / pending / success / error are all rendered in one grid cell and crossfaded, so the
  button **never changes width** mid-click and never shifts its neighbours. Success and
  failure show on the control that caused them — where the eye already is — not in a toast.
- Plain `Button` with a pending label is acceptable only where width can't change (fixed
  width, icon button).
- No toast library by default.

## 9. Figures: stat strips, panels, bar lists

`@ja3dan/stats` (`StatStrip`, `Stat`, `Delta`, `Panel`, `PanelHeader`, `BarList`, `toBars`).

- **A figure with nothing beside it is trivia.** Every `Stat` has a `delta` against an
  earlier period or a `hint` saying what it's a share of / made of / how old. If it has
  neither, question the screen.
- **`StatStrip` is one instrument panel, not a row of boxes:** one `rounded-surface
  shadow-border` container, tiles separated by collapsed hairlines (each tile's own top/left
  border pulled back a pixel), `columns` 3–6. A short last row just ends — no empty boxed cell.
- **`Stat` anatomy, fixed heights:** label row `h-4` (`text-[10px] font-semibold uppercase
  tracking-[.13em]`) with the delta right-aligned; value `mt-1 font-heading text-3xl
  leading-none tabular-nums`; hint `mt-1 h-4 truncate text-[11px]`. Heights are fixed so
  tiles with and without a delta or a long hint are identical. `href` makes the tile the way
  to the thing it counts. `accent` for the one figure the screen is about; `tone="attention"`
  for a figure that means someone has to act.
- **`Delta` carries direction three ways** — arrow, number and colour — so it survives
  colour blindness. `goodWhenDown` for costs and bounce rates; `null` reads "no earlier
  data"; under 0.5% reads "flat".
- **Dashboards answer two questions:** what needs me today (one queue, ordered by the cost of
  ignoring it) and how did the period go (this window against the previous equal window).
  All-time counters are not news.
- **`Panel`** = `rounded-surface shadow-border` + `PanelHeader` (same heading treatment as
  `TableCardHeader`) + body `pb-4`. Panels paired in a grid row pass `scroll` (fixed
  `h-[19rem]` body that scrolls) so the row stays level; `flush` when rows reach the edges.
- **`BarList`** for ranked data: the bar is a pill *behind the label* (starts where reading
  starts), count right-aligned in a fixed column, optional true `percent` kept separate from
  bar length (the longest bar is not "100%").
- **A metric strip above a chart is the chart's selector** — clicking a tile switches the
  series; one raised surface slides to the selected tile.
- Several readings of one list (top / landing / exit pages) are a **`TabbedPanel`**, not
  stacked panels; tab content is pre-rendered on the server so switching is instant.

## 10. Choosing between values

- **`Segmented`** (`@ja3dan/segmented`) — a `radiogroup` for one value from a small set (a
  mode, a range, list/board). The selection is one element that slides.
- **`Tabs` / `TabRow`** (`@ja3dan/tabs`) — for switching panels. The active tab is a plateau
  of the panel surface pushed through the row's bottom border, so tab and content read as one
  piece of paper; the row sits directly on the panel's top edge.
- **`FilterChip`** — narrowing a list. **`Dropdown`** — picking a value in a form or toolbar.

## 11. Motion

- Shared vocabulary in `@ja3dan/motion`: `CELL` for a thumb or highlight moving between
  slots, `ROLL` for content arriving from the direction of travel, `STILL` under reduced
  motion. Tune one, tune all.
- Short and physical: springs for things that travel, 100ms fades for things that appear.
  Nothing waits on an animation to become usable.
- Hover-triggered icon animations belong to the whole row, not the 16px glyph.

## 12. Writing on app screens

- Summaries say what the screen answers. Empty states say what's true and what to do next.
- Button and menu labels are verb + noun. Destructive copy names the consequence and the
  reversible alternative.
- Errors are human sentences on the control or field that failed; server details go to logs.

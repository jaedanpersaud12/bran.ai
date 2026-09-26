# Log — 02 Catalog & stock editing

- **2026-09-26** — Feature opened on `feat/02-catalog-stock`, branched from
  `feat/01-restock-engine` (PR #1, not yet merged) because it builds on 01's tables. Rebase
  onto `main` once #1 merges. Plan confirmed under the developer's standing instruction to
  keep moving ("push it and open the PR, then start 02").
- **2026-09-26** — Registry check: `table-card`, `empty-state`, `status-pill` published and
  installed; `table-pager`, `dialog`, `alert-dialog`, `dropdown`, `loading-button`,
  `skeleton` return 404, so they're built to the app-ui spec locally (see plan).
- **2026-09-26** — Found in the browser: the inline stock input opened with the caret after
  the old value, so typing "60" over 6 saved **660**. The input now selects its contents on
  focus. Recorded in `ui-registry.md` as the rule for inline editors.
- **2026-09-26** — Found in the browser: field names included their error text (the label
  wrapped the message), and the "Show archived" switch had no accessible name. Labels now
  use `htmlFor`; hints and errors are `aria-describedby`.
- **2026-09-26** — Search/filter changes now reset to page 1; clearing a search had left the
  table on page 2.

## Evidence

- **Paged `TableCard`** — 13 variants: page 1 shows 10, page 2 shows 3 plus 7 `aria-hidden`
  padding rows, pager "11–13 of 13 variants · 2 / 2"; a two-row search shows "1–2 of 2".
  The card measured 896.6px in all three. *(browser)*
- **Search and "Show archived"** — "bandeau" left the two Maracas rows; "zzz" showed the
  "Nothing matches" empty state with Clear search. With an archived variant, it was hidden
  until the switch was on, then shown with an "Archived" pill. *(browser)*
- **Add product** — empty submit flagged five fields with their own messages and made no
  request; a duplicate SKU (`flv-tri-blk-s`) came back as "Another variant in this workspace
  already uses that SKU." under the SKU field, and SQL showed no orphan product (the
  product and variant insert is one statement); with a new SKU the dialog closed and
  "Mayaro halter top · Coral · M · FLV-HLT-CRL-M · 14 · TT$72.50 · TT$250" appeared without
  a reload. *(browser + SQL)*
- **Row menu and edit modals** — the `⋯` menu lists Edit variant, Edit product, Add variant,
  Archive/Restore variant, each with an icon. Edit variant opened pre-filled with the row's
  exact values (label, SKU, cost 74, price 260, on hand 19, min 5); changing price to 265.50
  saved and the row showed TT$265.50 in place. Edit product and Add variant were exercised
  through the actions directly: lead time 18 → 25 and a new "Coral · L" variant landed.
  *(browser + harness + SQL)*
- **Inline stock** — Wrap skirt 6 → 60: the figure changed at once; `/inventory` then showed
  it as Hold with 47 days of cover (was Reorder). *(browser)*
- **Archive keeps history** — archiving Tobago Black · M (139 sales, 2 PO lines) removed it
  from `/inventory` (12 tracked) and the default catalog view; SQL showed the sales and PO
  lines intact; Restore (tested on the rash guard via the menu) brought it back. *(browser +
  SQL)*
- **Money in TT$, stored as cents; bad input refused** — parser tests plus the browser:
  "72.50" → 7250, "TT$250" → 25000; negatives, words, three decimals refused per field; a
  stock count of −4 refused by the action. *(test + browser + harness)*
- **Workspace scoping** — through a temporary dev-only route (deleted after) with a
  throwaway second workspace: `updateProduct`, `createVariant`, `updateVariant`, `setStock`,
  `setArchived` on its ids, and a non-UUID id, all returned "That item isn't in this
  workspace."; SQL showed the foreign rows unchanged and no `HIJACK` SKU anywhere.
  Throwaway workspace deleted, demo reseeded. *(harness + SQL)*
- **Tests** — `pnpm test`: 17 pass (7 new for the parser). *(test)*
- **`loading.tsx`** — observed during navigation; skeleton card 896.5px vs real 896.6px
  after matching the column band to 39px. *(browser)*
- **`pnpm check`** — 0 errors; the 4 warnings are pre-existing. *(script)*
- **Restock scores a new product** — inferred, not looked at row by row: with Mayaro added
  (13 variants) and the rash guard archived, `/inventory` read "of 12 tracked", which only
  adds up if Mayaro was scored. *(browser, indirect)*
- **Escape cancels** — not verified in the browser, because only Enter was driven. The
  Escape handler sets `editing` false without calling the action; blur does the same.

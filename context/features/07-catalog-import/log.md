# Log — 07 Catalog import

## Decisions
- 2026-09-26 — Plan confirmed by the developer. Vision spike to use a printed test sheet
  rather than real supplier photos.
- 2026-09-26 — **Vision ships.** Spike: a printed test sheet (an "Island Thread Co." price
  list rendered in headless Chrome: 4 lines expanding to 9 variants, one line with no code
  and no MOQ, retail only in a footnote), shot flat (PNG) and as a simulated phone photo
  (perspective, −4° tilt, sepia, blur, JPEG q70, 70 KB). `deepseek-v4-flash-vision-exp`
  through `extractCatalog`: 3 image runs, all 9 variants with correct costs, MOQs, the one
  null SKU, price 380 only on the dresses, onHand null, currency TTD and the supplier email.
  2.7–3.2s, ~1k input / ~550 output tokens. The text model on the same sheet as text: the
  same. Only drift: "Cream" vs "Cream · One size". Caveat: a rendered sheet, not a real
  camera photo — no glare, creases or handwriting. The spike script was deleted (it
  imported a provider outside `model.ts`).
- 2026-09-26 — **Supplier codes are per product, not per variant.** The sheet's `IT-LS01`
  covers S, M and L, and the model repeats it on each. Treating that as a duplicate would
  block every such row, so `toDraftRows` suffixes a repeated code with the variant
  (`IT-LS01-S`) and marks it suggested.
- 2026-09-26 — `runAI` and `logRun` take the model id, so vision runs log
  `deepseek-v4-flash-vision-exp`, not the text model.
- 2026-09-26 — **The model gets the workspace's product names.** First live text run: "maracas
  bandeau flame L" came back as product "maracas bandeau flame", a new product rather than a
  variant of *Maracas bandeau*. The prompt now lists existing products with up to three
  variant labels each (≤200 products), and the instructions say to reuse the exact name and
  the variant style. Rerun: both rows "Adds to Maracas bandeau" as `Flame · L` / `Flame · S`.
- 2026-09-26 — **Lead time is read too** (`leadTimeDays`, nullable): "2 weeks turnaround" →
  14, which pre-fills the import's lead time. Not in the plan; it's the same idea as the
  supplier email.
- 2026-09-26 — **A shared supplier code takes the part of the label that differs.** "Hibiscus
  red · One size" / "Sea blue · One size" first became `IT-DR07-ONE-SIZE` / `-2`; now
  `IT-DR07-HIBISCUS-RED` / `IT-DR07-SEA-BLUE`.
- 2026-09-26 — **A server refusal counts against "ready".** After the server refused a row,
  the footer still said "5 of 5 ready" with Import enabled; it now subtracts rows the server
  refused until they're edited.
- 2026-09-26 — **Photo button hides instead of disabling** once a photo is attached:
  `input-group` has `has-disabled:opacity-50`, so one disabled button faded the whole box.
- 2026-09-26 — Known miss: in the browser photo run the footnote's retail price (TT$380) was
  left blank; the spike runs had read it. Blank, not wrong — the owner fills it in.

## Evidence

Browser runs on the dev server (:3001, the `flvs-swim` demo workspace via
`DEMO_WORKSPACE_SLUG`), live DeepSeek calls. SQL through a throwaway Neon script.

- **Import button + modal from `prompt-input` and `attachments`** — browser: "Import"
  sits beside "Add product"; the modal has the textarea, a Photo button, and the attached
  photo shows as an `attachments` chip. Loaded with `next/dynamic` on first click.
- **Text → `deepseek-v4-flash` structured output via the one module** — `extractCatalog` in
  `src/lib/catalog-extract.ts` (`Output.object`), called through `runAI` with `model()` from
  `src/lib/ai/model.ts`. A WhatsApp-style message returned 6 draft rows with product,
  variant, SKU, cost, min order and on-hand.
- **Editable draft table with keep toggles** — browser: every cell is an input; unticking
  row 2 greyed it and "Import 6" became "Import 5".
- **02's parsers per row, errors on the field, import blocked** — browser: blank prices
  showed "Enter a price in TT$, like 240 or 239.99." under each cell, "0 of 6 ticked rows are
  ready", and Import was disabled; filling them made it 5 of 5. Unit tests cover it too.
- **Existing product joined, not duplicated** — browser: "Adds to Maracas bandeau". SQL after
  import: `Maracas bandeau` is still one product row, with `Flame · L` added and its own
  lead time (21) and supplier email kept.
- **Duplicate SKUs flagged** — browser: `FLV-BND-RED-S` showed "Your catalog already has
  this SKU."; unit tests cover in-draft repeats and archived SKUs.
- **Nothing written before Import** — SQL: 6 products / 12 variants before, and still 6 / 12
  after two text drafts; 8 / 17 before and after the photo draft.
- **One transaction, none written on failure, error names the row** — (a) browser: a clashing
  `RKR-BLU-8` inserted behind the dialog's back; Import returned "Reef kids rashguard, Blue ·
  8: Your catalog already has this SKU. Nothing was imported." and the counts didn't move.
  (b) SQL: `importCatalog`'s statement run with a new product and a variant reusing
  `FLV-BND-RED-S` failed 23505, and the product insert rolled back (8 / 17 / 0 "Atomic test"
  before and after).
- **Imported rows appear without reload and are scored** — browser: the dialog closed and the
  table read "18 active variants" without navigation; `/inventory` read "of 18 tracked"
  (`loadInventory`'s scored lines). SQL: 2 new products (Reef kids rashguard, Sunset sarong,
  lead time 14, kezia@coastalsupply.tt) and 5 new variants.
- **Workspace from the session, writes scoped** — code: both actions call
  `currentWorkspace()`; the insert puts `workspace_id = ${ws}` on every row, and an existing
  product id only resolves through `p.workspace_id = ${ws}` (another workspace's id resolves
  to null and fails the not-null `product_id`, so the whole statement rolls back).
- **`ai_runs` logged** — SQL: `catalog-import` rows with tokens and time, e.g. text 865 in /
  435 out / 1702 ms; photo logged under `deepseek-v4-flash-vision-exp`, 1270 / 644 / 2675 ms.
- **Photo import** — browser: `price-list.png` attached through the real file input,
  downsized and sent; 9 rows with correct costs, MOQs, SKUs split per variant and the supplier
  email. Plus the spike above.
- **No key / signed out** — signed out: production build on :3003, `/inventory/catalog`
  shows "Sign in to see your catalog" and no Import button (dev falls back to the demo
  workspace by design). No key: not verified in a browser, because production needs a real
  sign-in to reach the catalog and I can't sign in as the owner. By code: the page passes
  `aiConfigured` (false without the key) and the dialog renders "Import reads documents with
  AI, which isn't set up for this workspace…" instead of the input; `extractCatalogDraft`
  refuses before any call.
- **Tests, `pnpm check`, `pnpm test`** — 50 tests pass (13 in `catalog-import.test.ts`, 5 in
  `catalog-extract.test.ts`); `pnpm check` 0 errors (one warning, already in
  `prompt-input.tsx`); `pnpm build` passes.

Test data left in the demo workspace: the 5 imported variants (Maracas bandeau Flame · L;
Reef kids rashguard Blue · 4/6/8; Sunset sarong). The race-test row was deleted.

## Review fixes (2026-09-26)

The developer picked Important 1–3 and Minor 1 and 3 from `review.md`. The other minors
stay open, listed in the PR.

- **I1 — joining rows no longer checked against supplier fields.** `importCatalog` parses
  only the product name per row, and parses the supplier fields only when there's a new
  product; the dialog shows `supplierErrors` from the server (and reveals the fields) if it
  ever returns any. Browser: a message adding `Flame · XS` to Maracas bandeau with
  "orders@coastalsupply" pre-filled into the hidden supplier state (read off the React fiber)
  imported, 17 → 18 variants, and SQL shows the existing product's email unchanged
  (`orders@portofspainsewing.tt`). This also exercised the all-joining path (empty
  `newNames`) that review Minor 9 flagged as untested.
- **I2 — the photo always fits the Server Action body.** `MAX_IMAGE_CHARS` is 900k (Next's
  default action limit is 1 MB); `downsize()` steps 1600px q0.85 → q0.7 → 1280px q0.7 →
  1024px q0.65 until the data URL is ≤850k, and refuses with "too detailed — crop it or
  paste the text" if nothing fits. Browser: a 4000×3000 random-noise JPEG (9.9 MB) measured
  1503k / 1012k / 678k / 389k characters at the four steps — the old code would have sent
  1503k and failed; the new one sent the 678k step and the vision call succeeded
  (`ai_runs`: ok, "No products found").
- **I3 — supplier fields start clean every import.** `close()` resets them, and a new draft
  sets them from that document alone (email or "", lead time or 21). Browser: the next draft
  after the coastalsupply one had `supplierEmail: ""`.
- **M1 — Back keeps what was sent.** The text goes back through `PromptInputProvider`'s
  `initialInput`, the photo through `attachments.add` once on mount. Browser: after Back the
  textarea held the full message and, in the photo run, `transparent-list.png` was back as
  a chip.
- **M3 — transparent PNGs are drawn over white.** Browser: a PNG with a fully transparent
  background (corner alpha 0) and dark text read correctly — 5 rows, costs 96.00 / 72.50,
  MOQs 8 / 12.
- `pnpm check` 0 errors, `pnpm test` 50 pass after the fixes.

Test data now in the demo workspace: the 5 variants from the first import plus Maracas
bandeau `Flame · XS`.

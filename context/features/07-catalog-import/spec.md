# 07 Catalog import (text and photo)

## What
On `/inventory/catalog`, "Import" opens a dialog where the owner pastes a supplier price
list, an invoice or a WhatsApp message, or drops a photo of one. DeepSeek drafts products
and variants from it; the owner corrects them in an editable table and imports the rows
they keep. Nothing is written to the catalogue before that click.

## Why
The blueprint's "snap a photo and let it draft the listing". Typing a catalogue in one
variant at a time through 02's modals is the slowest step between signing up and restock
having anything to score — and the source material (price lists, invoices, supplier chats)
already exists as text or a photo.

## Done when
- [x] The catalog header has an "Import" button that opens a modal built from AI Elements `prompt-input` and `attachments`; it accepts pasted text and, if vision ships, one image
- [x] Submitting text calls DeepSeek (`deepseek-v4-flash`) with structured output (`Output.object`) through the one AI module, and returns draft rows: product name, variant name, SKU, cost, price, lead time, minimum order, on-hand
- [x] Draft rows show in an editable table inside the modal; each row has a keep/discard toggle and every field can be edited before import
- [x] Each draft row is validated with 02's `parseProduct` / `parseVariant`; an invalid row shows the message against its field and cannot be imported until fixed
- [x] A draft whose product name matches an existing product (case-insensitive) is added as a variant of it, not a duplicate product; the table says so on that row
- [x] A draft SKU that already exists in the workspace, or repeats within the draft, is flagged and blocks import of that row
- [x] Nothing is written to `bran.products` / `bran.variants` until "Import N" is clicked (checked by SQL row counts before and after a draft)
- [x] "Import N" writes the kept rows in one transaction; if any row fails, none are written and the error names the row
- [x] Imported rows appear in the catalog table without a manual reload and are scored on `/inventory`
- [x] The import action resolves the workspace from the session and scopes every write by `workspace_id`
- [x] Each extraction is logged to `bran.ai_runs` with `feature = 'catalog-import'`, tokens and duration
- [x] Photo import: a clear photo of a printed price list produces a draft via the vision model — or, if the model proves unreliable, the dialog is text-only and says photo import isn't available yet (decision recorded in `log.md`)
- [x] Without `DEEPSEEK_API_KEY` or signed out, the dialog says so instead of offering an input
- [x] The draft-to-input mapping has tests, and `pnpm check` and `pnpm test` pass

App-ui criteria: CRUD happens in a modal (the import dialog); the draft table is inside
that modal, so the page-level fixed-height/pager rules don't apply to it. No new route, so
no new `loading.tsx`.

## Out of scope
- Storing uploaded photos in R2 (the image is sent to the model and discarded)
- Importing the FLVS storefront's catalogue
- Updating existing variants from an import (costs, prices, stock) — import only adds
- Spreadsheet (.csv/.xlsx) file parsing; paste the cells as text instead
- More than one image per import

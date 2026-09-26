# Review — 07 Catalog import (text and photo)

_Reviewed 2026-09-26 against spec.md and plan.md, by a subagent that saw only the spec,
plan, log, diff and rules._

## Layer 1 — Spec alignment
**ISSUES**
- [x] "Import button, modal from `prompt-input` + `attachments`, text and one image" — met. `CatalogTable.tsx` adds the button with `next/dynamic`; `CatalogImport.tsx` uses `PromptInputProvider`/`PromptInput` with `maxFiles={1}` and an `Attachments` chip.
- [x] "Text → DeepSeek `Output.object` through the one AI module, draft rows" — met. `catalog-extract.ts` → `runAI` with `model()`; no other file imports the provider.
- [x] "Editable draft table with keep/discard" — met.
- [x] "Rows validated with `parseProduct`/`parseVariant`, error on the field, blocks import" — met (`checkDraft`, `disabled={!ready}`); the supplier-field path has a hole (Important 1).
- [x] "Existing product name match → variant, table says so" — met; re-resolved on the server.
- [x] "Duplicate SKU (workspace or in-draft) flagged and blocks" — met, archived included, tested.
- [x] "Nothing written before Import" — met; `extractCatalogDraft` only reads and logs.
- [x] "One transaction, none written on failure, error names the row" — met for SKU/field errors (single CTE, like `createDraftOrder`); a supplier-email refusal names neither a row nor a field (Important 1).
- [x] "Rows appear without reload and are scored" — met (`revalidatePath` on both paths).
- [x] "Workspace from session, writes scoped" — met; existing product ids are server-derived and re-checked with `p.workspace_id = ${ws}`.
- [x] "`ai_runs` logged" — met; vision runs log `visionModelId`.
- [x] "Photo import or text-only with a note" — met; the vision decision is in `log.md`, which is honest that the test was a rendered sheet, not a camera photo.
- [~] "Without key or signed out, the dialog says so" — signed out verified; no-key verified by code only, weaker evidence than the tick suggests.
- [x] "Tests; `pnpm check`/`pnpm test` pass" — 13 + 5 tests cover the mapping.

Scope: `leadTimeDays` extraction was unplanned, but it's logged and small. The extractor sits
at `src/lib/catalog-extract.ts`, not `src/lib/ai/`, which matches `restock-explain.ts`. The
plan's 900 KB image ceiling became 1.2M characters (Important 2).

## Layer 2 — System integrity
**PASS**

Only `model.ts` imports the provider. The pure modules are import-free and take the model
as an argument. Actions live in `src/actions`, and server modules stay `server-only`.
Every query names `bran.`, nothing touches `public`, and nothing is stored in R2. The UI
uses tokens only. AI output is marked in place with `AiMark`. CRUD happens in a modal, and
the spec waives the page-table rules.

## Layer 3 — Production readiness
**ISSUES**

The SQL resolution logic holds: new-product names are deduplicated by `normaliseName`, the
exact inserted string is used for the join, joining rows carry server-derived ids, and a
foreign id fails `not null` and rolls the statement back. The problems are in supplier
handling, request size and client state.

## Outcome

Fixed on 2026-09-26: Important 1, 2, 3 and Minor 1, 3 (evidence in `log.md` → "Review fixes").
Minor 2 and 4–10 are open and listed in the PR.

## Findings

### Critical — breaks something, or will
None.

### Important — should be fixed before merge
1. **When every kept row joins an existing product, an invalid supplier email blocks import, and the UI never shows why.**
   - `checkDraft` suppresses supplier errors when every row joins, and the dialog hides the supplier fields.
   - The server still runs `parseProduct({ name, ...supplier })` for every row (`src/actions/catalog-import.ts:171`). That returns "Check the supplier's lead time and email", about fields the owner can't see.
   - The client also ignores `result.supplierErrors`.
   - Trigger: the model pre-fills a malformed email from a message that only adds sizes to existing products.
2. **The image ceiling is above the Server Action body limit.**
   - `MAX_IMAGE_CHARS = 1_200_000` (`src/actions/catalog-import.ts:40`), but the default action body limit is 1 MB and `next.config.ts` doesn't raise it.
   - A dense 1600px JPEG at q0.85, base64-encoded, plus a note can exceed 1 MB. Next then rejects the request before the action runs, the client shows "Couldn't reach bran", and a retry fails the same way.
   - `downsize()` never checks the size of its output.
3. **Supplier fields carry over between imports.**
   - `supplier` state lives in the still-mounted `CatalogImport`, and `close()` resets only the draft.
   - `onDraft` keeps the old values when a new document has none.
   - Supplier B's new products can inherit supplier A's email and lead time, which means wrong restock timing and POs sent to the wrong address.

### Minor — worth knowing
1. Back discards the pasted text and attached photo (`Source` remounts with a fresh provider).
2. Closing the dialog mid-extraction doesn't cancel it, so the next open can show a stale review table.
3. Transparent PNGs turn black: `downsize()` exports JPEG without filling the canvas white first.
4. Supplier codes aren't sanitised. A code like "IT LS/01" is copied as-is and fails the SKU format; `slug()` would fix it.
5. A suggested SKU can collide with a later row's real supplier code; seed `taken` with every supplied code first.
6. `isDraftRow` accepts duplicate `key`s from a crafted request. It's hardening only, since the rows still stay in the workspace.
7. A product whose variants are all archived is still matched ("Adds to X"), but the model's product list hides it.
8. Cell error notes aren't linked with `aria-describedby`. `SupplierField` does this correctly.
9. The all-joining import path (empty `newNames`) wasn't exercised; it's also the path Important 1 lives on.
10. The `.claude/launch.json` entry `bran-prod-noai` is outside the feature, and its intended no-key check never happened.

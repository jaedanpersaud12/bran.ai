# Log — 06 Ask bran

- **2026-09-26** — Opened on `feat/06-ask-bran`, stacked on 05, under "keep building".
- **2026-09-26** — **Bundle regression found and fixed.** With the chat in the sidebar,
  every page loaded 17.4 MB of dev JS (KaTeX, mermaid, parse5, `ai`, zod) and pages stopped
  hydrating in the background browser pane. Chat moved to `AssistantChat.tsx` behind
  `next/dynamic`; streamdown's plugins removed → 6.3 MB, none of those libraries on page
  load, hydration immediate.
- **2026-09-26** — Agent tuning from live runs: it asked "shall I?" in text before calling
  write tools (the approval card already is the confirmation) — instructions now say to call
  them straight away; catalogue search matched literally, so "Flame S" missed "Flame · S"
  and it searched three times — now word-by-word, punctuation ignored (one search).
- **2026-09-26** — `ai_runs` showed six identical `restock-explain` runs within two seconds
  (concurrent page loads each scheduling one). `explainMissing` now shares one in-flight run
  per workspace per server instance.
- **2026-09-26** — Draft PO-0002 (1 line) and PO-0003 (5 lines) appeared at 21:58–21:59 with
  `created_by` null, before any approval flow ran — from the developer's own use of the
  signed-out UI, not the agent. Left in place.
- **2026-09-26** — Departure from the build-plan line: no conversation persistence yet
  (see plan).

## Evidence

- **AI Elements + agent** — the sheet renders `Conversation`, `Message`/`MessageResponse`,
  `PromptInput`, `Tool`, `Confirmation`, `Suggestion`; `/api/assistant` streams a
  `ToolLoopAgent` on `deepseek-v4-flash`. *(browser, code)*
- **Answers from the database** — curl and the sheet: "What should I reorder?" called
  `getRestock` (shown as a collapsed "Read restock" tool) and answered 5 lines, 294 units,
  TT$22,082, TT$26,260 at risk, per-line 59/76/51/61/47 — identical to `/inventory`.
  *(curl + browser)*
- **Draft with approval** — the confirmation read "Draft a purchase order: Tobago triangle
  top, Black · M × 59; … 294 units, TT$22,082 at cost. Nothing is sent to the supplier."
  No PO existed for it before approving; "Draft it" created PO-0004 whose five lines match
  restock's suggestions exactly, with a link to it in the card. *(browser + SQL)*
- **Set stock, denied** — "…7 on the shelf. Set it to 7." → one catalogue search, then
  "Set Maracas bandeau, Flame · S on hand from 19 to 7."; "Don't" → "Not approved. Nothing
  was changed.", the agent asked what to do instead, and `on_hand` stayed 19. *(browser +
  SQL)*
- **Signed approvals** — approval requests carry a `signature`. A hand-built approved
  `setStock` (to 0) → stream error, `on_hand` unchanged. Control: a genuine signed request
  replayed with input 7→0 was rejected; replayed as issued, it executed (19→7; restored to
  19). *(script + SQL)*
- **Workspace binding** — the route reads only `messages` from the body; tools close over
  `currentWorkspace()`; approval functions deny variants outside the workspace before
  asking. *(code read)* — not exercised with a second workspace in this feature; the
  underlying `createDraftOrder` / `setVariantStock` scoping was tested in 01, 02 and 05.
- **Logged runs** — `bran.ai_runs` holds 9 `assistant` rows, all ok, 21,689 in / 1,108 out
  tokens in total. *(SQL)*
- **Signed out / AI off** — production build (`next start` :3002), signed out: POST
  `/api/assistant` → 401 "Sign in to use the assistant."; the sheet says "Sign in with your
  FLVS account…", has no input, and never loads the chat chunk. *(curl + browser)* The
  no-key message is the same code branch (`assistantState`); not exercised live, because
  unsetting the developer's key would change their running server.
- **Suggestions from restock** — the empty state offered "Draft an order for the 5 lines
  restock flagged" and "How long will the tobago triangle top in black · m last?", from the
  live verdicts. *(browser)*
- **Checks** — `pnpm check`: 0 errors, 1 warning (vendored `prompt-input.tsx`); `pnpm test`:
  32 pass; `pnpm build` succeeds. *(script)*

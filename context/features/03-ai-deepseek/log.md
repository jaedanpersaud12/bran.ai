# Log — 03 AI layer on DeepSeek

- **2026-09-26** — Opened on `feat/03-ai-deepseek`, stacked on `feat/02-catalog-stock`
  (PR #2, itself on #1). Plan confirmed under the developer's standing instruction ("push
  it and open the PR, then start 03").
- **2026-09-26** — No `DEEPSEEK_API_KEY` in `.env.local`. Built so the key is optional; the
  live-call criterion stays open until one is added.
- **2026-09-26** — Installed `ai@7.0.116`, `@ai-sdk/deepseek`, `zod`. Read the bundled docs:
  `deepseek-chat` is retired; current ids are `deepseek-v4-flash` / `deepseek-v4-pro`.
- **2026-09-26** — Added `DEEPSEEK_BASE_URL` so the wiring can be tested against a local
  stand-in of DeepSeek's chat endpoint (a scratch script, not committed). It found that
  the provider appends the JSON schema to the messages; recorded in `library-docs.md`.

## Evidence

- **One provider import** — `grep -rn "@ai-sdk/deepseek" src` finds only
  `src/lib/ai/model.ts`; the id is `DEFAULT_MODEL`, overridable by `AI_MODEL`. *(code)*
- **No key → formula only, silently** — with `DEEPSEEK_API_KEY` unset: `/inventory` rendered
  12 rows, every reason the formula's, no model markers, no console or server errors, and
  `bran.ai_runs` / `bran.restock_explanations` both had 0 rows. *(browser + SQL)*
- **`runAI` logs, times out, never throws** — the first stand-in run crashed mid-request;
  bran logged one row `ok=false`, "AI_RetryError: Failed after 2 attempts … Cannot connect
  to API", 2,042 ms, cached nothing, and the page rendered normally. The successful run
  logged `ok=true`, 900 in / 210 out tokens. *(SQL + browser)*
- **Mock-model tests** — `pnpm test`: 24 pass. Valid output used and keyed by id; unknown
  id, blank, 300-character and duplicate entries dropped line by line; a number the model
  wasn't given ("11 people asked", "40 days") refused; provider errors propagate to
  `runAI`; fingerprint stable under rounding and changed by stock, suggestion or trend.
  *(test)*
- **Off the critical path, then cached** — with the stand-in: load 1 showed formula text
  (0 markers) and the call ran in `after()`; load 2 showed the model's text on all 12
  lines, same verdicts and quantities (59, 76, 51, 61); the stand-in saw 1 request for
  those two loads. *(browser + stand-in log)*
- **Fingerprint invalidates one line** — set Flame · S on hand 19 → 7 in SQL: the next load
  showed 11 markers, Flame · S back on the formula ("Order 26"); the load after, it was
  explained again. The stand-in saw 2 requests in total. Whether that second request
  carried only the one stale line was not inspected; the loader only collects stale lines.
  *(browser + SQL + stand-in log)*
- **Model text is marked** — a `Sparkles` glyph after the sentence with sr-only "Explained
  by the model" and a title saying the verdict and quantity are the formula's. *(browser)*
- **Live DeepSeek call** — not verified, because there is no `DEEPSEEK_API_KEY` yet. Add
  one to `.env.local`, load `/inventory` twice, and check `bran.ai_runs` for an `ok` row.
- **Clean-up** — stand-in stopped, temporary env lines removed, stand-in explanations and
  test runs deleted, Flame · S restored to 19. *(SQL)*

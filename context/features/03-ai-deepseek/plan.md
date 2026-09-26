# Plan — 03 AI layer on DeepSeek

## What we're building
`src/lib/ai/model.ts` (provider + model id), `src/lib/ai/run.ts` (`runAI`: timeout,
catch, log to `bran.ai_runs`), `src/lib/restock-explain.ts` (fingerprint, prompt, output
validation, the call — pure enough to test with `MockLanguageModelV4`), a cache table, and
the inventory loader reading the cache and scheduling misses with `after()`.

## Decisions
- **AI SDK v7 + `@ai-sdk/deepseek`, direct to DeepSeek**, not via AI Gateway. The developer
  chose DeepSeek; a direct key is one secret with no Vercel dependency. Swapping to the
  gateway or another provider is a change to `model.ts` only.
- **Model `deepseek-v4-flash`, thinking disabled.** Explanations are one or two sentences
  from given numbers; reasoning tokens would cost more and add latency for nothing. The
  provider docs note `deepseek-chat` was retired on 2026-07-24.
- **Structured output (`Output.object` + zod)**: `{ lines: [{ id, reason }] }`, one batched
  call per workspace for all uncached lines (capped at 40), rather than one call per line.
- **The model never decides.** It receives each line's verdict, quantity and numbers, and is
  told to explain them. Its text replaces only the sentence; verdict, quantity and totals
  come from the formula. Output is validated per line: unknown id, empty, or over 240
  characters → that line keeps the formula sentence.
- **Cache keyed by fingerprint**: verdict, suggestion, on hand, on order, lead time and pace
  (to one decimal). Any change to what the sentence would describe misses the cache; nothing
  else does. Stored per `(workspace_id, variant_id)`, upserted.
- **Off the critical path**: the page renders from the cache plus formula sentences; misses
  are explained in `after()`, so the next load has them. No spinner, no blocking.
- **Every call is logged** to `bran.ai_runs` (no prompt or response bodies — just feature,
  model, tokens, duration, outcome), so cost per workspace is a query from day one.
- **15-second timeout**; a failed or timed-out call is logged and changes nothing visible.

## Assumptions
- DeepSeek's JSON-mode structured output works through the AI SDK provider as documented.
  Not verifiable here without a key.
- A few dozen lines per workspace, so one batched call covers them.

## How to build it
1. Schema: `bran.ai_runs`, `bran.restock_explanations`.
2. `model.ts`, `run.ts`.
3. `restock-explain.ts` + tests with the mock model.
4. Loader reads the cache; page schedules misses in `after()`; planner marks model text.
5. Verify without a key (fallback), with the mock (tests), and live if a key is provided.

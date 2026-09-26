# 03 AI layer on DeepSeek

## What
One module through which every AI call in bran goes, on DeepSeek, with timeouts, logging
and a guaranteed fallback. Its first use: restock's "why" for each line is written by the
model from the formula's own numbers, cached per line until those numbers change, and never
on the page's critical path.

## Why
DeepSeek is the provider for every AI feature (decided 2026-09-26). Building the plumbing
once — config, failure handling, cost logging, testability — before the chatbot and caption
writer means those features only add prompts. Restock's reasons are the smallest real use:
the blueprint wants plain-language explanations "so owners trust the call".

## Done when
- [x] `src/lib/ai/model.ts` is the only file that imports a provider package; the model id comes from one constant (overridable by `AI_MODEL`)
- [x] With `DEEPSEEK_API_KEY` unset, the app runs and every restock reason is the formula's own sentence; nothing errors or logs a failure
- [x] Every AI call goes through `runAI`, which times out, never throws, and writes a `bran.ai_runs` row (feature, model, workspace, tokens, duration, ok/error)
- [x] The explanation step is tested against a mock model: valid output is used; output that names an unknown line, is empty or overlong is discarded line by line, falling back to the formula sentence
- [x] `/inventory` renders without waiting on the model: uncached lines show the formula reason and are explained after the response (`after()`), and the next load shows the model's text
- [x] Explanations are cached in `bran.restock_explanations` keyed by a fingerprint of the line's numbers; changing a line's stock invalidates only that line
- [x] Model-written reasons are visibly marked as such in the planner
- [x] A live DeepSeek call returns explanations for the demo workspace (needs a key)
- [x] `pnpm check` and `pnpm test` pass

## Out of scope
- The chatbot, captions, or any other AI surface (07, 08)
- Streaming or a chat UI
- Per-tier AI quotas or billing (09)
- Letting the model change a verdict or a quantity — it explains, it never decides

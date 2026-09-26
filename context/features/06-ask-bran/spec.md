# 06 Ask bran (the real assistant)

## What
The Assistant sheet becomes a working agent over the workspace's own data. Ask it about
stock and it answers from the database, showing the lookups it made; ask it to draft an
order or change a count and it proposes the action, which runs only when you approve it.
The sample threads from 04 are retired.

## Why
The AI review's top recommendation: the assistant is the largest AI surface in the app and
it was entirely scripted. Everything it needs to be real — restock, catalogue, purchase
orders, stock edits — was built in 01, 02 and 05.

## Done when
- [x] The sheet uses AI Elements (`conversation`, `message`, `prompt-input`, `tool`, `confirmation`, `suggestion`) and streams from a route handler running an AI SDK `ToolLoopAgent` on DeepSeek
- [x] "What should I reorder?" is answered from the database: the tool calls it made are visible (collapsed by default) and its numbers match `/inventory`
- [x] Asking it to draft that order shows a confirmation naming the lines, units and cost; approving creates a PO that appears in `/inventory/purchase-orders`; denying writes nothing
- [x] Asking it to set a stock count shows a confirmation; approving changes `on_hand`; denying doesn't
- [x] Approvals are HMAC-signed (`experimental_toolApprovalSecret`); a forged approval in a crafted request is rejected and writes nothing
- [x] Every tool is bound to the session's workspace on the server; a request can't name another workspace
- [x] Each agent run is logged to `bran.ai_runs` (`feature = 'assistant'`) with tokens and duration
- [x] Without `DEEPSEEK_API_KEY` or signed out, the sheet says so instead of offering an input
- [x] Starter suggestions come from the workspace's current restock state, not fixed text
- [x] `pnpm check` and `pnpm test` pass

## Out of scope
- Saving conversations across reloads (the thread lives in the sheet for the session)
- Customer-facing DMs (11), orders (08)
- Attachments in the assistant — 07 brings them, for catalogue import

# Plan — 06 Ask bran

## Decisions
- **`ToolLoopAgent` built per request** (`src/lib/ai/assistant.ts` → `makeAssistant(ctx)`),
  so every tool closes over the session's workspace id. The route handler
  (`src/app/api/assistant/route.ts`) resolves `currentWorkspace()` itself and never reads
  a workspace from the body. `stopWhen: isStepCount(8)`.
- **Tools** wrap code that already exists: `getRestock` (loadInventory), `findVariants`
  (loadCatalog), `listPurchaseOrders` (loadPurchaseOrders), `draftPurchaseOrder` (the 01
  insert, factored out of the action) and `setStock` (the 02 update, factored out). The last
  two are `toolApproval: 'user-approval'`.
- **Approvals are signed** with `experimental_toolApprovalSecret`: `TOOL_APPROVAL_SECRET`
  when set, otherwise derived from `BETTER_AUTH_SECRET` (HMAC with a fixed label), so it
  works without a new secret but is never a constant. The docs' trust-model section is why:
  with `useChat` the history is client input.
- **Tool outputs are compact and numeric** (ids, names, counts, cents) so the model quotes
  bran's numbers; the instructions tell it to use only tool results and never retry a denied
  action.
- **No persistence in v1.** `useChat` holds the thread for the session. A thread table is a
  small follow-up once the shape of useful conversations is known — a departure from the
  build-plan line, recorded here.
- **AI Elements** installed with its CLI into `src/components/ai-elements/`, restyled onto
  bran's tokens where the lint rule requires. It replaces `ThinkingState`, `ToolChips`,
  `StreamingText` and `TaskRows` in the sheet; those primitives are deleted if nothing else
  uses them.
- **Logging:** the agent's `onFinish` writes one `bran.ai_runs` row via a `logRun` helper
  exported from `run.ts` (streaming can't go through `runAI`'s wrapper).

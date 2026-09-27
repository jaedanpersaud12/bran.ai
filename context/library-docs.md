# Library Docs

Project-specific usage patterns for every third-party library this project actually uses.
This file only covers how *this project* uses each library — rules, patterns, and
constraints specific to it, not general documentation.

Read the relevant section before implementing any feature that touches these libraries.
Ships empty on purpose — a pattern gets added here the first time this project actually
uses the library, verified against what's installed, never written ahead of time from
memory. Writing an API example before it's needed manufactures exactly the stale
documentation this file exists to prevent.

---

## Before Using Any Library

Before implementing any feature that uses a third-party library:

1. **Check `AGENTS.md`** at the project root — it lists every skill installed for this
   project and how to use them. Skills contain up-to-date API documentation, usage
   patterns, and best practices specific to this codebase.

2. **Check if an MCP server is configured** for that library. Some tools have MCP servers
   that give the AI agent direct access to documentation, logs, and debugging tools. If one
   is available — use it before falling back to general knowledge.

3. **Read this file** for project-specific patterns that override general library
   knowledge.

The order of authority is:

```
MCP server (real-time docs) → Skills via AGENTS.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for a library's API — it changes frequently
and training data may be outdated.

---

## AI SDK (`ai` 7.x) + `@ai-sdk/deepseek`

Verified against the bundled docs in `node_modules/ai/docs` and
`node_modules/@ai-sdk/deepseek/docs` on 2026-09-26.

- **Only `src/lib/ai/model.ts` imports a provider.** Everything else calls `model()` and
  spreads `callOptions`. Switching provider or going through AI Gateway is that file only.
- **Every call goes through `runAI`** (`src/lib/ai/run.ts`): it returns `null` instead of
  throwing, applies a 15s `AbortSignal.timeout`, and logs a `bran.ai_runs` row. Callers
  must have a fallback — AI is always an enhancement on something that already works.
- **v7 names:** the system prompt is `instructions`, not `system`. Structured output is
  `generateText({ output: Output.object({ schema }) })` and the result is `result.output`.
  Token counts are `result.usage.inputTokens` / `outputTokens`.
- **DeepSeek model ids:** `deepseek-chat` / `deepseek-reasoner` were retired 2026-07-24.
  Use `deepseek-v4-flash` (default) or `deepseek-v4-pro`. Thinking is on by default for V4;
  bran turns it off (`providerOptions.deepseek.thinking.type = "disabled"`) for short
  grounded text.
- **The DeepSeek provider appends the JSON schema to the messages** in structured-output
  mode — a stand-in server that parses the prompt must look for its own markers, not the
  first `[`.
- **Images:** `deepseek-v4-flash` is text-only. Images go to `deepseek-v4-flash-vision-exp`
  (experimental) as a `{ type: "file", mediaType, data: Uint8Array }` part; `visionModel()`
  in `model.ts` returns it (`AI_VISION_MODEL` overrides). Tested in 07 on a printed price
  list (flat and a simulated phone photo): every value right across three runs, ~2.8s,
  ~1k tokens in. Structured output works on it, in the same schema-in-the-system-message
  compatibility mode (an AI SDK warning says so). Thinking-off `providerOptions` are accepted.
  A footnote detail (a retail price below the table) was read in some runs and not others.
- **`runAI` options:** `timeoutMs` (default 15s; import uses 60s) and `model` (the id to log
  when the call didn't use the default model — the vision calls pass `visionModelId`).
- **Agents (06):** `new ToolLoopAgent({ model, instructions, tools, toolApproval,
  experimental_toolApprovalSecret, stopWhen: isStepCount(n), onEnd })`, built **per
  request** so tools close over the session's workspace. In v7 approval is the agent's
  `toolApproval` map (`'user-approval'`, or a function returning `{ type, reason }`), not a
  per-tool `needsApproval`. A function's `reason` reaches the UI as
  `part.approval.requestReason` — bran puts a server-computed summary there.
- **Always set `experimental_toolApprovalSecret`.** With `useChat` the history is client
  input; without the secret a crafted request can approve itself. Verified: a replayed
  approval with its input changed is rejected; the genuine one executes.
- **Route:** `createAgentUIStreamResponse({ agent, uiMessages, abortSignal })`. Client:
  `useChat<InferAgentUIMessage<…>>({ transport: new DefaultChatTransport({ api }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses })` and
  `addToolApprovalResponse({ id, approved })`. Narrow parts with `isStaticToolUIPart` /
  `getToolName`.
- **Streaming can't go through `runAI`**; log from the agent's `onEnd` with
  `event.totalUsage` via `logRun`.

## AI Elements (elements.ai-sdk.dev)

Installed 2026-09-26 for 06: `conversation`, `message`, `prompt-input`, `tool`,
`confirmation`, `suggestion` in `src/components/ai-elements/`.

- **Install:** `yes n | npx ai-elements@latest add <names>` — it asks to overwrite
  existing shadcn files (`button`, `dialog`, …); answering "n" keeps ours. It also adds
  shadcn pieces it depends on (`alert`, `collapsible`, `command`, `hover-card`,
  `input-group`, `button-group`, `spinner`).
- **Bring it onto tokens after installing.** `tool.tsx` shipped raw palette colours
  (`text-green-600` …) → `text-success` / `text-info` / `text-warning` /
  `text-destructive`; `code-block.tsx` shipped shiki dark-theme overrides (bran is
  light-only) and a ref read during render (moved to state).
- **Never import AI Elements into something every page renders.** `message.tsx`'s
  `streamdown` ships maths (KaTeX), diagrams (mermaid), CJK and shiki plugins; with the
  Assistant in the sidebar the dev bundle went from ~6 MB to 17.4 MB and pages stopped
  hydrating in a background tab. bran strips the plugins (`streamdownPlugins = {}`) and
  loads the chat with `next/dynamic` when the sheet opens.
- **`attachments`** (added in 07): installed clean onto tokens except one
  `dark:hover:` class (removed; bran is light-only) and two `<img>` lint warnings (blob/data
  URLs; annotated). Inside `PromptInput`, list the files with `usePromptInputAttachments()`
  and render `Attachments`/`Attachment` in a `PromptInputHeader`.
- **`prompt-input` quirks:** without `PromptInputProvider` it `form.reset()`s the textarea
  *before* awaiting `onSubmit`, so a failed submit loses what was typed; wrap it in the
  provider and throw from `onSubmit` to keep the input. Enter submits (Shift+Enter is a
  newline). The input group has `has-disabled:opacity-50`, so disabling any one control in
  it fades the whole box — hide a control rather than disabling it. Files arrive in
  `onSubmit` as data URLs. `PromptInputProvider` takes `initialInput` (text only); to put a
  file back, call `usePromptInputAttachments().add([file])` once on mount.

## Next.js Server Actions

- **Body limit is 1 MB by default** (`serverActions.bodySizeLimit`, not raised here). Over
  it, the request is rejected before the action runs and the client's call just throws —
  the action's own size checks never see it. Anything sending an image through an action
  has to size it in the browser first (07 steps a canvas JPEG down until the data URL is
  ≤850k characters).
- **An env var that's set, even to an empty string, beats `.env.local`** (`@next/env` only
  fills keys that are undefined). `env DEEPSEEK_API_KEY= pnpm exec next start` gives a
  production server with AI off — the `bran-prod-noai` launch config.
- **Testing:** pure modules take `model: LanguageModel` as an argument; tests pass
  `new MockLanguageModelV4({ doGenerate })` from `ai/test` and run under `node --test`.
- **Model output is never trusted to decide.** It explains numbers the app computed;
  validate per item (known id, length, and — for restock — only numbers it was given) and
  fall back item by item.

## UI primitives added in 08

- **`@ja3dan/filter-chip` is built on Base UI (`@base-ui/react` `Menu`),** not Radix. Its
  install adds `@base-ui/react` beside `radix-ui`. It works fine next to Radix dialogs and
  menus. Its items are `role="menuitemradio"`; clear the filter with the chip's own
  `aria-label="Clear {label} filter"` button.
- **`alert-dialog` comes from shadcn (`@ja3dan/alert-dialog` 404s).** It shipped a raw
  `bg-black/10` overlay; bran uses `bg-foreground/10`, the same as `dialog.tsx`.
  `AlertDialogAction` takes `variant="destructive"`. Its radii are shadcn's
  (`rounded-xl`), the same drift as `dialog.tsx`.
- **Radix `Select` inside a scrolling `Dialog`:** the list positions its selected (or
  first) item over the trigger. With nothing selected, the item under the pointer after
  opening isn't the one at the trigger's position — pick options by their own box, not by
  offset from the trigger.

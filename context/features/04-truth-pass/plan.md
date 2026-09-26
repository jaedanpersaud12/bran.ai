# Plan — 04 Truth pass

## What we're building
No new capability: an honesty pass over existing surfaces, per the AI review's findings.

## Decisions
- **Delete what nothing renders** (`PromptBar`, `ChatComposer`, and the `glimm` and
  `@scritto/react` packages only they used). AI Elements' `prompt-input` replaces the input
  in 06; keeping a 700-line fake composer around invites putting it back.
- **Primitives take their content as required props.** `ThinkingState` takes a `trace`;
  `ToolChips`, `StreamingText`, `TaskRows`, `RecommendationCard` lose their default data. A
  trace or tool list is a claim about what ran, so it must come from the caller.
- **The Assistant stays as a labelled preview** rather than being removed: it shows what 06
  and 11 will do, but the Restock sample thread goes (it contradicted the real restock data
  on the same screen), follow-up buttons go, and the input is replaced by a sentence.
- **"Sample data" is a `PageHeader` prop**, one line with a pill, naming what's placeholder
  and what's live. The dashboard gets the same line by hand (it doesn't use `PageHeader`).
- **`AiMark`** is one component for the sparkle, so the planner and the card mark model
  text identically.

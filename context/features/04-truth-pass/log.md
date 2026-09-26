# Log — 04 Truth pass

- **2026-09-26** — Opened on `feat/04-truth-pass` from `chore/plan-ai-review` under the
  developer's "keep building". Spec and plan written after the build, during wrap-up — the
  scope came straight from the AI review in `build-plan.md`.
- **2026-09-26** — Found during the pass, beyond the review's list: `ToolChips` rendered a
  hard-coded "+2 more" and a default header "4 tool calls, 2 messages"; `ThinkingState`'s
  "Reasoning" sample included a waffle-bowl line; the Restock sample thread quoted "11
  people asking" and "four lines" against the real screen's 5. All removed.

## Evidence

- **Leftover grep** — the sweep over `src/` for the leftover terms, "the model's call",
  "Model said", "Ask AI", "AI Insight" and the invented counts returns nothing (the only
  hit left was a demo `Instagram` integration line on a screen now labelled sample).
  *(script)*
- **Formula wording + AI mark** — `/inventory`: panels "Restock's call" / "Plan the
  reorder", card title "Draft this reorder?", no "the model" / "Model said" in the page
  text, 13 AI marks (12 rows + the card's sentence). *(browser)*
- **Assistant** — trigger reads "Sample"; the sheet has a "Sample" pill, says the threads
  are written examples, shows no stats, has DM and Dispatch threads only, no web search,
  no follow-ups, and a closing sentence instead of an input. *(browser, screenshot)*
- **Dashboard** — "Restock · Live": "5 of 12 lines need reordering, with TT$26,260 of sales
  at risk…", matching `/inventory`; "Open restock" links there; "Ask AI" and "AI Insights"
  absent; the sample-data line sits under the greeting. *(browser)*
- **Sample labels** — `/orders` screenshot shows the note; storefronts, content calendar,
  campaigns, billing, team, integrations and analytics all return 200 with "Sample data";
  `/inventory/catalog` (real) does not. *(browser)*
- **Checks** — `pnpm check`: 0 errors, 4 pre-existing warnings; `pnpm test`: 24 pass.
  *(script)*

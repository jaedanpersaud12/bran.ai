# 04 Truth pass

## What
Every AI-shaped surface in the app is either real, labelled as a sample, or gone; every
screen still on demo data says so; the restock formula is never called "the model".

## Why
The AI review (2026-09-26) found the app presenting far more AI than it had — invented
assistant stats, a hardcoded "AI Insight", a dead "Ask AI", an ice-cream demo's web-search
results and data sources, and the formula labelled as a model. For a product whose pitch
is "trust the call", that is the biggest risk in the app. See `ui-rules.md` → "How AI is
presented".

## Done when
- [x] A grep for the template leftovers (Joy Cone, Konery, Webstaurant, Scoop, flavor, pistachio, vanilla, waffle, Cone King, Figma, Slack, Gmail, churn) over `src/` finds nothing
- [x] No surface calls the restock formula "the model"; model-written text carries the AI mark wherever it appears (planner rows and the recommendation card)
- [x] The Assistant shows no invented metrics, is labelled "Sample" on its trigger and in the sheet, explains what it is, and has no input that goes nowhere
- [x] The dashboard's insight is computed from restock and matches `/inventory`; "Ask AI" is gone; the placeholder figures are labelled as sample
- [x] Every screen that reads `src/lib/demo.ts` shows a "Sample data" note under its title saying what's placeholder; real screens don't
- [x] Demo primitives carry no built-in sample content — callers pass what they show
- [x] `pnpm check` and `pnpm test` pass

## Out of scope
- Making the assistant real (06), purchase-order screens (05)
- Replacing the hand-rolled primitives with AI Elements (06 does it where they become real)

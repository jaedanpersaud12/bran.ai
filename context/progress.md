# Progress

**Stage:** 05 — Purchase orders & supplier email
**Last completed:** 04 — truth pass on `feat/04-truth-pass` (stacked on the plan branch → #3)
**Active feature:** none
**Next:** 05 purchase orders, then 06 Ask bran
**Blocker:** none

Keep this short. Detail belongs in the feature's own folder — `spec.md`, `plan.md`,
`log.md`, `review.md`. This file is the status block and the checklist, nothing else.

## Checklist

- [x] **01** Restock engine
- [x] **02** Catalog & stock editing
- [x] **03** AI layer on DeepSeek
- [x] **04** Truth pass (honest AI surfaces)
- [ ] **05** Purchase orders & supplier email
- [ ] **06** Ask bran (the real assistant)
- [ ] **07** Catalog import (text and photo)
- [ ] **08** Orders
- [ ] **09** Courier adapter
- [ ] **10** Demand signals
- [ ] **11** Instagram DMs + chatbot
- [ ] **12** Content pool + scheduler
- [ ] **13** Billing & tiers
- [ ] **14** Onboarding & multi-tenant

## Notes

- DeepSeek is the model provider for all AI (decided 2026-09-26), behind one module.
- The app is pre-MVP: until 01, every screen read `src/lib/demo.ts`.
- 2026-09-26 AI review: features 04–07 were inserted before Orders (old 04–10 are now
  08–14). Rationale in `build-plan.md` → "AI does work, not decoration".
- PRs #1 → #2 → #3 are stacked; merge in order.
- Action for the client, not code: start Meta app review now (blocks 11 only).

<!-- Anything that doesn't fit the status block above but matters across sessions:
     a rebase warning on an open branch, a decision that affects more than one
     feature, a known gap. Keep entries short; move detail to the feature it's about. -->

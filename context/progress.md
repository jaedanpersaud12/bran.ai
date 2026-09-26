# Progress

**Stage:** 03 — AI layer on DeepSeek (built; live call pending a key)
**Last completed:** 02 — built and verified on `feat/02-catalog-stock` (stacked on 01, PR #1 open)
**Active feature:** 03 (`feat/03-ai-deepseek`, stacked on 02)
**Next:** 04
**Blocker:** 03's live-call check needs `DEEPSEEK_API_KEY` in `.env.local`

Keep this short. Detail belongs in the feature's own folder — `spec.md`, `plan.md`,
`log.md`, `review.md`. This file is the status block and the checklist, nothing else.

## Checklist

- [x] **01** Restock engine
- [x] **02** Catalog & stock editing
- [ ] **03** AI layer on DeepSeek
- [ ] **04** Orders
- [ ] **05** Courier adapter
- [ ] **06** Demand signals
- [ ] **07** Instagram DMs + chatbot
- [ ] **08** Content pool + scheduler
- [ ] **09** Billing & tiers
- [ ] **10** Onboarding & multi-tenant

## Notes

- DeepSeek is the model provider for all AI (decided 2026-09-26), behind one module.
- The app is pre-MVP: until 01, every screen read `src/lib/demo.ts`.

<!-- Anything that doesn't fit the status block above but matters across sessions:
     a rebase warning on an open branch, a decision that affects more than one
     feature, a known gap. Keep entries short; move detail to the feature it's about. -->

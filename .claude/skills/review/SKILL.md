---
name: review
description: Verify a finished feature against its spec and the project's rules, with fresh eyes. Runs the cheap automated checks first, then reviews in a subagent that sees only the spec, plan, diff and rules, and writes review.md. Use before /feature finish.
---

Building is not done when the code runs. It's done when the code is correct.

This skill reports; it does not fix. What to fix is the developer's call, and fixing
something before it's understood is how a problem gets buried rather than solved.

## Fresh eyes, and why it's a subagent

The session that wrote the code is the worst possible reviewer of it. Every assumption
that produced the bug is still in context, still looking reasonable. Asking that session
"is this right?" reliably gets "yes".

So the review runs in a **subagent** with a deliberately narrow view: `spec.md`, `plan.md`,
the diff, and the rules. Not the conversation that produced the code. If the spec and the
diff disagree, a reviewer who never heard the reasoning will notice.

Launch it with the Agent tool, `subagent_type: "Explore"` or a project reviewer agent if
one exists. Give it the file paths and the diff command — not a summary of what was built.
A summary written by the builder carries the builder's assumptions, which is the thing
being controlled for.

---

## Step 1 — Run the cheap checks first

Free, and they catch what a human reviewer shouldn't spend attention on:

```bash
bun run check          # or the project's equivalent
```

plus typecheck and build if they aren't in it. Fix what these find before the review runs
— a reviewer wading through type errors won't get to the interesting problems.

## Step 2 — Establish the benchmark

`spec.md`'s "done when" criteria, and `plan.md`'s decisions and assumptions. Without them
there's nothing to review against; ask the developer to describe what the feature was
meant to do and write it down before going further.

## Step 3 — Review in three layers

**Layer 1 — Does it match the spec?** Every "done when" criterion: met, and shown to be
met? Anything planned but missing, or built but never planned? Scope creep is a finding.

**Layer 2 — Does it respect the system?** This is where drift happens; the feature works
but breaks a rule the project depends on.

- Architecture boundaries — the right code in the right place
- Design system — contract tokens only, no raw colours, no hardcoded values
- App screens — every rule in the `app-ui` skill: shell and page header, `loading.tsx` per
  dynamic route, fixed-height paged tables, icon row-action menus, CRUD in modals,
  destructive confirms in an alert dialog, stat strips with a delta or hint. A departure
  without a reason in `plan.md` is a finding. Give the subagent the skill's path
- Project invariants — the ones in root and folder-scoped `AGENTS.md`, individually
- Existing patterns — a new pattern introduced where one already existed

**Layer 3 — Is it production ready?** Error handling, empty and loading states, console
errors, and anything that would obviously break for a real user. On app screens: does the
route show a skeleton on navigation, does anything change size or position when data or
state changes (rows, buttons, tiles, pages), and does every destructive action confirm?

## Step 4 — Write review.md

Into the feature folder. Honest, unsoftened, ranked.

```markdown
# Review — NN Feature Name

_Reviewed [date] against spec.md and plan.md._

## Layer 1 — Spec alignment
**PASS** / **ISSUES**
- [ ] "[criterion]" — [met, with the evidence / not met, because…]

## Layer 2 — System integrity
**PASS** / **ISSUES**

## Layer 3 — Production readiness
**PASS** / **ISSUES**

## Findings

### Critical — breaks something, or will
1. **[What]** — `file.ts:12`. [Why it's wrong and what it causes.]

### Important — should be fixed before merge

### Minor — worth knowing
```

Severity means: **Critical**, it breaks for a real user or violates an invariant.
**Important**, it will cost someone time later. **Minor**, worth knowing, fine to ship.

## Step 5 — Hand it back

Say what you found in two or three lines and let the developer triage. Don't start fixing.
If they ask you to fix, fix what they picked and re-run only the affected checks.

An empty review is a real result. Say so plainly rather than manufacturing findings to
look thorough — a reviewer that always finds three things gets read as noise, and then
stops being read.

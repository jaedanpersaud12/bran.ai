---
name: feature
description: Open and close the loop around a piece of work. `start` creates the branch, the feature folder and the spec; `finish` refuses to close while any "done when" criterion lacks evidence, then opens the PR. Use at the beginning and end of every feature.
---

A feature is a folder, a branch and a set of criteria that have to be shown to be met.
This skill opens and closes that. Everything between the two halves — `/architect`, the
build, `/review` — happens inside what `start` created.

Two commands: `/feature start NN` and `/feature finish`.

## Why a folder

Work used to leave its traces in three places: a plan in chat, decisions in a growing
tracker, evidence nowhere. The tracker reached 450 lines and stopped being read.

One folder per feature fixes the location problem. The tracker goes back to being a status
block and a checklist, because the detail has somewhere better to live.

```
context/features/NN-slug/
  spec.md      what it is, and the "done when" criteria    (start)
  plan.md      how it gets built                           (/architect)
  log.md       decisions and evidence, as they happen      (during)
  review.md    what the reviewer found                     (/review)
  handoff.md   where to pick up next session               (/remember save)
```

---

## `/feature start NN`

**1. Find the feature.** Look up `NN` in `context/build-plan.md`. If it isn't there, ask
whether to add it — work that isn't in the build plan is either scope creep or a plan that
needs updating, and both deserve a sentence of thought.

**2. Check the tree is clean.** `git status`. Uncommitted work belongs to the previous
feature; starting a new branch on top of it tangles two features into one diff. Stop and
say so rather than stashing on the developer's behalf.

**3. Branch.** `git checkout -b feat/NN-slug` from the default branch, updated first.

**4. Make the folder** and write `spec.md`:

```markdown
# NN Feature Name

## What
[Two or three sentences. What exists when this is done that doesn't now.]

## Why
[The reason it's worth building. If this is hard to write, question the feature.]

## Done when
- [ ] [A criterion someone else could check without asking you]
- [ ] [Another]

## Out of scope
- [What someone might reasonably expect and won't get]
```

Seed it from the build plan's line for `NN`, then work through the criteria with the
developer. **Write criteria that can be checked by someone else.** "Filtering works" can't
be. "Selecting a status narrows the table and the count updates" can.

**App screens get the `app-ui` criteria.** If the feature builds a signed-in screen, the
spec's "done when" includes, in checkable form: the route has a `loading.tsx` skeleton that
matches the page's layout; tables are fixed-height (declared density, fixed columns, ten
rows padded, pager always shown); row actions are an icon menu; create/edit happen in a
modal and deletes confirm in an alert dialog; no element changes size when its state or
data changes. Drop any that don't apply to this screen, and say which.

**5. Mark it in progress** in `context/progress.md` and stop. Say which file to look at
and suggest `/architect`.

---

## `/feature finish`

Refuse to close on anything unfinished. The point of this half is that it's harder to skip
than remembering would be.

**1. Every criterion needs evidence.** Read `spec.md`'s "done when" list and find, for
each one, a line in `log.md` saying how it was checked — browser, SQL, script, test — or
an explicit `not verified, because …`.

A blank criterion stops the close. Say which ones are blank and what would settle them.
`not verified, because the staging data doesn't have a failed payment yet` is a perfectly
good answer and closes the criterion; silence doesn't.

**2. Run the checks.** `bun run check`, plus the project's typecheck and build. These are
cheap and they run before anything expensive.

**3. Fix doc drift.** If the change touched things the docs describe, update them now:
component changes → the registry item's docs and `meta.version`; token changes →
regenerate; new commands or invariants → `AGENTS.md`.

**4. Harvest.** Anything learned the hard way — a tool that behaved differently than
documented, a version-specific trap — run `/harvest` on it. This is the step that makes
the next project cheaper than this one, and it's the step most likely to be skipped, so
ask explicitly rather than deciding it's not worth it.

**5. Update `context/progress.md`** — tick the feature, set the status block's "next".

**6. Open the PR.** The description comes from `log.md`: what was built, the decisions and
why, and the evidence for each criterion. A reviewer should not have to reconstruct the
reasoning from the diff.

Then say what's next from the build plan. Don't start it.

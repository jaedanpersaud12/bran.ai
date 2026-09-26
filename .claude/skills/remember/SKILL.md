---
name: remember
description: Save session state to the active feature's handoff.md at the end of a session, or restore it at the start of the next one. Use when a feature spans more than one session.
---

Sessions start blank. This closes the gap between them.

`/remember save` at the end, `/remember restore` at the start. Done consistently, nothing
gets lost between sessions.

## One job per store

State used to live in three overlapping places — a root `memory.md`, the tracker, and
auto-memory — which meant no one knew which was current. Each now has one job:

| Store | Holds |
| --- | --- |
| `context/features/NN-slug/handoff.md` | Where this feature is, and what's next. **This skill writes it.** |
| `context/progress.md` | Project state: which features are done, which is active. |
| Claude's auto-memory | Your personal working preferences. Nothing project-specific. |

The handoff lives with the feature because that's what it's about. When the feature
merges, the handoff merges with it and stops being anybody's problem.

## Security boundary

Never persist secrets. If a key, token, password, connection string, cookie, auth header
or webhook secret appeared in the session, it does not go in the file — not even
abbreviated, and not as "the key ending in 4f2a".

Write what you were doing with it instead: "authenticated against staging" rather than the
credential that did it.

---

## `/remember save`

**1. Find the active feature** from `context/progress.md`. If none is active, ask which
feature this belongs to — a handoff with no feature has nowhere to be read from.

**2. Write `handoff.md`.** Overwrite it; it holds the most recent state, not a history.
History belongs in `log.md`.

```markdown
# Handoff — NN Feature Name

_Saved [date]._

## Where this is
[Two or three sentences. What's working, what isn't, what's half-built.]

## Done this session
- [What actually landed, with file paths]

## Decisions made
- **[Decision]** — [what and why]

## Problems solved
- **[Problem]** — [the fix, and why it was the fix — this is the part
  that saves the next session an hour]

## Next session starts with
1. [The specific next action, concrete enough to start cold]

## Open questions
- [Anything unresolved, and what would resolve it]
```

**3. Check for drift.** If decisions were made that belong in `log.md`, or a criterion got
evidence, write those too — the handoff is for continuity, not a substitute for the record.

**4. Confirm before overwriting** an existing handoff with substantially different
content. Show what changes.

---

## `/remember restore`

**1. Read, in this order:**
- `context/progress.md` — find the active feature
- that feature's `handoff.md`, then `spec.md` and `plan.md`
- root `AGENTS.md`, and any folder-scoped one for the directories in play

**2. Check the ground truth.** `git status` and `git log --oneline -5`. The handoff says
what the last session *meant* to leave; git says what it actually left. When they disagree,
git is right — say so.

**3. Report back:**

```
Memory restored — NN Feature Name

Where it is: [two sentences]
Uncommitted: [what git shows, or "clean"]
Next: [the first action from the handoff]
Open: [anything unresolved]
```

Then wait. Don't start the next action until the developer confirms — they may have
changed their mind since, which is exactly the thing a handoff can't know.

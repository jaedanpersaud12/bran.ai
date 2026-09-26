---
name: harvest
description: Promote something learned the hard way into knowledge/, tagged project, stack or universal, so the next project doesn't pay for it twice. Use when a tool behaved differently than documented, or at /feature finish.
---

A gotcha you solve once and don't write down, you solve again in the next project. The
whole point of a shared foundation is that the second project is cheaper than the first,
and that only happens if what was learned leaves the project it was learned in.

Run this when a tool behaves differently than its documentation says, when a version-
specific trap costs real time, or as the harvest step of `/feature finish`.

## Step 1 — Is it worth a note?

Not everything is. A note earns its place when:

- **It cost real time.** Ten minutes of confusion, not ten seconds.
- **It would happen again.** To you next project, or to someone else on this stack.
- **The documentation doesn't say it**, or says something else. This is the strongest
  signal — if the docs were right and were read, there's nothing to harvest.

A note does **not** earn its place when it restates the docs, when it's a one-off caused by
local state, or when it's really a bug you should file upstream instead. Say so and stop —
a knowledge base that accumulates everything gets read as thoroughly as one that
accumulates nothing.

## Step 2 — Tag its scope

The tag decides who gets the file. Getting it wrong is how a project's quirk becomes
everyone's noise.

| Scope | Means | Goes to |
| --- | --- | --- |
| `project` | True only in this repo, because of a choice made here | The project's own docs, not `knowledge/` |
| `stack` | True for anyone on these versions of these tools | `knowledge/<topic>.md` with a `stack` array |
| `universal` | True regardless of stack | `knowledge/<topic>.md`, `scope: universal` |

Most real findings are `stack`. Be suspicious of `universal` — it usually means the
underlying cause hasn't been identified yet.

## Step 3 — Verify it against the installed tool

**Do not write an API example from memory.** The entire class of problem this fixes is
documentation that drifted from reality; adding more remembered detail makes it worse.

Check the claim against what's actually installed — run the command, read the version in
`package.json`, read the source in `node_modules` — and record the version you checked.
If you can't verify it, say so in the note rather than asserting it.

## Step 4 — Write it

Append to the matching `knowledge/<topic>.md`, or create one. Frontmatter:

```yaml
---
scope: stack
stack: [nextjs-16, tailwind-4, shadcn-4]
verified_version: shadcn 4.21.0
verified_on: 2026-09-13
---
```

Then one bullet per gotcha, in house style: **a bolded claim that states the trap**, then
the detail and the workaround. Present tense, specific, and short enough to scan.

```markdown
- **`init --base` takes `base`, not `base-ui`.** `shadcn init -d --base base`
  (values: `radix | base | aria`). Some docs and skills say `base-ui`; 4.21 rejects it.
```

The bold half has to carry the whole finding on its own — that's the line someone scanning
twenty bullets actually reads.

When adding to an existing file, update `verified_on`, and `verified_version` if you
checked against a newer one. A stale `verified_on` is what tells a future reader to
re-check before trusting the file.

## Step 5 — Say what you did

One line: which file, which scope, and whether it was verified or asserted. If the note
contradicts something already in `knowledge/`, say that too and resolve it — two bullets
giving opposite advice is worse than neither.

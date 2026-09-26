# Feature folders

One folder per numbered feature, created by `/feature start NN`. The number matches the
line in `../build-plan.md` and the branch (`feat/NN-slug`).

```
NN-slug/
  spec.md      what it is, and the "done when" criteria        (/feature start)
  plan.md      how it gets built                               (/architect)
  log.md       decisions and evidence, written as they happen  (during)
  review.md    what the reviewer found                         (/review)
  handoff.md   where to pick up next session                   (/remember save)
```

## Why these exist

The plan used to live only in chat, so `/review` could not find it and the next session
could not read it. Decisions accumulated in one tracker until it reached 450 lines and
stopped being read.

Splitting by feature fixes both. `../progress.md` goes back to a status block and a
checklist because the detail has somewhere better to live, and when the feature merges its
folder merges with it and stops being anyone's problem.

## The rule with teeth

`/feature finish` will not close a feature while any "done when" criterion lacks a line in
`log.md` saying how it was checked — browser, SQL, script, test — or an explicit
`not verified, because …`.

That second form is a perfectly good answer. Silence is not.

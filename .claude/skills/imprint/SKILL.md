---
name: imprint
description: After building a UI section, capture how registry primitives were composed — or how a custom component chose among contract tokens — and save it to ui-registry.md, so the next one matches. Use after building any UI, not just once at the end.
---

The token contract fixes which class is correct. It doesn't fix how three `@ja3dan`
components get arranged into a page header, or which of five valid token names a custom
component should use for its background. Those are real decisions, made once per project,
and nothing else records them — so the second time they get made differently, and the app
looks like it was assembled by two people with different opinions.

This skill fixes that. Run it after building any UI — a composed section, a custom
component — and it captures the part of the decision the contract didn't already make.

One command. Run it every time something new gets composed. That's the whole system.

---

## How to invoke

After building a UI section or a custom component, run:

```
/imprint
```

To target a specific file:

```
/imprint [filepath]
```

If no filepath is given, identify which files were most recently created or modified in
this session and read those. If it's unclear which to capture from, ask:

```
Which component or section should I capture patterns from?
```

---

## Step 1 — Decide what kind of thing this is

**A `@ja3dan` registry component used on its own** — nothing to capture. Its own source
already fixes every token choice; recording that `button.tsx` uses `bg-primary` would only
restate `TOKENS.md`. Skip it and say so rather than writing a no-op entry.

**A composition the `app-ui` skill already specifies** (the shell, a page header, a table
card with pager and row menu, a CRUD dialog, a stat strip) — nothing to capture unless this
project departed from it on purpose. Record the departure and its reason, not the rule.

**A composition of registry primitives** (a page header, a card grid, an empty-state
layout built from `@ja3dan/button`, `@ja3dan/empty-state`, and this project's own spacing)
— capture the arrangement. See Step 2a.

**A custom component**, not sourced from the registry — capture which contract token was
chosen for each visual role. See Step 2b.

---

## Step 2a — Extract a composition

**Capture:**

- Which registry components appear together, and in what order
- The spacing between them (gap/margin utilities, not arbitrary values — a raw value here
  is a `no-raw-colors`-adjacent smell worth flagging, not silently recording)
- Which variant/size props are used together (e.g. this project always pairs
  `size="lg"` buttons with `size="default"` inputs in a form footer)
- Layout structure genuinely specific to this composition (a fixed column count, a
  particular alignment) — not every layout choice, only ones a second, unrelated
  composition should probably match

**Do not capture:** anything already fixed by a registry component's own source, responsive
breakpoint variants (capture the base pattern only), or one-off layout math that's
genuinely specific to this one section and shouldn't constrain anything else.

---

## Step 2b — Extract a custom component's token choices

**Capture:**

- Background, border, and text token — which contract token (`bg-card`, `bg-muted`,
  `text-muted-foreground`, etc.), not a raw value; there shouldn't be one to find
- Border radius token used for this component type
- Spacing scale — padding inside, gap between internal elements
- Interactive states — hover/focus/active, as token utilities
- Shadow, if used
- Any accent or status-color usage, and which token backs it

**Do not capture:** width/height (context-dependent), flex/grid structure (that's Step 2a's
job if this component is itself a composition), positioning, or animation timing unless
it's a pattern worth enforcing project-wide.

If a raw hex value or palette class turns up during extraction, that's a bug
(`no-raw-colors` should already have caught it) — flag it, don't record it as a pattern.

---

## Step 3 — Write to `ui-registry.md`

Open `context/ui-registry.md`. Append a new entry; don't overwrite existing ones. If an
entry for this exact component or composition already exists, update it in place.

### Composition entry

```markdown
### [Composition name]

File: [filepath]
Last updated: [date]
Built from: [@ja3dan/component, @ja3dan/component, ...]

| Property        | Value                          |
| ---------------- | ------------------------------ |
| Arrangement      | [order / structure]            |
| Spacing          | [gap/margin utilities]         |
| Props used together | [variant/size combinations] |

**Pattern notes:** [why this arrangement, what a matching composition elsewhere should
reuse, what's allowed to vary]
```

### Custom component entry

```markdown
### [Component name]

File: [filepath]
Last updated: [date]

| Property           | Token                  |
| ------------------- | ---------------------- |
| Background          | [token class]          |
| Border               | [token class]          |
| Border radius        | [token class]          |
| Text — primary       | [token class]          |
| Text — secondary     | [token class]          |
| Spacing              | [token class]          |
| Hover state          | [token class]          |
| Focus state           | [token class or none] |
| Active state           | [token class or none] |
| Shadow                  | [token class or none] |
| Accent / status usage    | [token class or none] |

**Pattern notes:** [why this token was chosen over an equally valid alternative, what this
component type should always match]
```

---

## Step 4 — Confirm what was captured

```
Imprinted [name] → context/ui-registry.md

Captured:
- [the 3-5 things that actually matter, not the full table]

The next [composition/component] of this kind should match these.
```

Flag anything that looked inconsistent with an existing entry, or any raw value found:

```
Note: [what looked off, and why it's worth knowing about]
```

---

## How `ui-registry.md` gets used

At the start of any session doing UI work, read `context/ui-registry.md` before composing a
new section or building a new custom component. Building a second page header, check how
the first one was arranged. Building a second stat card, check which token it used for its
background. The registry is the precise reference the contract itself can't be — it fixes
names, not project-specific choices among them.

---

## The rule

Compose something. Build something custom. Run `/imprint`. Move on.

A registry with a handful of entries is useful. One that's sometimes updated is
unreliable — the gap between "usually accurate" and "wrong" is where the inconsistency
this skill exists to prevent creeps back in.

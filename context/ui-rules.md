# UI Rules

Concise rules for building this project's UI. These cover the patterns and constraints that
keep the UI consistent without over-specifying every detail.

_Adapted from groundwork's `next16-insforge` template. Colors are deliberately absent here:
this project's colors are contract tokens (`@ja3dan/tokens/TOKENS.md`) plus bran's own
additions below, never hex values, and `no-raw-colors` catches a hardcoded one at edit
time._

---

## Component Sourcing

Priority order for any new UI element: `ui-registry.md` (already built, if this project
maintains one) → `@ja3dan` registry (`pnpm dlx shadcn add @ja3dan/<item>`) → the shadcn/ui components already in
`src/components/ui/` → custom.

The existing `src/components/ui/` components are shadcn's Radix-based `radix-nova` style.
`@ja3dan` items are built on Base UI. Where both provide the same component, such as
`button` or `table`, keep the one already in use unless a feature swaps it on purpose.
Don't run two versions of the same primitive side by side.

---

## Font

Geist Sans and Geist Mono, from the `geist` package, set on `<html>` in
`src/app/layout.tsx` and mapped to `--font-sans` / `--font-mono` in `globals.css`. Never
fall back to a system font as the primary typeface.

---

## Layout

- Page max-width and centering, header height, and section spacing are project decisions —
  set them once here and reuse everywhere rather than re-deciding per page
- Default to a single navigation pattern for the whole app (top navbar, or a sidebar) —
  don't mix both without a stated reason

---

## App Screens

Signed-in screens — admin, dashboard, portal — follow the **`app-ui` skill**
(`.claude/skills/app-ui/SKILL.md`), not this file. It fixes the sidebar shell and sticky page
header, instant navigation with a `loading.tsx` skeleton per route, fixed-height paged
tables, icon row-action menus, CRUD in modals, destructive confirms in an alert dialog,
stat strips, panels and loading buttons. Read it before building one; `/review` checks
against it. Record a deliberate departure here, with its reason.

---

## Cards

Every content section that groups related information lives in a card, using the contract's
`card` / `card-foreground` tokens, not a hardcoded background or border color. Color goes
inside a card via badges, bars, and text — not on the card surface itself, unless a specific
section has a deliberate reason to differ (state that reason here when it comes up).

---

## Typography Hierarchy

Keep to a small number of consistent levels — section headings, body text, secondary/muted
text — using Tailwind's type scale and the contract's `foreground` / `muted-foreground`
tokens rather than one-off pixel values. Note any project-specific sizes here once they're
decided (e.g. a large stat number on a dashboard).

---

## Badges

Default to a pill shape (`rounded-full`) unless a specific badge has a stated reason to be
square-cornered (e.g. a trend indicator meant to read as a small label, not a tag).

---

## Buttons and Form Inputs

Use the `@ja3dan` button and input components as installed — they already carry the
contract's tokens for every variant and state. Don't hand-roll a button or input style that
duplicates what the registry component already does.

---

## Tables

- No alternating row colors — separate rows with a `border` token instead
- Column headers: the registry's `table.tsx` sets this; don't override it per table
- Hover state: use `bg-accent`/`bg-muted` per the contract, not a one-off color

---

## Empty States

Every section that can be empty must have an empty state. Keep it minimal: short text in a
muted token color, an optional icon, and a CTA if there's a logical next action. The
registry's `empty-state` item covers this — use it rather than a custom one per page.

---

## Theme and bran's Own Tokens

This stack uses Tailwind v4. `src/app/globals.css` imports `@ja3dan/tokens/theme.css`, which
maps every contract token to a utility, and then supplies bran's values in `:root`. bran is
light-only on purpose, so there's no `.dark` block. Never define a color in a config file.

bran adds tokens the contract doesn't have. They're allowed in the lint config
(`allowTokens` in `eslint.config.mjs`), and a new one must be added there and here first:

| Token | Role |
| --- | --- |
| `positive` / `negative` | Direction of a change, for deltas and trend arrows. Never the only signal: an arrow points the same way |
| `line` | The chart's data ink. Read raw as `var(--line)` and deliberately has no utility, because `--color-line` belongs to the beautifui foundation |
| `track` | The unfilled part of a meter |
| `step-1` … `step-3` | Parts of a whole, light to dark |
| `nav-*` | One hue per nav destination. The only saturated values in the system |
| `section` | The current section's `nav-*` hue, set by `AppShell` and mixed into the neutrals |
| `row` | A sidebar row's own `nav-*` hue, set inline by `AppSidebar` |
| `orange` | Beautiful UI's orange, from `src/app/beautifui/foundation.css`; the default `EntityChip` monogram |
| `flvs-red` | The product mark, and nothing else |

`success` / `destructive` share their values with `positive` / `negative`. Use `success`
and `destructive` for states (saved, failed) and `positive` / `negative` for direction.

---

## Do Nots

- Never use Tailwind's built-in color classes (`bg-purple-500`, `text-gray-600`) or a raw
  hex value — contract tokens only. `no-raw-colors` enforces this at edit time; treat a
  violation as a bug, not a style nitpick
- Never define colors in a Tailwind config file — use the token contract, or add a bran token as described above
- Never add gradients to card backgrounds without a stated design reason
- Never use more than one font weight in a single UI element
- Never show a raw error message to a user — always human-readable text
- Never stack more than two levels of nested border radius without a stated reason
- Never commit a component from outside the `@ja3dan` registry with its source's original
  hardcoded colors still in place — retheme to contract tokens first, same as any other raw
  color

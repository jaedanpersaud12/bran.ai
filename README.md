# bran

The flvs.bran back office: inventory, content, orders and revenue for a brand
owner, in one screen.

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm db:setup                # installs the `bran` Postgres schema
pnpm dev                     # http://localhost:3001
```

Port 3001 is deliberate — the FLVS storefront runs on 3000 and the two are
usually up together.

## It shares FLVS's backend

One Neon database, one set of Better Auth tables, one R2 bucket. That is on
purpose: a brand owner should have one FLVS account, not two. Two things keep
the products from treading on each other, and both are load bearing.

**Postgres.** Every table bran owns lives in the `bran` schema
(`db/schema.sql`), and every query names it — `bran.workspaces`, never bare
`workspaces`. Neon's HTTP driver opens a fresh connection per query, so a
`search_path` set once does not survive to the next one; qualifying is the only
thing that actually holds. `public` belongs to the storefront, apart from the
four Better Auth tables both apps sign in against.

**R2.** Every object bran writes is keyed under `R2_PREFIX` (default `bran/`).
`src/lib/r2.ts` applies it in `keyFor`, and nothing builds a key any other way,
which is what makes "everything bran wrote" a listing on one prefix rather than
an audit.

Sessions are shared by design. On localhost that works out of the box: cookies
ignore the port, so a session issued on :3000 is presented to :3001 and
validates against the same row. In production both apps need their real origin
in `BETTER_AUTH_URL`.

## What is real and what is not

Real: the reporting window, the greeting, the session, the workspace name, the
schema, the storage prefix.

Placeholder: every figure on the dashboard. Recurring revenue, the KPI row, the
revenue split, customer counts, the budget, the AI insight and the tax payment
all come from `src/lib/metrics.ts`, shaped the way the real queries will return
them. Wiring them up is a change to that file and its call site, not to the
screen. The toolbar controls — the range picker, Customize, the overflow menu —
are real buttons with no handlers yet, so the whole dashboard reads one fixed
thirty-day window.

## Layout

```
db/schema.sql              everything bran owns, idempotent
scripts/apply-schema.mjs   pnpm db:setup
src/app/(app)/             the product; the group exists so a future
                           sign-in screen can render outside the chrome
src/components/bran/       the shell, and the charts drawn by hand in SVG
src/components/ui/         shadcn primitives, shared with the storefront
src/lib/metrics.ts         the placeholder figures
```

Charts are hand-written SVG rather than a charting dependency: an area chart, a
tick ring and two meters is not enough to justify a library and the theming
adapter that comes with it.
# bran.ai

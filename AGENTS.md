# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.

# bran shares FLVS's backend

The database, the Better Auth tables and the R2 bucket are the same ones the
FLVS storefront uses. Two rules keep the products apart, and both are load
bearing:

- **Every table bran owns lives in the `bran` Postgres schema** (`db/schema.sql`).
  Every query names it: `bran.workspaces`, never bare `workspaces`. Neon's
  HTTP driver runs each query in its own connection, so a `search_path` set
  once does not survive to the next one — qualifying is the only thing that
  actually holds. Never write to `public` — that is
  the storefront's, apart from the shared auth tables Better Auth manages.
- **Every object bran writes to R2 is keyed under `R2_PREFIX`.** `src/lib/r2.ts`
  applies it; do not build keys by hand.

Reading `public` is allowed where a feature needs the storefront's data, and only there:
`src/lib/storefront-flvs.ts` selects from `public.orders` for the FLVS import (the
workspace named by `FLVS_STOREFRONT_WORKSPACE`), and order history joins `public."user"`
for names. Nothing in bran writes to `public`.

Accounts are deliberately shared: one FLVS login works in both products.

# Built on groundwork

This repo uses groundwork's agent kit and token contract (gw.jaedan.me), without
InsForge. Before working on a feature, read `context/`: `code-standards.md`,
`ui-rules.md`, `library-docs.md`, `ui-registry.md` and `progress.md`. The skills
live in `.claude/skills/`: every feature opens with `/feature start NN` and closes
with `/feature finish`, with `/architect` and `/review` in between.

Colours come from the token contract (`@ja3dan/tokens`) plus bran's own tokens,
which are listed in `context/ui-rules.md`. `@ja3dan/no-raw-colors` fails anything
else, and `pnpm check` runs types and lint together.

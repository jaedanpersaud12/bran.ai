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

Accounts are deliberately shared: one FLVS login works in both products.

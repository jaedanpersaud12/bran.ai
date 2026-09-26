# Code Standards

Implementation rules and conventions for the entire project. The AI agent must follow these
in every session without exception. These rules prevent pattern drift across sessions.

_Adapted from groundwork's `next16-insforge` template for bran's stack: Neon Postgres,
Better Auth and Cloudflare R2, all shared with the FLVS storefront. bran doesn't use
InsForge. Fill in the blanks below, such as the tracked-events table, as they're decided,
not before._

---

## Engineering Mindset

The AI agent on this project operates as a senior engineer. This means:

- **Think before implementing** — understand what is being built and why before writing a single line
- **Read context files first** — never assume, always verify against `architecture.md` and `project-overview.md`
- **Scope is sacred** — only build what the current feature requires. Never go beyond scope even if it seems helpful
- **Every feature must be testable** — if it cannot be verified immediately after implementation, it is incomplete
- **Clean over clever** — simple readable code that a junior developer can understand is always preferred over clever abstractions
- **One thing at a time** — complete one feature fully before touching the next
- **Failures are expected** — wrap agent or background operations in try/catch, log failures, never let one failure crash everything

---

## TypeScript

- Strict mode enabled in `tsconfig.json` — no exceptions
- Never use `any` — use `unknown` and narrow the type
- Never use type assertions (`as SomeType`) unless absolutely necessary and commented why
- All function parameters and return types must be explicitly typed
- Use `type` for object shapes and unions — use `interface` only for extendable component props
- All async functions must have proper error handling — never let promises float unhandled
- Use `const` by default — only use `let` when reassignment is necessary

---

## Next.js 16 Conventions

- App Router only — no Pages Router
- React 19 — use React 19 APIs throughout
- All components are Server Components by default
- Only add `"use client"` when the component requires:
  - `useState` or `useReducer`
  - `useEffect`
  - Browser APIs
  - Event listeners
  - Third-party client-only libraries
- Never add `"use client"` to layout files unless absolutely required
- Data fetching happens in Server Components — never fetch in Client Components directly
- Route handlers live in `src/app/api/` — never put business logic directly in route handlers
- Request-time protection, when it's added, lives in `src/proxy.ts`. Next.js 16 renamed
  Middleware to Proxy — never create `middleware.ts`. Proxy is an optimistic check only;
  pages still read the session themselves
- Any `try/catch` around `cookies()`, `headers()` or `searchParams` in a Server Component
  must call `unstable_rethrow(error)` from `next/navigation` before handling the error
- Server Actions live in `src/actions/` — never define Server Actions inline in components
- Caching is uncached by default — all dynamic code runs at request time
- Always check the installed Next.js version's own docs before implementing a Next.js
  feature — training-data APIs may differ from what's actually installed

---

## File and Folder Naming

- Folders: kebab-case — e.g. `job-details`
- Component files: PascalCase — e.g. `StatsBar.tsx`
- Utility files: camelCase — e.g. `session.ts`
- Type files: camelCase — e.g. `index.ts`
- API route files: always `route.ts`
- Server Action files: camelCase, one per resource — e.g. `profile.ts`
- One component per file — never export multiple components from one file
- Index files only in `src/components/ui/` — never barrel export from other folders
- `src/components/ui/` — `@ja3dan` registry / shadcn CLI-managed components only
- `src/components/bran/` — product components: the shell, and the charts drawn in SVG

**Registry components use contract tokens, not the registry's own defaults.** If any
component is installed from somewhere other than `@ja3dan` (a second registry, a
copy-pasted source), it ships with that source's own token names or hardcoded colors —
retheme it to this project's contract tokens before committing, the same way any raw color
would be caught by `no-raw-colors`. `@ja3dan` items don't need this pass; they already speak
the contract.

---

## Component Structure

Every component follows this exact order:

```typescript
"use client"; // only if needed

// 1. External imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Internal imports
import { StatsCard } from "@/components/bran/StatsCard";

// 3. Type definitions
type Props = {
  id: string;
};

// 4. Component
export function ComponentName({ id }: Props) {
  // state
  // derived values
  // handlers
  // return JSX
}
```

- Never use default exports for components — always named exports
- Props type defined directly above the component — not in a separate types file unless shared
- No inline styles — all styling via Tailwind classes using contract tokens (see
  `@ja3dan/tokens/TOKENS.md`)

---

## API Route Handlers

```typescript
// src/app/api/<resource>/route.ts

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // validate body
    // do the work
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[<resource>]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- Every route handler has a try/catch
- Every route handler validates the request body before processing
- Errors are logged with the route path as prefix: `[<resource>]`
- Always return `{ success: boolean, data?: T, error?: string }`
- Never return raw data without the success wrapper

---

## Server Actions

```typescript
// src/actions/<resource>.ts

"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function saveResource(formData: ResourceFormData) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "Not signed in" };
    // validate
    // write to DB
    revalidatePath("/<path>");
    return { success: true };
  } catch (error) {
    console.error("[actions/<resource>]", error);
    return { success: false, error: "Failed to save" };
  }
}
```

- Every Server Action has a try/catch
- Every Server Action returns `{ success: boolean, error?: string }`. It may add optional
  fields the caller needs to recover, never replace these two
- Client components calling an action wrap the call in `try/catch` — a request that never
  reaches the action (offline, server restart, body over the size limit) rejects instead of
  returning, and would otherwise reach the error boundary
- Modules that must never reach the browser start with `import "server-only"` — Next
  handles it without the npm package
- Always call `revalidatePath` after mutations that affect page data
- Never throw from Server Actions — always return the error

---

## Background / Agent Code

If this project has functions that run outside the request/response cycle a component
triggers directly — an AI agent step, a queued job, anything with its own failure mode
that shouldn't take the whole request down with it:

```typescript
// <folder>/<name>.ts

export async function doWork(
  /* params */
): Promise<{ success: boolean; error?: string }> {
  try {
    // implementation
    return { success: true };
  } catch (error) {
    await logFailure(/* ... */, error);
    return { success: false, error: String(error) };
  }
}
```

- Every such function returns `{ success: boolean, error?: string }`
- Every such function has a try/catch — never let one failure crash the run
- Failures are always logged somewhere durable before returning
- This code never imports from `components/` or `actions/`
- This code never uses React hooks or browser APIs

---

## Database, Auth and Storage

bran shares its backend with the FLVS storefront: one Neon database, one set of Better Auth
tables, one R2 bucket. Accounts are shared on purpose, so one FLVS login opens both.

```typescript
// Database — server only. Neon's HTTP driver, tagged-template queries.
import { sql, databaseConfigured } from "@/lib/db";
const rows = await sql`select id, name from bran.workspaces where id = ${id}`;

// Reading the session — always this, never auth.api.getSession() directly
import { getSessionUser } from "@/lib/session";
const user = await getSessionUser();

// Object storage — keys always go through keyFor()
import { presignUpload, publicUrlFor, deleteObject } from "@/lib/r2";
```

- **Every table bran owns lives in the `bran` schema, and every query names it:**
  `bran.workspaces`, never bare `workspaces`. Neon's HTTP driver runs each query on its own
  connection, so a `search_path` set once doesn't carry over; qualifying the name is the only
  thing that holds
- Never write to `public`. It belongs to the storefront, apart from the Better Auth tables
  (`user`, `session`, `account`, `verification`) that Better Auth manages itself
- Schema changes go in `db/schema.sql`, which stays idempotent, and are applied with
  `pnpm db:setup`
- **Every object bran writes to R2 is keyed under `R2_PREFIX`.** `src/lib/r2.ts` applies it;
  never build a key by hand
- bran doesn't own the account lifecycle: no sign-up, verification or welcome email. The
  storefront runs those
- `src/lib/auth.ts`, `src/lib/session.ts` and anything importing `sql` start with
  `import "server-only"`
- Scope every workspace query to the current user's membership
  (`bran.workspace_members`). Never return rows for a workspace the user doesn't belong to
- Degrade instead of throwing when the backend is unconfigured or unreachable. Check
  `databaseConfigured`, `authConfigured` and `r2Configured`, and render signed-out or empty
  rather than showing a stack trace

---

## Error Handling

- Never use empty catch blocks — always log or handle
- Console errors always include a context prefix: `[component/function name]`
- User-facing errors must be human readable — never expose raw error messages
- Background/agent errors go to a durable log — never surface raw internals to the UI
- API route errors return `status: 500` with a generic message — never expose internals

---

## Tracked Events

_Fill in once analytics are decided — leave this table empty rather than guessing at event
names. All events must use these exact names; never invent one without adding it here
first._

| Event | When | Key Properties |
| --- | --- | --- |
| | | |

---

## Environment Variables

All environment variables defined in `.env.local` for development. Never hardcode any key,
URL, or secret anywhere in the codebase.

| Variable | Used In |
| --- | --- |
| `DATABASE_URL` | `src/lib/db.ts`, `src/lib/auth.ts` (shared with FLVS) |
| `BETTER_AUTH_SECRET` | `src/lib/auth.ts` (shared with FLVS; rotating it signs everyone out of both) |
| `BETTER_AUTH_API_KEY` | `src/lib/auth.ts` |
| `BETTER_AUTH_URL` | `src/lib/auth.ts` (this app's real origin) |
| `NEXT_PUBLIC_APP_URL` | Fallback origin for auth |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | `src/lib/r2.ts` (shared with FLVS) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | `src/lib/r2.ts` |
| `R2_PREFIX` | `src/lib/r2.ts` (default `bran/`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Email (shared with FLVS) |

_Add a row here for every other env var this project introduces, before using it in code._

`NEXT_PUBLIC_` prefix means the variable is exposed to the browser. Never add
`NEXT_PUBLIC_` to secret keys.

`DATABASE_URL`, `BETTER_AUTH_SECRET` and the R2 keys give full access to the backend
the storefront also runs on. They must never appear in client code or in a `NEXT_PUBLIC_`
variable.

`.env.example` documents every required variable and is the one `.env*` file that is
committed.

---

## Import Aliases

Always use the `@/` alias — never use relative imports that go up more than one level.

```typescript
// Correct
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";

// Never
import { Button } from "../../../components/ui/button";
```

---

## Comments

- No comments explaining what the code does — code must be self-explanatory
- Comments only for why — explaining a non-obvious decision
- Never leave TODO comments in committed code

---

## Dependencies

Never install a new package without a clear reason. Before installing anything check:

1. Does `@ja3dan` (or shadcn) already have this component?
2. Does Next.js already provide this functionality?
3. Is there a simpler native solution?

Approved dependencies for this project:

- `@neondatabase/serverless` — Postgres queries (Neon HTTP driver)
- `pg` — The pool Better Auth runs on
- `better-auth` — Sessions, shared with the FLVS storefront
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — R2 object storage
- `radix-ui` — Primitives under the existing `src/components/ui/`
- `recharts` — Charts
- `motion` — Animation
- `lucide-react` — Icons
- `tailwindcss` — Styling
- `@ja3dan/tokens` — The token contract
- `@ja3dan` registry components — UI primitives, via `pnpm dlx shadcn add @ja3dan/<item>`

_Add a row here — with the reason — before installing anything not already on this list._

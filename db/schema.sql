-- flvs.bran — everything this product owns.
--
-- It shares a Neon database with the FLVS storefront. `public` is the
-- storefront's, plus the four Better Auth tables both products sign in
-- against; `bran` is ours. Nothing in this file touches `public`, and every
-- query in the app names the schema, because Neon's HTTP driver opens a fresh
-- connection per query and a `search_path` set once does not survive.
--
-- Safe to run more than once.

create schema if not exists bran;

-- A tenant. `bran` is sold to brand owners and some of them run more than one
-- label, so the workspace — not the account — is what the app is scoped to.
create table if not exists bran.workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Who can open a workspace.
--
-- `user_id` points at the storefront's `public."user"` on purpose: one FLVS
-- account signs in to both products. The cascade is deliberate too — deleting
-- an account should not leave a membership pointing at nobody. Note `public`
-- is written out: this is the one place bran reaches across, and it should be
-- obvious on the line rather than implied by a search path.
create table if not exists bran.workspace_members (
  workspace_id uuid not null references bran.workspaces (id) on delete cascade,
  user_id      text not null references public."user" (id) on delete cascade,
  role         text not null default 'member'
               check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Answering "which workspaces can this person open?" on every request is the
-- one query the app makes constantly, and it reads by user, not by workspace.
create index if not exists workspace_members_user_idx
  on bran.workspace_members (user_id);

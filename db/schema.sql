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

-- ---------------------------------------------------------------- Restock --
--
-- bran is the system of record for catalogue, stock and sales: the FLVS
-- storefront does not track stock, and most brands on bran have no website at
-- all. Every table carries `workspace_id` and every query filters on it —
-- there is no RLS here, so that filter is the tenancy.
--
-- Money is integer cents. Neon's driver returns `numeric` as a string;
-- integers come back as numbers and never round.

-- A thing the brand sells, independent of size and colour.
create table if not exists bran.products (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references bran.workspaces (id) on delete cascade,
  name            text not null,
  -- How long the supplier takes from order to shelf. The restock formula
  -- orders enough to cover this plus a month.
  lead_time_days  integer not null default 21 check (lead_time_days between 1 and 365),
  supplier_email  text,
  created_at      timestamptz not null default now()
);

create index if not exists products_workspace_idx on bran.products (workspace_id);

-- The unit that is actually stocked and sold: one size in one colour.
create table if not exists bran.variants (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references bran.workspaces (id) on delete cascade,
  product_id      uuid not null references bran.products (id) on delete cascade,
  sku             text not null,
  label           text not null,
  on_hand         integer not null default 0 check (on_hand >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  price_cents     integer not null default 0 check (price_cents >= 0),
  -- The smallest run the supplier will make. Suggested quantities round up
  -- to it.
  min_order_qty   integer not null default 5 check (min_order_qty >= 1),
  created_at      timestamptz not null default now(),
  unique (workspace_id, sku)
);

create index if not exists variants_product_idx on bran.variants (product_id);

-- Units sold, one row per sale line. Orders and importers append; restock
-- only reads. `source` says where it came from: 'dm', 'storefront', 'manual',
-- 'seed'.
create table if not exists bran.sales (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references bran.workspaces (id) on delete cascade,
  variant_id    uuid not null references bran.variants (id) on delete cascade,
  quantity      integer not null check (quantity > 0),
  sold_at       timestamptz not null default now(),
  source        text not null default 'manual'
);

-- Restock reads "this workspace's sales since a date", grouped by variant.
create index if not exists sales_workspace_sold_idx on bran.sales (workspace_id, sold_at);

-- An order to a supplier. `number` is per workspace and shown as PO-0001.
-- Only `sent` orders count as stock on the way: a draft is a thought.
create table if not exists bran.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references bran.workspaces (id) on delete cascade,
  number        integer not null check (number > 0),
  status        text not null default 'draft'
                check (status in ('draft', 'sent', 'received', 'cancelled')),
  -- Null when drafted by the demo workspace with nobody signed in.
  created_by    text references public."user" (id) on delete set null,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  received_at   timestamptz,
  unique (workspace_id, number)
);

create table if not exists bran.purchase_order_lines (
  purchase_order_id  uuid not null references bran.purchase_orders (id) on delete cascade,
  variant_id         uuid not null references bran.variants (id) on delete restrict,
  quantity           integer not null check (quantity between 1 and 999),
  -- What restock suggested when the order was drafted, kept beside what was
  -- ordered, so an override stays visible after the fact. Zero when the
  -- model would not have ordered the line at all.
  suggested_quantity integer not null default 0 check (suggested_quantity >= 0),
  unit_cost_cents    integer not null check (unit_cost_cents >= 0),
  primary key (purchase_order_id, variant_id)
);

create index if not exists purchase_order_lines_variant_idx
  on bran.purchase_order_lines (variant_id);

-- Archiving takes a variant out of restock and the default catalogue view
-- without losing its sales or purchase-order history. Nothing is deleted.
alter table bran.variants add column if not exists archived_at timestamptz;

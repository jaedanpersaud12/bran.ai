import "server-only";

import { sql } from "@/lib/db";
import { loadInventory } from "@/lib/inventory";

export type PoStatus = "draft" | "sent" | "received" | "cancelled";

export type PoSummary = {
  id: string;
  reference: string;
  status: PoStatus;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  lines: number;
  units: number;
  costCents: number;
};

export type PoLine = {
  variantId: string;
  piece: string;
  variant: string;
  sku: string;
  quantity: number;
  suggested: number;
  unitCostCents: number;
  supplierEmail: string | null;
  leadTimeDays: number;
};

/** `PO-0002`. The one place a number becomes a reference. */
export function formatReference(number: number): string {
  return `PO-${String(number).padStart(4, "0")}`;
}

/** Every order in the workspace, newest first, with its totals. */
export async function loadPurchaseOrders(workspaceId: string): Promise<PoSummary[]> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const rows = (await sql`
    select po.id, po.number, po.status, po.created_at, po.sent_at, po.received_at,
           count(l.variant_id)::int as lines,
           coalesce(sum(l.quantity), 0)::int as units,
           coalesce(sum(l.quantity * l.unit_cost_cents), 0)::int as cost_cents
      from bran.purchase_orders po
      left join bran.purchase_order_lines l on l.purchase_order_id = po.id
     where po.workspace_id = ${workspaceId}
     group by po.id
     order by po.number desc
  `) as {
    id: string;
    number: number;
    status: PoStatus;
    created_at: string;
    sent_at: string | null;
    received_at: string | null;
    lines: number;
    units: number;
    cost_cents: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    reference: formatReference(row.number),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    receivedAt: row.received_at ? new Date(row.received_at).toISOString() : null,
    lines: row.lines,
    units: row.units,
    costCents: row.cost_cents,
  }));
}

/** One order's lines, or null when the id isn't this workspace's. */
export async function loadPurchaseOrderLines(
  workspaceId: string,
  orderId: string,
): Promise<{ reference: string; status: PoStatus; lines: PoLine[] } | null> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const rows = (await sql`
    select po.number, po.status, l.variant_id, p.name as piece, v.label as variant, v.sku,
           l.quantity, l.suggested_quantity, l.unit_cost_cents, p.supplier_email,
           p.lead_time_days
      from bran.purchase_orders po
      join bran.purchase_order_lines l on l.purchase_order_id = po.id
      join bran.variants v on v.id = l.variant_id and v.workspace_id = ${workspaceId}
      join bran.products p on p.id = v.product_id and p.workspace_id = ${workspaceId}
     where po.id = ${orderId}::uuid and po.workspace_id = ${workspaceId}
     order by p.name, v.label
  `) as {
    number: number;
    status: PoStatus;
    variant_id: string;
    piece: string;
    variant: string;
    sku: string;
    quantity: number;
    suggested_quantity: number;
    unit_cost_cents: number;
    supplier_email: string | null;
    lead_time_days: number;
  }[];
  if (rows.length === 0) return null;
  return {
    reference: formatReference(rows[0].number),
    status: rows[0].status,
    lines: rows.map((row) => ({
      variantId: row.variant_id,
      piece: row.piece,
      variant: row.variant,
      sku: row.sku,
      quantity: row.quantity,
      suggested: row.suggested_quantity,
      unitCostCents: row.unit_cost_cents,
      supplierEmail: row.supplier_email,
      leadTimeDays: row.lead_time_days,
    })),
  };
}

/** Every order's lines in one query, keyed by order id — for the list's detail dialog. */
export async function loadAllPurchaseOrderLines(
  workspaceId: string,
): Promise<Record<string, PoLine[]>> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const rows = (await sql`
    select l.purchase_order_id as order_id, l.variant_id, p.name as piece, v.label as variant,
           v.sku, l.quantity, l.suggested_quantity, l.unit_cost_cents, p.supplier_email,
           p.lead_time_days
      from bran.purchase_order_lines l
      join bran.purchase_orders po on po.id = l.purchase_order_id and po.workspace_id = ${workspaceId}
      join bran.variants v on v.id = l.variant_id
      join bran.products p on p.id = v.product_id
     order by p.name, v.label
  `) as {
    order_id: string;
    variant_id: string;
    piece: string;
    variant: string;
    sku: string;
    quantity: number;
    suggested_quantity: number;
    unit_cost_cents: number;
    supplier_email: string | null;
    lead_time_days: number;
  }[];

  const byOrder: Record<string, PoLine[]> = {};
  for (const row of rows) {
    (byOrder[row.order_id] ??= []).push({
      variantId: row.variant_id,
      piece: row.piece,
      variant: row.variant,
      sku: row.sku,
      quantity: row.quantity,
      suggested: row.suggested_quantity,
      unitCostCents: row.unit_cost_cents,
      supplierEmail: row.supplier_email,
      leadTimeDays: row.lead_time_days,
    });
  }
  return byOrder;
}

/* ------------------------------------------------------------------ Drafts -- */

export type DraftLine = { variantId: string; quantity: number };

export type DraftResult = { ok: true; reference: string } | { ok: false; error: string };

const MAX_QUANTITY = 999;
const MAX_LINES = 500;
/** Two drafts racing for the same number: the loser takes the next one. */
const ATTEMPTS = 3;

/**
 * Saves a purchase order as a draft. Nothing is sent to a supplier.
 *
 * Shared by the planner's server action and the assistant's tool, so both go
 * through the same checks. Callers pass the workspace they resolved from the
 * session; the variant ids and quantities are the only other input, and the
 * unit costs and restock's suggestions are
 * read fresh from the workspace's own inventory — so a line for another
 * workspace's variant simply isn't found, and the recorded suggestion is what
 * restock actually said, not what the browser claims it said.
 */
export async function createDraftOrder(
  workspaceId: string,
  userId: string | null,
  lines: DraftLine[],
): Promise<DraftResult> {
  if (!sql) return { ok: false, error: "The database isn't configured." };

  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    return { ok: false, error: "Pick at least one line to order." };
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (
      typeof line?.variantId !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: `Each line needs a quantity from 1 to ${MAX_QUANTITY}.` };
    }
    if (seen.has(line.variantId)) return { ok: false, error: "A line appears twice." };
    seen.add(line.variantId);
  }

  let inventory;
  try {
    inventory = await loadInventory(workspaceId);
  } catch (error) {
    console.error("draftPurchaseOrder: loading inventory failed", error);
    return { ok: false, error: "Couldn't read inventory. Try again." };
  }
  const byId = new Map(inventory.lines.map((line) => [line.variantId, line]));
  const known = lines.map((line) => byId.get(line.variantId));
  if (known.some((line) => line === undefined)) {
    return { ok: false, error: "Some of those lines aren't in this workspace." };
  }

  const ids = lines.map((line) => line.variantId);
  const quantities = lines.map((line) => line.quantity);
  const suggested = known.map((line) => line?.score.suggested ?? 0);
  const costs = known.map((line) => line?.unitCostCents ?? 0);

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      // One statement, so the order and its lines land together or not at all.
      const rows = await sql`
        with po as (
          insert into bran.purchase_orders (workspace_id, number, created_by)
          select ${workspaceId}, coalesce(max(number), 0) + 1, ${userId}
            from bran.purchase_orders
           where workspace_id = ${workspaceId}
          returning id, number
        ), added as (
          insert into bran.purchase_order_lines
            (purchase_order_id, variant_id, quantity, suggested_quantity, unit_cost_cents)
          select po.id, t.variant_id, t.quantity, t.suggested, t.cost
            from po,
                 unnest(${ids}::uuid[], ${quantities}::int[], ${suggested}::int[], ${costs}::int[])
                   as t(variant_id, quantity, suggested, cost)
          returning 1
        )
        select number from po
      `;
      const number = (rows[0] as { number: number }).number;
      return { ok: true, reference: formatReference(number) };
    } catch (error) {
      if (isUniqueViolation(error) && attempt < ATTEMPTS) continue;
      console.error("draftPurchaseOrder: insert failed", error);
      return { ok: false, error: "Couldn't save the draft. Try again." };
    }
  }
  return { ok: false, error: "Couldn't save the draft. Try again." };
}


function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

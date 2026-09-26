import "server-only";

import { sql } from "@/lib/db";

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

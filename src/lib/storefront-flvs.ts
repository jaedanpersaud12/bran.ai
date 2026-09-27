import "server-only";

import { sql } from "@/lib/db";
import { importTakesStock, mapFlvsOrder, type FlvsOrder, type MappedFlvsOrder } from "@/lib/order-input";
import type { Order } from "@/lib/order-input";
import type { OrderStatus, Payment } from "@/lib/order-status";
import { createOrder, type CreateResult } from "@/lib/orders";

/**
 * The FLVS storefront as an order source.
 *
 * `public.orders` is the storefront's own table: this module only ever
 * selects from it. Which bran workspace is FLVS's is a deployment fact —
 * `FLVS_STOREFRONT_WORKSPACE` names its slug — until onboarding (14) gives
 * every workspace its own store connection.
 *
 * Storefront items don't name bran variants, so each distinct item (product
 * plus the customer's choices) is matched to one once, by the owner, and the
 * match is kept in `bran.storefront_links`.
 */

export const SOURCE = "flvs";

export function isFlvsWorkspace(slug: string): boolean {
  const configured = process.env.FLVS_STOREFRONT_WORKSPACE;
  return Boolean(configured) && configured === slug;
}

export type PreviewLine = {
  key: string;
  name: string;
  choices: string;
  quantity: number;
  unitPriceCents: number;
  /** The variant this item is matched to, or null until the owner picks one. */
  variantId: string | null;
};

export type PreviewOrder = {
  ref: string;
  customerName: string;
  placedAt: string;
  status: OrderStatus;
  /** False for an order the storefront had already shipped: it counts as a sale, the shelf is left alone. */
  takesStock: boolean;
  payment: Payment;
  deliveryFeeCents: number;
  lines: PreviewLine[];
};

/** The storefront's orders this workspace hasn't imported yet, oldest first, with their matches. */
export async function loadFlvsPreview(workspaceId: string): Promise<PreviewOrder[]> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const [orders, links] = await Promise.all([
    sql`
      select o.ref, o.items, o.contact, o.method, o.area, o.payment, o.payment_status,
             o.fulfilment_status, o.delivery_fee, o.created_at
        from public.orders o
       where o.archived_at is null
         and not exists (
           select 1 from bran.orders b
            where b.workspace_id = ${workspaceId}
              and b.external_source = ${SOURCE}
              and b.external_ref = o.ref
         )
       order by o.created_at
    `,
    loadLinks(workspaceId),
  ]);
  return (orders as FlvsOrder[]).map((row) => withLinks(mapFlvsOrder(row), links));
}

async function loadLinks(workspaceId: string): Promise<Map<string, string>> {
  if (!sql) return new Map();
  const rows = (await sql`
    select l.item_key, l.variant_id
      from bran.storefront_links l
      join bran.variants v on v.id = l.variant_id and v.workspace_id = ${workspaceId}
     where l.workspace_id = ${workspaceId} and l.source = ${SOURCE}
  `) as { item_key: string; variant_id: string }[];
  return new Map(rows.map((row) => [row.item_key, row.variant_id]));
}

function withLinks(order: MappedFlvsOrder, links: Map<string, string>): PreviewOrder {
  return {
    ref: order.ref,
    customerName: order.customerName,
    placedAt: order.placedAt,
    status: order.status,
    takesStock: importTakesStock(order.status),
    payment: order.payment,
    deliveryFeeCents: order.deliveryFeeCents,
    lines: order.lines.map((line) => ({ ...line, variantId: links.get(line.key) ?? null })),
  };
}

/**
 * Remembers which variant a storefront item is. The insert selects the
 * variant from this workspace, so another workspace's id links nothing.
 */
export async function linkFlvsItem(workspaceId: string, itemKey: string, variantId: string): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql`
    insert into bran.storefront_links (workspace_id, source, item_key, variant_id)
    select ${workspaceId}, ${SOURCE}, ${itemKey}, v.id
      from bran.variants v
     where v.id = ${variantId}::uuid and v.workspace_id = ${workspaceId}
    on conflict (workspace_id, source, item_key) do update set variant_id = excluded.variant_id
    returning variant_id
  `;
  return rows.length > 0;
}

export type ImportOutcome = { ref: string; result: CreateResult };

/**
 * Imports the chosen storefront orders through the same create path as a
 * typed-in order. Everything is read again here — the storefront row, the
 * matches — so the browser only chooses which refs; it can't supply an
 * order's contents. An order with an unmatched line is skipped with a reason.
 */
export async function importFlvsOrders(
  workspaceId: string,
  userId: string | null,
  refs: string[],
): Promise<ImportOutcome[]> {
  const chosen = new Set(refs);
  const preview = (await loadFlvsPreview(workspaceId)).filter((order) => chosen.has(order.ref));
  const full = await loadFlvsOrders(preview.map((order) => order.ref));

  // A ticked order that's no longer on offer — imported from another tab, or
  // gone from the storefront — is reported, not silently dropped.
  const offered = new Set(preview.map((order) => order.ref));
  const outcomes: ImportOutcome[] = [...chosen]
    .filter((ref) => !offered.has(ref))
    .map((ref) => ({ ref, result: { ok: false, error: "It's already imported, or no longer on the storefront." } }));
  for (const order of preview) {
    const mapped = full.get(order.ref);
    if (!mapped) continue;
    if (order.lines.length === 0) {
      outcomes.push({ ref: order.ref, result: { ok: false, error: "It has no items bran can read." } });
      continue;
    }
    if (order.lines.some((line) => !line.variantId)) {
      outcomes.push({ ref: order.ref, result: { ok: false, error: "Match every item to a variant first." } });
      continue;
    }
    // Two storefront items matched to one variant become one line.
    const lines = new Map<string, Order["lines"][number]>();
    for (const line of order.lines) {
      const id = line.variantId as string; // checked above: every line is matched
      const existing = lines.get(id);
      if (existing) existing.quantity += line.quantity;
      else lines.set(id, { variantId: id, quantity: line.quantity, unitPriceCents: line.unitPriceCents });
    }
    const result = await createOrder(
      workspaceId,
      userId,
      {
        customerName: mapped.customerName,
        customerPhone: mapped.customerPhone,
        channel: "storefront",
        delivery: mapped.delivery,
        area: mapped.area,
        payment: mapped.payment,
        deliveryFeeCents: mapped.deliveryFeeCents,
        notes: null,
        lines: [...lines.values()],
      },
      {
        placedAt: mapped.placedAt,
        status: mapped.status,
        takesStock: importTakesStock(mapped.status),
        external: { source: SOURCE, ref: mapped.ref },
      },
    );
    outcomes.push({ ref: order.ref, result });
  }
  return outcomes;
}

async function loadFlvsOrders(refs: string[]): Promise<Map<string, MappedFlvsOrder>> {
  if (!sql || refs.length === 0) return new Map();
  const rows = (await sql`
    select ref, items, contact, method, area, payment, payment_status, fulfilment_status,
           delivery_fee, created_at
      from public.orders
     where ref = any(${refs}::text[])
  `) as FlvsOrder[];
  return new Map(rows.map((row) => [row.ref, mapFlvsOrder(row)]));
}

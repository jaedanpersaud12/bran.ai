import "server-only";

import { sql } from "@/lib/db";
import { scoreVariant, summarise, type RestockSummary, type Score } from "@/lib/restock";

/** One stocked variant, scored — what the inventory screen draws a row from. */
export type RestockLine = {
  variantId: string;
  sku: string;
  name: string;
  variant: string;
  onHand: number;
  onOrder: number;
  leadTimeDays: number;
  unitCostCents: number;
  priceCents: number;
  score: Score;
};

export type Inventory = {
  lines: RestockLine[];
  summary: RestockSummary;
};

type Row = {
  variant_id: string;
  sku: string;
  product: string;
  label: string;
  on_hand: number;
  on_order: number;
  lead_time_days: number;
  min_order_qty: number;
  unit_cost_cents: number;
  price_cents: number;
  sold14: number;
  sold7: number;
  sold_prior7: number;
};

/**
 * Every variant in the workspace, with the sales windows and stock on order
 * restock needs, scored and ordered worst cover first.
 *
 * One query: the sales windows are conditional sums over the last fourteen
 * days, and "on order" is lines on purchase orders that have been sent and
 * not received. Both are joined in as pre-aggregated subqueries so a variant
 * with many sales and many orders doesn't multiply either.
 */
export async function loadInventory(workspaceId: string): Promise<Inventory> {
  if (!sql) throw new Error("DATABASE_URL is not set");

  const rows = (await sql`
    select v.id as variant_id, v.sku, p.name as product, v.label,
           v.on_hand, v.min_order_qty, v.unit_cost_cents, v.price_cents,
           p.lead_time_days,
           coalesce(o.on_order, 0)::int as on_order,
           coalesce(s.sold14, 0)::int as sold14,
           coalesce(s.sold7, 0)::int as sold7,
           coalesce(s.sold_prior7, 0)::int as sold_prior7
      from bran.variants v
      join bran.products p on p.id = v.product_id and p.workspace_id = ${workspaceId}
      left join (
        select variant_id,
               sum(quantity) as sold14,
               sum(quantity) filter (where sold_at >= now() - interval '7 days') as sold7,
               sum(quantity) filter (where sold_at < now() - interval '7 days') as sold_prior7
          from bran.sales
         where workspace_id = ${workspaceId}
           and sold_at >= now() - interval '14 days'
         group by variant_id
      ) s on s.variant_id = v.id
      left join (
        select l.variant_id, sum(l.quantity) as on_order
          from bran.purchase_order_lines l
          join bran.purchase_orders po on po.id = l.purchase_order_id
         where po.workspace_id = ${workspaceId}
           and po.status = 'sent'
         group by l.variant_id
      ) o on o.variant_id = v.id
     where v.workspace_id = ${workspaceId}
     order by p.name, v.label
  `) as Row[];

  const lines = rows.map(
    (row): RestockLine => ({
      variantId: row.variant_id,
      sku: row.sku,
      name: row.product,
      variant: row.label,
      onHand: row.on_hand,
      onOrder: row.on_order,
      leadTimeDays: row.lead_time_days,
      unitCostCents: row.unit_cost_cents,
      priceCents: row.price_cents,
      score: scoreVariant({
        onHand: row.on_hand,
        onOrder: row.on_order,
        leadTimeDays: row.lead_time_days,
        minOrderQty: row.min_order_qty,
        sold14: row.sold14,
        sold7: row.sold7,
        soldPrior7: row.sold_prior7,
      }),
    }),
  );

  // Worst cover first; lines that don't sell (no cover) go last.
  lines.sort((a, b) => (a.score.cover ?? Infinity) - (b.score.cover ?? Infinity));

  return { lines, summary: summarise(lines) };
}

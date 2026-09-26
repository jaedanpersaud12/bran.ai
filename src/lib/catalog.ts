import "server-only";

import { sql } from "@/lib/db";

/** One variant as the catalogue screen shows and edits it. */
export type CatalogRow = {
  variantId: string;
  productId: string;
  product: string;
  leadTimeDays: number;
  supplierEmail: string | null;
  label: string;
  sku: string;
  onHand: number;
  unitCostCents: number;
  priceCents: number;
  minOrderQty: number;
  archived: boolean;
};

/**
 * Every variant in the workspace, archived included — the screen filters, so
 * turning "Show archived" on doesn't need a round trip. Ordered the way the
 * owner thinks about the range: by product, then variant.
 */
export async function loadCatalog(workspaceId: string): Promise<CatalogRow[]> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const rows = await sql`
    select v.id as "variantId", p.id as "productId", p.name as product,
           p.lead_time_days as "leadTimeDays", p.supplier_email as "supplierEmail",
           v.label, v.sku, v.on_hand as "onHand", v.unit_cost_cents as "unitCostCents",
           v.price_cents as "priceCents", v.min_order_qty as "minOrderQty",
           v.archived_at is not null as archived
      from bran.variants v
      join bran.products p on p.id = v.product_id and p.workspace_id = ${workspaceId}
     where v.workspace_id = ${workspaceId}
     order by p.name, v.label
  `;
  return rows as CatalogRow[];
}

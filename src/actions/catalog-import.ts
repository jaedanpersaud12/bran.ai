"use server";

import { revalidatePath } from "next/cache";
import { aiConfigured, callOptions, model, modelId, visionModel, visionModelId } from "@/lib/ai/model";
import { runAI } from "@/lib/ai/run";
import { loadCatalog, type CatalogRow } from "@/lib/catalog";
import {
  extractCatalog,
  MAX_DRAFT_ROWS,
  MAX_TEXT,
  parseDataUrl,
  type KnownProduct,
} from "@/lib/catalog-extract";
import {
  canImport,
  checkDraft,
  normaliseName,
  toDraftRows,
  type DraftField,
  type DraftRow,
  type ExistingCatalog,
  type SupplierInput,
} from "@/lib/catalog-import";
import { parseProduct, parseVariant, type FieldErrors, type ProductFields } from "@/lib/catalog-input";
import { sql } from "@/lib/db";
import { currentWorkspace } from "@/lib/workspace";

/**
 * Catalogue import: a draft from the model, then the owner's rows written in
 * one go.
 *
 * `extractCatalogDraft` writes nothing to the catalogue — it returns rows for
 * the review table. `importCatalog` re-checks every row against the database
 * (the browser's check is a courtesy) and writes them in a single statement,
 * so an import lands whole or not at all. Both resolve the workspace from the
 * session; nothing in the request names one.
 */

/**
 * The photo's ceiling in data-URL characters. Server Actions refuse bodies
 * over 1 MB (Next's default) before the action runs, so this sits below that
 * with room for a note; the browser shrinks the photo until it fits.
 */
const MAX_IMAGE_CHARS = 900_000;
/** A document takes longer to read than restock's sentences (`runAI` defaults to 15s). */
const EXTRACT_TIMEOUT_MS = 60_000;

export type DraftResult =
  | {
      ok: true;
      rows: DraftRow[];
      /** ISO code the document's money is in, when it says. */
      currency: string | null;
      supplierEmail: string | null;
      /** The document's stated lead time, when it gives one bran can use. */
      leadTimeDays: number | null;
      truncated: boolean;
    }
  | { ok: false; message: string };

export type ImportResult =
  | { ok: true; variants: number; products: number }
  | {
      ok: false;
      message: string;
      rowErrors?: Record<string, FieldErrors<DraftField>>;
      supplierErrors?: FieldErrors<ProductFields>;
    };

export async function extractCatalogDraft(source: {
  text?: string;
  image?: string;
}): Promise<DraftResult> {
  const current = await currentWorkspace();
  if (!current || !sql) return { ok: false, message: "Sign in to import into your catalog." };
  if (!aiConfigured) return { ok: false, message: "Import needs the AI key, which isn't set up." };

  const text = typeof source.text === "string" ? source.text.trim() : "";
  const image = typeof source.image === "string" ? source.image : "";
  if (!text && !image) return { ok: false, message: "Paste a list or add a photo first." };
  if (text.length > MAX_TEXT) {
    return { ok: false, message: `That's more than ${MAX_TEXT.toLocaleString()} characters. Split it into parts.` };
  }
  if (image && (image.length > MAX_IMAGE_CHARS || !parseDataUrl(image))) {
    return { ok: false, message: "That photo couldn't be read. Try a JPEG or PNG." };
  }

  const workspaceId = current.workspace.id;
  let catalog: CatalogRow[];
  try {
    catalog = await loadCatalog(workspaceId);
  } catch (error) {
    console.error("extractCatalogDraft: loading catalog failed", error);
    return { ok: false, message: "Couldn't read your catalog. Try again." };
  }

  // A photo goes to the vision model, text to the default one. When both are
  // given the photo is the document and the text travels with it as a note.
  const result = await runAI({
    feature: "catalog-import",
    workspaceId,
    timeoutMs: EXTRACT_TIMEOUT_MS,
    model: image ? visionModelId : modelId,
    call: async (signal) => {
      const out = await extractCatalog({
        model: image ? visionModel() : model(),
        source: image ? { kind: "image", dataUrl: image, note: text || undefined } : { kind: "text", text },
        known: knownProducts(catalog),
        abortSignal: signal,
        providerOptions: callOptions.providerOptions,
      });
      return { value: out, usage: out.usage };
    },
  });
  if (!result) {
    return { ok: false, message: "bran couldn't read that just now. Try again in a moment." };
  }

  const { leadTimeDays } = result.extracted;
  return {
    ok: true,
    rows: toDraftRows(result.extracted.items, toExisting(catalog).skus),
    currency: result.extracted.currency,
    supplierEmail: result.extracted.supplierEmail,
    leadTimeDays:
      leadTimeDays !== null && Number.isInteger(leadTimeDays) && leadTimeDays >= 1 && leadTimeDays <= 365
        ? leadTimeDays
        : null,
    truncated: result.truncated,
  };
}

export async function importCatalog(input: {
  rows: DraftRow[];
  supplier: SupplierInput;
}): Promise<ImportResult> {
  const current = await currentWorkspace();
  if (!current || !sql) return { ok: false, message: "Sign in to import into your catalog." };
  const ws = current.workspace.id;

  const rows = Array.isArray(input?.rows) ? input.rows.filter(isDraftRow).filter((row) => row.keep) : [];
  if (rows.length === 0) return { ok: false, message: "Keep at least one row to import." };
  if (rows.length > MAX_DRAFT_ROWS) return { ok: false, message: `Import at most ${MAX_DRAFT_ROWS} rows at a time.` };
  const supplier: SupplierInput = {
    leadTimeDays: String(input?.supplier?.leadTimeDays ?? ""),
    supplierEmail: String(input?.supplier?.supplierEmail ?? ""),
  };

  let existing: ExistingCatalog;
  try {
    existing = await existingCatalog(ws);
  } catch (error) {
    console.error("importCatalog: loading catalog failed", error);
    return { ok: false, message: "Couldn't read your catalog. Try again." };
  }

  const check = checkDraft(rows, supplier, existing);
  if (!canImport(check)) return refused(rows, check);

  // New products, one per name however many rows share it; the first row's
  // spelling wins. Rows naming an existing product carry its id instead.
  const newNames = new Map<string, string>();
  const productIds: (string | null)[] = [];
  const productNames: (string | null)[] = [];
  const labels: string[] = [];
  const skus: string[] = [];
  const costs: number[] = [];
  const prices: number[] = [];
  const onHands: number[] = [];
  const minimums: number[] = [];

  for (const row of rows) {
    const joins = check.rows.get(row.key)?.joins ?? null;
    const variant = parseVariant(row);
    // The name only: the supplier fields belong to new products, and a row
    // joining an existing one mustn't be refused over fields it doesn't use.
    const product = parseProduct({ name: row.product, leadTimeDays: "1", supplierEmail: "" });
    if (!variant.ok || !product.ok) return refused(rows, check);

    const key = normaliseName(product.value.name);
    if (!joins && !newNames.has(key)) newNames.set(key, product.value.name);
    productIds.push(joins?.id ?? null);
    productNames.push(joins ? null : (newNames.get(key) ?? null));
    labels.push(variant.value.label);
    skus.push(variant.value.sku);
    costs.push(variant.value.unitCostCents);
    prices.push(variant.value.priceCents);
    onHands.push(variant.value.onHand);
    minimums.push(variant.value.minOrderQty);
  }

  // Only new products take the supplier's lead time and email; checkDraft
  // has already refused bad ones whenever there's a new product to use them.
  const supplierFields = parseProduct({ name: "–", ...supplier });
  if (newNames.size > 0 && !supplierFields.ok) return refused(rows, check);
  const leadTimeDays = supplierFields.ok ? supplierFields.value.leadTimeDays : 21;
  const supplierEmail = supplierFields.ok ? supplierFields.value.supplierEmail : null;

  try {
    // One statement: the new products and every variant land together or not
    // at all. An existing product id only matches inside this workspace, so a
    // variant can't be attached to someone else's product.
    const written = await sql`
      with new_products as (
        insert into bran.products (workspace_id, name, lead_time_days, supplier_email)
        select ${ws}, t.name, ${leadTimeDays}, ${supplierEmail}
          from unnest(${[...newNames.values()]}::text[]) as t(name)
        returning id, name
      ), incoming as (
        select t.*, coalesce(p.id, np.id) as resolved
          from unnest(${productIds}::uuid[], ${productNames}::text[], ${labels}::text[],
                      ${skus}::text[], ${costs}::int[], ${prices}::int[], ${onHands}::int[],
                      ${minimums}::int[])
                 as t(product_id, product_name, label, sku, cost, price, on_hand, min_order)
          left join bran.products p on p.id = t.product_id and p.workspace_id = ${ws}
          left join new_products np on t.product_id is null and np.name = t.product_name
      ), added as (
        insert into bran.variants
          (workspace_id, product_id, label, sku, unit_cost_cents, price_cents, on_hand, min_order_qty)
        select ${ws}, resolved, label, sku, cost, price, on_hand, min_order
          from incoming
        returning id
      )
      select (select count(*) from added)::int as variants,
             (select count(*) from new_products)::int as products
    `;
    const [{ variants, products }] = written as { variants: number; products: number }[];
    revalidatePath("/inventory/catalog");
    revalidatePath("/inventory");
    return { ok: true, variants, products };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code === "23505") {
      // A SKU was taken between the check and the write: find which, and say.
      try {
        const again = checkDraft(rows, supplier, await existingCatalog(ws));
        if (!canImport(again)) return refused(rows, again);
      } catch {
        // Fall through to the general message.
      }
      return { ok: false, message: "A SKU was taken while you were reviewing. Nothing was imported." };
    }
    console.error("importCatalog failed", error);
    return { ok: false, message: "Couldn't import. Nothing was written — try again." };
  }
}

async function existingCatalog(workspaceId: string): Promise<ExistingCatalog> {
  return toExisting(await loadCatalog(workspaceId));
}

function toExisting(catalog: CatalogRow[]): ExistingCatalog {
  const products = new Map<string, { id: string; name: string }>();
  for (const row of catalog) products.set(row.productId, { id: row.productId, name: row.product });
  return { products: [...products.values()], skus: catalog.map((row) => row.sku) };
}

/** Active products with their variant labels, for the model to match against. */
function knownProducts(catalog: CatalogRow[]): KnownProduct[] {
  const byName = new Map<string, KnownProduct>();
  for (const row of catalog) {
    if (row.archived) continue;
    const product = byName.get(row.productId) ?? { name: row.product, variants: [] };
    product.variants.push(row.label);
    byName.set(row.productId, product);
  }
  return [...byName.values()];
}

/** Nothing written: each row's problems, and a message naming the first one. */
function refused(rows: DraftRow[], check: ReturnType<typeof checkDraft>): ImportResult {
  const rowErrors: Record<string, FieldErrors<DraftField>> = {};
  for (const [key, row] of check.rows) {
    if (Object.keys(row.errors).length > 0) rowErrors[key] = row.errors;
  }
  const first = rows.find((row) => rowErrors[row.key]);
  const firstError = first ? Object.values(rowErrors[first.key])[0] : undefined;
  const message = first
    ? `${first.product || "A row with no product name"}, ${first.label || "no variant"}: ${firstError} Nothing was imported.`
    : "Check the supplier's lead time and email. Nothing was imported.";
  return { ok: false, message, rowErrors, supplierErrors: check.supplier };
}

function isDraftRow(value: unknown): value is DraftRow {
  if (typeof value !== "object" || value === null) return false;
  const fields = ["key", "product", "label", "sku", "unitCost", "price", "onHand", "minOrderQty"];
  const record = value as Record<string, unknown>; // narrowed field by field below
  return fields.every((field) => typeof record[field] === "string") && typeof record.keep === "boolean";
}

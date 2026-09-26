"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import {
  parseProduct,
  parseStock,
  parseVariant,
  type FieldErrors,
  type ProductInput,
  type VariantInput,
} from "@/lib/catalog-input";
import { currentWorkspace } from "@/lib/workspace";

/**
 * Catalogue writes.
 *
 * Every action resolves the workspace from the session and puts
 * `workspace_id` in the WHERE of its write, so an id from another workspace
 * matches nothing and changes nothing — it isn't rejected so much as never
 * found. Input is re-parsed here with the same function the modal used; the
 * browser's validation is a courtesy.
 */

/** `errors` is keyed by form field, so the modal can put each message under its input. */
export type ActionResult =
  | { ok: true }
  | { ok: false; errors: FieldErrors<string>; message?: string };

const NOT_FOUND = { ok: false as const, errors: {}, message: "That item isn't in this workspace." };
const SIGNED_OUT = { ok: false as const, errors: {}, message: "Sign in to edit the catalogue." };
const FAILED = { ok: false as const, errors: {}, message: "Couldn't save. Try again." };

export async function createProduct(
  product: ProductInput,
  variant: VariantInput,
): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  const p = parseProduct(product);
  const v = parseVariant(variant);
  if (!p.ok || !v.ok) {
    return { ok: false, errors: { ...(p.ok ? {} : p.errors), ...(v.ok ? {} : v.errors) } };
  }

  try {
    // One statement: the product and its first variant exist together or not at all.
    await sql`
      with product as (
        insert into bran.products (workspace_id, name, lead_time_days, supplier_email)
        values (${ws}, ${p.value.name}, ${p.value.leadTimeDays}, ${p.value.supplierEmail})
        returning id
      )
      insert into bran.variants
        (workspace_id, product_id, label, sku, unit_cost_cents, price_cents, on_hand, min_order_qty)
      select ${ws}, product.id, ${v.value.label}, ${v.value.sku}, ${v.value.unitCostCents},
             ${v.value.priceCents}, ${v.value.onHand}, ${v.value.minOrderQty}
        from product
    `;
  } catch (error) {
    return failure(error, "createProduct");
  }
  refresh();
  return { ok: true };
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  const p = parseProduct(input);
  if (!p.ok) return { ok: false, errors: p.errors };

  try {
    const rows = await sql`
      update bran.products
         set name = ${p.value.name}, lead_time_days = ${p.value.leadTimeDays},
             supplier_email = ${p.value.supplierEmail}
       where id = ${productId}::uuid and workspace_id = ${ws}
      returning id
    `;
    if (rows.length === 0) return NOT_FOUND;
  } catch (error) {
    return failure(error, "updateProduct");
  }
  refresh();
  return { ok: true };
}

export async function createVariant(
  productId: string,
  input: VariantInput,
): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  const v = parseVariant(input);
  if (!v.ok) return { ok: false, errors: v.errors };

  try {
    // Inserting through a select on the product means a product id from
    // another workspace inserts nothing.
    const rows = await sql`
      insert into bran.variants
        (workspace_id, product_id, label, sku, unit_cost_cents, price_cents, on_hand, min_order_qty)
      select ${ws}, p.id, ${v.value.label}, ${v.value.sku}, ${v.value.unitCostCents},
             ${v.value.priceCents}, ${v.value.onHand}, ${v.value.minOrderQty}
        from bran.products p
       where p.id = ${productId}::uuid and p.workspace_id = ${ws}
      returning id
    `;
    if (rows.length === 0) return NOT_FOUND;
  } catch (error) {
    return failure(error, "createVariant");
  }
  refresh();
  return { ok: true };
}

export async function updateVariant(
  variantId: string,
  input: VariantInput,
): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  const v = parseVariant(input);
  if (!v.ok) return { ok: false, errors: v.errors };

  try {
    const rows = await sql`
      update bran.variants
         set label = ${v.value.label}, sku = ${v.value.sku},
             unit_cost_cents = ${v.value.unitCostCents}, price_cents = ${v.value.priceCents},
             on_hand = ${v.value.onHand}, min_order_qty = ${v.value.minOrderQty}
       where id = ${variantId}::uuid and workspace_id = ${ws}
      returning id
    `;
    if (rows.length === 0) return NOT_FOUND;
  } catch (error) {
    return failure(error, "updateVariant");
  }
  refresh();
  return { ok: true };
}

/** The inline stock editor: a counted shelf, set as-is. */
export async function setStock(variantId: string, count: string): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  const onHand = parseStock(count);
  if (onHand === null) return { ok: false, errors: { onHand: "A whole number, 0 or more." } };

  try {
    const rows = await sql`
      update bran.variants set on_hand = ${onHand}
       where id = ${variantId}::uuid and workspace_id = ${ws}
      returning id
    `;
    if (rows.length === 0) return NOT_FOUND;
  } catch (error) {
    return failure(error, "setStock");
  }
  refresh();
  return { ok: true };
}

export async function setArchived(variantId: string, archived: boolean): Promise<ActionResult> {
  const ws = await workspaceId();
  if (!ws || !sql) return SIGNED_OUT;

  try {
    const rows = await sql`
      update bran.variants
         set archived_at = case when ${archived} then coalesce(archived_at, now()) else null end
       where id = ${variantId}::uuid and workspace_id = ${ws}
      returning id
    `;
    if (rows.length === 0) return NOT_FOUND;
  } catch (error) {
    return failure(error, "setArchived");
  }
  refresh();
  return { ok: true };
}

async function workspaceId(): Promise<string | null> {
  const current = await currentWorkspace();
  return current?.workspace.id ?? null;
}

function refresh(): void {
  revalidatePath("/inventory/catalog");
  revalidatePath("/inventory");
}

/** A duplicate SKU is the one database error a person can fix, so it gets a field. */
function failure(error: unknown, where: string): ActionResult {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "23505") {
    return { ok: false, errors: { sku: "Another variant in this workspace already uses that SKU." } };
  }
  // A malformed id reaches Postgres as a failed uuid cast; it's the same as not found.
  if (code === "22P02") return NOT_FOUND;
  console.error(`${where} failed`, error);
  return FAILED;
}

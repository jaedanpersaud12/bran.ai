/**
 * The owner's half of catalogue import: the review table's rows, and what's
 * wrong with them.
 *
 * The model's draft becomes rows of strings, exactly like the Add product
 * modal's fields, so 02's `parseProduct` / `parseVariant` decide what's valid
 * and the same messages appear. On top of those rules, import adds the two a
 * batch can break: a SKU used twice in the draft, or one the workspace already
 * has. The dialog checks as the owner types; `importCatalog` checks again on
 * the server rather than trusting the browser's copy.
 *
 * Plain and import-free apart from 02's parser, so both sides share it and
 * `node --test` runs it without a build.
 */

import {
  parseProduct,
  parseVariant,
  type FieldErrors,
  type ProductFields,
  type VariantFields,
  type VariantInput,
} from "./catalog-input.ts";

/** One variant on the review table. The fields are what's in the inputs. */
export type DraftRow = VariantInput & {
  /** Stable across edits, for React keys and for naming a row in an error. */
  key: string;
  keep: boolean;
  product: string;
  /** bran made this SKU up (the document had none, or used one code for several variants). */
  skuSuggested: boolean;
};

/** What the model returned for one variant (see `catalog-extract.ts`). */
export type ExtractedRow = {
  product: string | null;
  variant: string | null;
  sku: string | null;
  unitCost: string | null;
  price: string | null;
  minOrderQty: number | null;
  onHand: number | null;
};

/** The workspace's catalogue as import needs it: products to join, SKUs that are taken. */
export type ExistingCatalog = {
  products: { id: string; name: string }[];
  /** Every SKU in the workspace, archived variants included — the constraint is on all of them. */
  skus: string[];
};

export type DraftField = VariantFields | "product";

export type RowCheck = {
  errors: FieldErrors<DraftField>;
  /** The existing product this row joins, or null for a new one. */
  joins: { id: string; name: string } | null;
};

export type SupplierInput = Record<"leadTimeDays" | "supplierEmail", string>;

export type DraftCheck = {
  rows: Map<string, RowCheck>;
  supplier: FieldErrors<ProductFields>;
  /** Kept rows with no errors. Import needs this to equal the kept count. */
  ready: number;
  kept: number;
};

const SKU_MAX = 40;

/** "  Linen   Shirt " and "linen shirt" are the same product. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** "White · M" → "WHITE-M"; anything a SKU can't hold becomes a dash. */
function slug(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fit(sku: string): string {
  return sku.slice(0, SKU_MAX).replace(/-+$/, "");
}

/**
 * A SKU for a row the document gave none: the product's first two words and
 * the variant, `LINEN-SHIRT-WHITE-M`, then `-2`, `-3` until it's free.
 */
export function suggestSku(product: string, variant: string, taken: Set<string>): string {
  const words = slug(product).split("-").filter(Boolean).slice(0, 2).join("-");
  const base = fit([words || "ITEM", slug(variant)].filter(Boolean).join("-"));
  return unique(base, taken);
}

function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SKU_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The model's items → review rows. Nulls become empty inputs, except the two
 * defaults the table shows: nothing on the shelf yet, and a minimum order of
 * one. A supplier code used for several variants (one code for a shirt in
 * S, M and L) gets the variant appended, since bran's SKUs are per variant.
 */
export function toDraftRows(items: ExtractedRow[], existingSkus: string[]): DraftRow[] {
  const taken = new Set(existingSkus.map((sku) => sku.toUpperCase()));
  const shared = new Map<string, string[]>();
  for (const item of items) {
    const code = item.sku?.trim().toUpperCase();
    if (code) shared.set(code, [...(shared.get(code) ?? []), (item.variant ?? "").trim()]);
  }

  return items.map((item, index) => {
    const product = (item.product ?? "").trim();
    const label = (item.variant ?? "").trim();
    const code = item.sku?.trim().toUpperCase() ?? "";

    let sku = code;
    let skuSuggested = false;
    if (!code) {
      sku = suggestSku(product, label, taken);
      skuSuggested = true;
    } else if ((shared.get(code)?.length ?? 0) > 1) {
      sku = unique(fit(`${code}-${distinctPart(label, shared.get(code) ?? [])}`), taken);
      skuSuggested = true;
    }
    taken.add(sku);

    return {
      key: `r${index}`,
      keep: true,
      product,
      label,
      sku,
      skuSuggested,
      unitCost: item.unitCost?.trim() ?? "",
      price: item.price?.trim() ?? "",
      onHand: item.onHand === null ? "0" : String(item.onHand),
      minOrderQty: item.minOrderQty === null ? "1" : String(item.minOrderQty),
    };
  });
}

/**
 * What tells a variant apart from the others sharing its supplier code: the
 * parts of its label ("White · M") that not every label in the group has.
 * White · S / White · M → S, M; Hibiscus red · One size / Sea blue · One
 * size → HIBISCUS-RED, SEA-BLUE.
 */
function distinctPart(label: string, group: string[]): string {
  const parts = (text: string) => text.split("·").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const everywhere = parts(group[0] ?? "").filter((part) => group.every((other) => parts(other).includes(part)));
  const own = label
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !everywhere.includes(part.toLowerCase()));
  return slug(own.join(" ")) || slug(label) || "V";
}

/**
 * Checks every kept row and the supplier fields. Discarded rows aren't
 * checked and don't count as using their SKU.
 */
export function checkDraft(
  rows: DraftRow[],
  supplier: SupplierInput,
  existing: ExistingCatalog,
): DraftCheck {
  const byName = new Map<string, { id: string; name: string }>();
  for (const product of existing.products) {
    const key = normaliseName(product.name);
    if (!byName.has(key)) byName.set(key, product);
  }
  const takenSkus = new Set(existing.skus.map((sku) => sku.toUpperCase()));

  const kept = rows.filter((row) => row.keep);
  const skuUses = new Map<string, number>();
  for (const row of kept) {
    const sku = row.sku.trim().toUpperCase();
    skuUses.set(sku, (skuUses.get(sku) ?? 0) + 1);
  }

  const joiningAll = kept.length > 0 && kept.every((row) => byName.has(normaliseName(row.product)));
  const supplierCheck = parseProduct({ name: "–", ...supplier });
  const supplierErrors = supplierCheck.ok || joiningAll ? {} : supplierCheck.errors;

  const checks = new Map<string, RowCheck>();
  let ready = 0;
  for (const row of kept) {
    const errors: FieldErrors<DraftField> = {};
    const joins = byName.get(normaliseName(row.product)) ?? null;

    const product = parseProduct({ name: row.product, leadTimeDays: "1", supplierEmail: "" });
    if (!product.ok && product.errors.name) errors.product = product.errors.name;

    const variant = parseVariant(row);
    if (!variant.ok) Object.assign(errors, variant.errors);

    const sku = row.sku.trim().toUpperCase();
    if (!errors.sku) {
      if (takenSkus.has(sku)) errors.sku = "Your catalog already has this SKU.";
      else if ((skuUses.get(sku) ?? 0) > 1) errors.sku = "Another row here uses this SKU.";
    }

    checks.set(row.key, { errors, joins });
    if (Object.keys(errors).length === 0) ready++;
  }

  return { rows: checks, supplier: supplierErrors, ready, kept: kept.length };
}

/** Whether "Import" can run: something kept, and nothing wrong with it. */
export function canImport(check: DraftCheck): boolean {
  return check.kept > 0 && check.ready === check.kept && Object.keys(check.supplier).length === 0;
}

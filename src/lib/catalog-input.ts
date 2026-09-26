/**
 * Turning what someone typed into a catalogue row.
 *
 * The modals send strings, exactly as typed; this decides whether they make a
 * product or a variant, and says what's wrong, per field, when they don't. The
 * server actions run it again rather than trusting the browser's copy, which is
 * why it is plain and import-free: the same function on both sides, and
 * `node --test` without a build.
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Parsed<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

export type ProductFields = "name" | "leadTimeDays" | "supplierEmail";
export type ProductInput = Record<ProductFields, string>;
export type Product = { name: string; leadTimeDays: number; supplierEmail: string | null };

export type VariantFields = "label" | "sku" | "unitCost" | "price" | "onHand" | "minOrderQty";
export type VariantInput = Record<VariantFields, string>;
export type Variant = {
  label: string;
  sku: string;
  unitCostCents: number;
  priceCents: number;
  onHand: number;
  minOrderQty: number;
};

const MAX_NAME = 120;
const MAX_STOCK = 100_000;
/** TT$1,000,000 — well past anything a unit of clothing costs, short of overflow. */
const MAX_MONEY_CENTS = 100_000_000;
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseProduct(input: ProductInput): Parsed<Product, ProductFields> {
  const errors: FieldErrors<ProductFields> = {};

  const name = clean(input.name);
  if (!name) errors.name = "Give the product a name.";
  else if (name.length > MAX_NAME) errors.name = `Keep it under ${MAX_NAME} characters.`;

  const leadTimeDays = parseWhole(input.leadTimeDays);
  if (leadTimeDays === null || leadTimeDays < 1 || leadTimeDays > 365) {
    errors.leadTimeDays = "Lead time is a whole number of days, 1 to 365.";
  }

  const email = clean(input.supplierEmail);
  if (email && !EMAIL.test(email)) errors.supplierEmail = "That doesn't look like an email address.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, leadTimeDays: leadTimeDays as number, supplierEmail: email || null },
  };
}

export function parseVariant(input: VariantInput): Parsed<Variant, VariantFields> {
  const errors: FieldErrors<VariantFields> = {};

  const label = clean(input.label);
  if (!label) errors.label = "Name the variant — a size, a colour, or \"One size\".";
  else if (label.length > MAX_NAME) errors.label = `Keep it under ${MAX_NAME} characters.`;

  const sku = clean(input.sku).toUpperCase();
  if (!SKU.test(sku)) {
    errors.sku = "Letters, numbers, dashes, dots or underscores; up to 40.";
  }

  const unitCostCents = parseMoney(input.unitCost);
  if (unitCostCents === null) errors.unitCost = "Enter a cost in TT$, like 68 or 68.50.";

  const priceCents = parseMoney(input.price);
  if (priceCents === null) errors.price = "Enter a price in TT$, like 240 or 239.99.";

  const onHand = parseWhole(input.onHand);
  if (onHand === null || onHand > MAX_STOCK) errors.onHand = "A whole number of units, 0 or more.";

  const minOrderQty = parseWhole(input.minOrderQty);
  if (minOrderQty === null || minOrderQty < 1 || minOrderQty > 10_000) {
    errors.minOrderQty = "The supplier's smallest run, 1 or more.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      label,
      sku,
      unitCostCents: unitCostCents as number,
      priceCents: priceCents as number,
      onHand: onHand as number,
      minOrderQty: minOrderQty as number,
    },
  };
}

/** A stock count on its own, for the inline editor. */
export function parseStock(input: string): number | null {
  const value = parseWhole(input);
  return value === null || value > MAX_STOCK ? null : value;
}

/**
 * "68", "68.5", "68.50", "TT$1,250" → cents. Anything else, a negative, or
 * more than two decimal places → null. Never goes through a float, so 0.1 +
 * 0.2 can't turn into a cent off.
 */
export function parseMoney(input: string): number | null {
  const text = clean(input).replace(/^TT\$/i, "").replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > MAX_MONEY_CENTS ? null : cents;
}

/** Cents back to what the field should show: `6800` → `"68"`, `6850` → `"68.50"`. */
export function formatMoneyInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}

function parseWhole(input: string): number | null {
  const text = clean(input).replace(/,/g, "");
  if (!/^\d{1,7}$/.test(text)) return null;
  return Number(text);
}

function clean(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

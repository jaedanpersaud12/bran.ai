/**
 * Turning the New order modal's fields into an order, and a FLVS storefront
 * order into the same shape.
 *
 * The modal sends strings, exactly as typed; this decides whether they make
 * an order and says what's wrong, per field and per line, when they don't.
 * The server action runs it again rather than trusting the browser's copy.
 * Plain and import-free apart from 02's money parser, so `node --test` runs it.
 */

import { parseMoney, type FieldErrors } from "./catalog-input.ts";
import { CHANNELS, type Channel, type OrderStatus, type Payment } from "./order-status.ts";

export type OrderFields = "customerName" | "customerPhone" | "channel" | "area" | "deliveryFee" | "lines";
export type LineFields = "variantId" | "quantity" | "unitPrice";

export type LineInput = Record<LineFields, string>;
export type OrderInput = {
  customerName: string;
  customerPhone: string;
  channel: string;
  delivery: string;
  area: string;
  payment: string;
  deliveryFee: string;
  notes: string;
  lines: LineInput[];
};

export type OrderLine = { variantId: string; quantity: number; unitPriceCents: number };

export type Order = {
  customerName: string;
  customerPhone: string | null;
  channel: Channel;
  delivery: "courier" | "pickup";
  area: string | null;
  payment: Payment;
  deliveryFeeCents: number;
  notes: string | null;
  lines: OrderLine[];
};

export type ParsedOrder =
  | { ok: true; value: Order }
  | { ok: false; errors: FieldErrors<OrderFields>; lineErrors: FieldErrors<LineFields>[] };

export const MAX_LINES = 50;
const MAX_QUANTITY = 999;
const MAX_TEXT = 120;
const MAX_NOTES = 1000;
const PHONE = /^[+()\d][\d\s()+-]{5,24}$/;

export function parseOrder(input: OrderInput): ParsedOrder {
  const errors: FieldErrors<OrderFields> = {};

  const customerName = clean(input.customerName);
  if (!customerName) errors.customerName = "Who is it for? A name or an Instagram handle.";
  else if (customerName.length > MAX_TEXT) errors.customerName = `Keep it under ${MAX_TEXT} characters.`;

  const customerPhone = clean(input.customerPhone);
  if (customerPhone && !PHONE.test(customerPhone)) errors.customerPhone = "That doesn't look like a phone number.";

  const channel = CHANNELS.find((c) => c === input.channel);
  if (!channel) errors.channel = "Pick where the order came in.";

  // A pickup has nowhere to go and nothing to deliver: whatever was typed in
  // the area and fee before switching to pickup is ignored, not saved.
  const delivery = input.delivery === "pickup" ? "pickup" : "courier";
  const area = delivery === "courier" ? clean(input.area) : "";
  if (area.length > MAX_TEXT) errors.area = `Keep it under ${MAX_TEXT} characters.`;
  else if (delivery === "courier" && !area) errors.area = "Where is it going? An area is enough.";

  const payment: Payment = input.payment === "paid" ? "paid" : input.payment === "cod" ? "cod" : "unpaid";

  const fee = delivery === "courier" ? clean(input.deliveryFee) : "";
  const deliveryFeeCents = fee ? parseMoney(fee) : 0;
  if (deliveryFeeCents === null) errors.deliveryFee = "Enter a fee in TT$, like 35, or leave it blank.";

  // Lines: every row is checked, then rows for the same variant are merged.
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const lineErrors: FieldErrors<LineFields>[] = lines.map(() => ({}));
  const merged = new Map<string, OrderLine>();
  lines.forEach((raw, index) => {
    const errs = lineErrors[index];
    // A request is client input: a line that isn't an object is just an empty line.
    const line: LineInput = isRecord(raw)
      ? { variantId: String(raw.variantId ?? ""), quantity: String(raw.quantity ?? ""), unitPrice: String(raw.unitPrice ?? "") }
      : { variantId: "", quantity: "", unitPrice: "" };
    const variantId = clean(line.variantId);
    if (!variantId) errs.variantId = "Pick a variant.";
    const quantity = parseWhole(line.quantity);
    if (quantity === null || quantity < 1 || quantity > MAX_QUANTITY) errs.quantity = "1 to 999.";
    const unitPriceCents = parseMoney(line.unitPrice);
    if (unitPriceCents === null) errs.unitPrice = "A price in TT$.";
    if (Object.keys(errs).length > 0 || quantity === null || unitPriceCents === null) return;

    const existing = merged.get(variantId);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_QUANTITY) errs.quantity = "1 to 999 in total for this variant.";
    } else {
      merged.set(variantId, { variantId, quantity, unitPriceCents });
    }
  });
  if (lines.length === 0) errors.lines = "Add at least one item.";
  else if (lines.length > MAX_LINES) errors.lines = `At most ${MAX_LINES} lines.`;

  const lineProblems = lineErrors.some((e) => Object.keys(e).length > 0);
  if (Object.keys(errors).length > 0 || lineProblems || !channel || deliveryFeeCents === null) {
    return { ok: false, errors, lineErrors };
  }

  return {
    ok: true,
    value: {
      customerName,
      customerPhone: customerPhone || null,
      channel,
      delivery,
      area: area || null,
      payment,
      deliveryFeeCents,
      notes: clean(input.notes).slice(0, MAX_NOTES) || null,
      lines: [...merged.values()],
    },
  };
}

export function orderTotals(lines: { quantity: number; unitPriceCents: number }[], deliveryFeeCents: number) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  return { subtotalCents, deliveryFeeCents, totalCents: subtotalCents + deliveryFeeCents };
}

/* ------------------------------------------------------ FLVS storefront -- */

/** One line of `public.orders.items`, as the storefront writes it. */
export type FlvsItem = {
  id?: unknown;
  qty?: unknown;
  name?: unknown;
  choices?: unknown;
  unitPrice?: unknown;
};

/** The columns of `public.orders` the import reads. */
export type FlvsOrder = {
  ref: string;
  items: unknown;
  contact: unknown;
  method: string | null;
  area: string | null;
  payment: string | null;
  payment_status: string | null;
  fulfilment_status: string | null;
  delivery_fee: number | null;
  created_at: string;
};

export type FlvsLine = { key: string; name: string; choices: string; quantity: number; unitPriceCents: number };

export type MappedFlvsOrder = {
  ref: string;
  customerName: string;
  customerPhone: string | null;
  delivery: "courier" | "pickup";
  area: string | null;
  payment: Payment;
  status: OrderStatus;
  deliveryFeeCents: number;
  placedAt: string;
  lines: FlvsLine[];
};

const FLVS_STATUSES: OrderStatus[] = ["new", "packed", "shipped", "delivered", "cancelled"];

/**
 * Whether an imported order takes its lines off the shelf. Only orders still
 * waiting to go out do: one the storefront already shipped or delivered left
 * the shelf before the owner counted it into bran, and taking it again would
 * count those units twice. It still counts as a sale.
 */
export function importTakesStock(status: OrderStatus): boolean {
  return status === "new" || status === "packed";
}

/**
 * `flvs-kino` + `{ Size: "XS", Colour: "Jouvert" }` → `flvs-kino|Colour=Jouvert|Size=XS`.
 * Choices are sorted so the same variant always gives the same key.
 */
export function flvsItemKey(id: string, choices: Record<string, string>): string {
  const parts = Object.keys(choices)
    .sort()
    .map((name) => `${name}=${choices[name]}`);
  return [id, ...parts].join("|");
}

/**
 * A storefront order in bran's terms. FLVS keeps money in whole TT$; bran in
 * cents. Payment: paid when FLVS says so, cash on delivery for a cash order,
 * otherwise unpaid. A fulfilment status bran doesn't know reads as new.
 */
export function mapFlvsOrder(row: FlvsOrder): MappedFlvsOrder {
  const contact = isRecord(row.contact) ? row.contact : {};
  const items = Array.isArray(row.items) ? row.items : [];
  const lines: FlvsLine[] = [];
  for (const raw of items) {
    if (!isRecord(raw)) continue;
    const item = raw as FlvsItem;
    const id = typeof item.id === "string" ? item.id : "";
    const quantity = typeof item.qty === "number" && Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 0;
    if (!id || quantity === 0) continue;
    const choices: Record<string, string> = {};
    if (isRecord(item.choices)) {
      for (const [name, value] of Object.entries(item.choices)) {
        if (typeof value === "string") choices[name] = value;
      }
    }
    const price = typeof item.unitPrice === "number" && item.unitPrice >= 0 ? Math.round(item.unitPrice * 100) : 0;
    lines.push({
      key: flvsItemKey(id, choices),
      name: typeof item.name === "string" ? item.name : id,
      choices: Object.values(choices).join(" · "),
      quantity,
      unitPriceCents: price,
    });
  }

  const status = FLVS_STATUSES.find((s) => s === row.fulfilment_status) ?? "new";
  const payment: Payment =
    row.payment_status === "paid" ? "paid" : row.payment === "cash" ? "cod" : "unpaid";

  return {
    ref: row.ref,
    customerName: text(contact.name) || text(contact.fullName) || "Storefront customer",
    customerPhone: text(contact.phone) || null,
    delivery: row.method === "pickup" ? "pickup" : "courier",
    area: text(row.area) || text(contact.city) || null,
    payment,
    status,
    deliveryFeeCents: Math.max(0, Math.round((row.delivery_fee ?? 0) * 100)),
    placedAt: new Date(row.created_at).toISOString(),
    lines,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function clean(input: unknown): string {
  return typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
}

function parseWhole(input: string): number | null {
  const value = clean(input);
  return /^\d{1,4}$/.test(value) ? Number(value) : null;
}

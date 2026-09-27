/**
 * What an order can do next.
 *
 * Fulfilment runs one way — new, packed, shipped, delivered — and an order can
 * be cancelled until it's delivered. Payment is separate: an unpaid or
 * cash-on-delivery order can be marked paid at any point before it's
 * cancelled, delivered included, because the courier holding the cash isn't
 * the owner having it.
 *
 * The row menu asks this module what to offer; the server actions ask it
 * which statuses a change may start from, and put that in the WHERE of their
 * update, so a stale tab or a double click changes nothing. Plain and
 * import-free, so both sides share it and `node --test` runs it.
 */

export type OrderStatus = "new" | "packed" | "shipped" | "delivered" | "cancelled";
export type Payment = "paid" | "unpaid" | "cod";
export type Channel = "instagram" | "whatsapp" | "tiktok" | "in_person" | "storefront" | "other";

/** The three steps forward. Cancelling and paying are separate actions. */
export type Step = "packed" | "shipped" | "delivered";

const NEXT: Record<OrderStatus, Step | null> = {
  new: "packed",
  packed: "shipped",
  shipped: "delivered",
  delivered: null,
  cancelled: null,
};

/** The next fulfilment step, or null when there isn't one. */
export function nextStep(status: OrderStatus): Step | null {
  return NEXT[status];
}

/** The status a step has to start from. */
export function stepFrom(step: Step): OrderStatus {
  return step === "packed" ? "new" : step === "shipped" ? "packed" : "shipped";
}

/** Delivered and cancelled orders are finished; everything else is open. */
export function isOpen(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export const CANCELLABLE: OrderStatus[] = ["new", "packed", "shipped"];

export function canCancel(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}

export function canMarkPaid(status: OrderStatus, payment: Payment): boolean {
  return status !== "cancelled" && payment !== "paid";
}

/** Waiting on money: not paid yet, and not cancelled. */
export function awaitingPayment(status: OrderStatus, payment: Payment): boolean {
  return canMarkPaid(status, payment);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Pill tones (`StatusPill`), one mapping for every screen that shows an order. */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  new: "info",
  packed: "warning",
  shipped: "neutral",
  delivered: "success",
  cancelled: "neutral",
};

export const PAYMENT_TONE: Record<Payment, Tone> = { paid: "success", unpaid: "danger", cod: "warning" };

/**
 * Dates are shown in Trinidad time on the server and in the browser alike, so
 * an order placed after 8 pm doesn't render as tomorrow on a UTC server and
 * today in the browser.
 */
export const TIME_ZONE = "America/Port_of_Spain";

export const STEP_ACTION: Record<Step, string> = {
  packed: "Mark packed",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
};

export const PAYMENT_LABEL: Record<Payment, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  cod: "Cash on delivery",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram DM",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  in_person: "In person",
  storefront: "Storefront",
  other: "Other",
};

export const CHANNELS = Object.keys(CHANNEL_LABEL) as Channel[];

/** Where an order's sales say they came from (`bran.sales.source`). */
export function saleSource(channel: Channel): "dm" | "storefront" | "manual" {
  if (channel === "instagram" || channel === "whatsapp" || channel === "tiktok") return "dm";
  if (channel === "storefront") return "storefront";
  return "manual";
}

/** Open orders first, oldest first among them, then finished ones, newest first. */
export function queueOrder(
  a: { status: OrderStatus; placedAt: string },
  b: { status: OrderStatus; placedAt: string },
): number {
  const openA = isOpen(a.status);
  const openB = isOpen(b.status);
  if (openA !== openB) return openA ? -1 : 1;
  return openA ? a.placedAt.localeCompare(b.placedAt) : b.placedAt.localeCompare(a.placedAt);
}

/** `ORD-0004`. The one place a number becomes a reference. */
export function orderReference(number: number): string {
  return `ORD-${String(number).padStart(4, "0")}`;
}

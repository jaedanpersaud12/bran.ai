import "server-only";

import { sql } from "@/lib/db";
import type { Order } from "@/lib/order-input";
import {
  orderReference,
  saleSource,
  stepFrom,
  CANCELLABLE,
  type Channel,
  type OrderStatus,
  type Payment,
  type Step,
} from "@/lib/order-status";

/**
 * Customer orders: reading them, creating them, and moving them along.
 *
 * Every function takes the workspace its caller resolved from the session and
 * scopes every read and write by it. Every write is one statement — an order
 * can't exist without its lines, its stock taken and its sales counted, and a
 * cancel can't return the stock without taking the sales back out of restock.
 */

export type OrderEvent = { kind: string; at: string; by: string | null };

export type OrderLineView = {
  variantId: string;
  piece: string;
  variant: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderView = {
  id: string;
  reference: string;
  channel: Channel;
  customerName: string;
  customerPhone: string | null;
  delivery: "courier" | "pickup";
  area: string | null;
  payment: Payment;
  status: OrderStatus;
  deliveryFeeCents: number;
  subtotalCents: number;
  units: number;
  notes: string | null;
  externalRef: string | null;
  /** False for a storefront order imported after it shipped: cancelling it returns no stock. */
  tookStock: boolean;
  placedAt: string;
  lines: OrderLineView[];
  events: OrderEvent[];
};

/** Every order in the workspace with its lines and history. Three queries, whatever the count. */
export async function loadOrders(workspaceId: string): Promise<OrderView[]> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const [orders, lines, events] = await Promise.all([
    sql`
      select id, number, channel, customer_name, customer_phone, delivery, area, payment,
             status, delivery_fee_cents, notes, external_ref, placed_at, took_stock
        from bran.orders
       where workspace_id = ${workspaceId}
    `,
    sql`
      select l.order_id, l.variant_id, p.name as piece, v.label as variant, v.sku,
             l.quantity, l.unit_price_cents
        from bran.order_lines l
        join bran.orders o on o.id = l.order_id and o.workspace_id = ${workspaceId}
        join bran.variants v on v.id = l.variant_id
        join bran.products p on p.id = v.product_id
       order by p.name, v.label
    `,
    sql`
      select e.order_id, e.kind, e.at, u.name as by_name
        from bran.order_events e
        join bran.orders o on o.id = e.order_id and o.workspace_id = ${workspaceId}
        left join public."user" u on u.id = e.by_user
       order by e.at, e.id
    `,
  ]);

  const linesBy = new Map<string, OrderLineView[]>();
  for (const row of lines as LineRow[]) {
    const list = linesBy.get(row.order_id) ?? [];
    list.push({
      variantId: row.variant_id,
      piece: row.piece,
      variant: row.variant,
      sku: row.sku,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
    });
    linesBy.set(row.order_id, list);
  }
  const eventsBy = new Map<string, OrderEvent[]>();
  for (const row of events as EventRow[]) {
    const list = eventsBy.get(row.order_id) ?? [];
    list.push({ kind: row.kind, at: new Date(row.at).toISOString(), by: row.by_name });
    eventsBy.set(row.order_id, list);
  }

  return (orders as OrderRow[]).map((row) => {
    const orderLines = linesBy.get(row.id) ?? [];
    return {
      id: row.id,
      reference: orderReference(row.number),
      channel: row.channel,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      delivery: row.delivery,
      area: row.area,
      payment: row.payment,
      status: row.status,
      deliveryFeeCents: row.delivery_fee_cents,
      subtotalCents: orderLines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0),
      units: orderLines.reduce((sum, line) => sum + line.quantity, 0),
      notes: row.notes,
      externalRef: row.external_ref,
      tookStock: row.took_stock,
      placedAt: new Date(row.placed_at).toISOString(),
      lines: orderLines,
      events: eventsBy.get(row.id) ?? [],
    };
  });
}

type OrderRow = {
  id: string;
  number: number;
  channel: Channel;
  customer_name: string;
  customer_phone: string | null;
  delivery: "courier" | "pickup";
  area: string | null;
  payment: Payment;
  status: OrderStatus;
  delivery_fee_cents: number;
  notes: string | null;
  external_ref: string | null;
  placed_at: string;
  took_stock: boolean;
};
type LineRow = {
  order_id: string;
  variant_id: string;
  piece: string;
  variant: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
};
type EventRow = { order_id: string; kind: string; at: string; by_name: string | null };

/* ------------------------------------------------------------ Creating -- */

export type CreateResult = { ok: true; reference: string } | { ok: false; error: string };

export type CreateOptions = {
  /** When the customer ordered; sales land on this day. Defaults to now. */
  placedAt?: string;
  /** An imported order keeps the status its source gave it. */
  status?: OrderStatus;
  /**
   * Whether the order takes its lines off the shelf. Defaults to yes for an
   * order that isn't cancelled. The storefront import says no for orders that
   * had already shipped: their units left before the shelf was counted.
   */
  takesStock?: boolean;
  external?: { source: string; ref: string };
};

/** Two creates racing for the same number: the loser takes the next one. */
const ATTEMPTS = 3;

/**
 * Creates an order, takes its lines off the shelf and counts them as sales.
 *
 * Shared by the New order modal, the storefront import and, later, the DM
 * bot. The variant ids are the only thing trusted from the caller: each is
 * looked up in this workspace, so another workspace's id isn't found, and an
 * archived variant or a line for more than is on the shelf is refused with
 * its name before anything is written. The shelf's own `on_hand >= 0` check
 * is the backstop for two orders racing for the last units.
 */
export async function createOrder(
  workspaceId: string,
  userId: string | null,
  order: Order,
  options: CreateOptions = {},
): Promise<CreateResult> {
  if (!sql) return { ok: false, error: "The database isn't configured." };
  if (order.lines.length === 0) return { ok: false, error: "Add at least one item." };

  const ids = order.lines.map((line) => line.variantId);
  let known: VariantRow[];
  try {
    known = await variantsFor(workspaceId, ids);
  } catch (error) {
    console.error("createOrder: loading variants failed", error);
    return { ok: false, error: "Couldn't read your catalogue. Try again." };
  }
  const status = options.status ?? "new";
  // A cancelled order never took anything off the shelf or sold anything.
  const countsSale = status !== "cancelled";
  const takesStock = countsSale && (options.takesStock ?? true);
  // Only an order that takes stock can be short of it; one that doesn't still
  // needs every line to be this workspace's variant.
  const problem = takesStock ? checkStock(order.lines, known) : checkKnown(order.lines, known);
  if (problem) return { ok: false, error: problem };

  const quantities = order.lines.map((line) => line.quantity);
  const prices = order.lines.map((line) => line.unitPriceCents);
  const placedAt = options.placedAt ?? new Date().toISOString();
  const source = saleSource(order.channel);
  const event = options.external ? "imported" : "created";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const rows = await sql`
        with created as (
          insert into bran.orders
            (workspace_id, number, channel, customer_name, customer_phone, delivery, area,
             payment, status, delivery_fee_cents, notes, external_source, external_ref,
             placed_at, created_by, took_stock)
          select ${workspaceId}, coalesce(max(number), 0) + 1, ${order.channel},
                 ${order.customerName}, ${order.customerPhone}, ${order.delivery}, ${order.area},
                 ${order.payment}, ${status}, ${order.deliveryFeeCents}, ${order.notes},
                 ${options.external?.source ?? null}, ${options.external?.ref ?? null},
                 ${placedAt}, ${userId}, ${takesStock}
            from bran.orders
           where workspace_id = ${workspaceId}
          returning id, number
        ), lines as (
          insert into bran.order_lines (order_id, variant_id, quantity, unit_price_cents)
          select created.id, t.variant_id, t.quantity, t.price
            from created,
                 unnest(${ids}::uuid[], ${quantities}::int[], ${prices}::int[])
                   as t(variant_id, quantity, price)
          returning variant_id
        ), shelf as (
          update bran.variants v
             set on_hand = v.on_hand - t.quantity
            from unnest(${ids}::uuid[], ${quantities}::int[]) as t(variant_id, quantity)
           where ${takesStock} and v.id = t.variant_id and v.workspace_id = ${workspaceId}
          returning v.id
        ), sold as (
          insert into bran.sales (workspace_id, variant_id, quantity, sold_at, source, order_id)
          select ${workspaceId}, t.variant_id, t.quantity, ${placedAt}, ${source}, created.id
            from created,
                 unnest(${ids}::uuid[], ${quantities}::int[]) as t(variant_id, quantity)
           where ${countsSale}
          returning id
        ), logged as (
          insert into bran.order_events (order_id, kind, by_user)
          select id, ${event}, ${userId} from created
          returning id
        )
        select number from created
      `;
      return { ok: true, reference: orderReference((rows[0] as { number: number }).number) };
    } catch (error) {
      const code = errorCode(error);
      if (code === "23505" && isConstraint(error, "external")) {
        return { ok: false, error: "That order has already been imported." };
      }
      if (code === "23505" && attempt < ATTEMPTS) continue;
      if (code === "23514" && isConstraint(error, "on_hand")) {
        // Someone else took the last units between the check and the write.
        const again = checkStock(order.lines, await variantsFor(workspaceId, ids).catch(() => known));
        return { ok: false, error: again ?? "There isn't enough stock for that order any more." };
      }
      console.error("createOrder: insert failed", error);
      return { ok: false, error: "Couldn't save the order. Try again." };
    }
  }
  return { ok: false, error: "Couldn't save the order. Try again." };
}

type VariantRow = { id: string; piece: string; label: string; on_hand: number; archived: boolean };

async function variantsFor(workspaceId: string, ids: string[]): Promise<VariantRow[]> {
  if (!sql) return [];
  return (await sql`
    select v.id, p.name as piece, v.label, v.on_hand, v.archived_at is not null as archived
      from bran.variants v
      join bran.products p on p.id = v.product_id
     where v.workspace_id = ${workspaceId} and v.id = any(${ids}::uuid[])
  `) as VariantRow[];
}

/** Every line is one of this workspace's variants, or the owner is told otherwise. */
function checkKnown(lines: Order["lines"], known: VariantRow[]): string | null {
  const ids = new Set(known.map((row) => row.id));
  return lines.every((line) => ids.has(line.variantId)) ? null : "Some of those items aren't in your catalogue.";
}

/** The first problem with the order's lines against the shelf, in the owner's words, or null. */
function checkStock(lines: Order["lines"], known: VariantRow[]): string | null {
  const byId = new Map(known.map((row) => [row.id, row]));
  for (const line of lines) {
    const row = byId.get(line.variantId);
    if (!row) return "Some of those items aren't in your catalogue.";
    if (row.archived) return `${row.piece}, ${row.label} is archived. Restore it in the catalogue first.`;
    if (row.on_hand < line.quantity) {
      return row.on_hand === 0
        ? `${row.piece}, ${row.label} is out of stock.`
        : `Only ${row.on_hand} of ${row.piece}, ${row.label} on hand — the order asks for ${line.quantity}.`;
    }
  }
  return null;
}

/* ------------------------------------------------------------- Changes -- */

export type ChangeResult = { ok: true } | { ok: false; error: string };

const STALE: ChangeResult = {
  ok: false,
  error: "That order has changed since you opened it. Reload to see where it is.",
};

/**
 * Packed, shipped, delivered: one guarded update from the status before it,
 * with its history row. A stale tab or a double click matches nothing.
 */
export async function advanceOrder(
  workspaceId: string,
  userId: string | null,
  orderId: string,
  step: Step,
): Promise<ChangeResult> {
  return change("advanceOrder", () => sql!`
    with moved as (
      update bran.orders set status = ${step}
       where id = ${orderId}::uuid and workspace_id = ${workspaceId} and status = ${stepFrom(step)}
      returning id
    ), logged as (
      insert into bran.order_events (order_id, kind, by_user)
      select id, ${step}, ${userId} from moved
      returning id
    )
    select id from moved
  `);
}

export async function markOrderPaid(
  workspaceId: string,
  userId: string | null,
  orderId: string,
): Promise<ChangeResult> {
  return change("markOrderPaid", () => sql!`
    with paid as (
      update bran.orders set payment = 'paid'
       where id = ${orderId}::uuid and workspace_id = ${workspaceId}
         and status <> 'cancelled' and payment <> 'paid'
      returning id
    ), logged as (
      insert into bran.order_events (order_id, kind, by_user)
      select id, 'paid', ${userId} from paid
      returning id
    )
    select id from paid
  `);
}

/**
 * Cancelling puts every line back on the shelf and takes its sales out of
 * restock, in the same statement as the status change. The status guard
 * makes a second cancel a no-op rather than double stock.
 */
export async function cancelCustomerOrder(
  workspaceId: string,
  userId: string | null,
  orderId: string,
): Promise<ChangeResult> {
  return change("cancelCustomerOrder", () => sql!`
    with cancelled as (
      update bran.orders set status = 'cancelled'
       where id = ${orderId}::uuid and workspace_id = ${workspaceId}
         and status = any(${CANCELLABLE}::text[])
      returning id, took_stock
    ), restocked as (
      update bran.variants v
         set on_hand = v.on_hand + l.quantity
        from bran.order_lines l, cancelled c
       where l.order_id = c.id and c.took_stock
         and v.id = l.variant_id and v.workspace_id = ${workspaceId}
      returning v.id
    ), unsold as (
      delete from bran.sales s
       using cancelled c
       where s.order_id = c.id and s.workspace_id = ${workspaceId}
      returning s.id
    ), logged as (
      insert into bran.order_events (order_id, kind, by_user)
      select id, 'cancelled', ${userId} from cancelled
      returning id
    )
    select id from cancelled
  `);
}

async function change(where: string, run: () => Promise<unknown[]>): Promise<ChangeResult> {
  if (!sql) return { ok: false, error: "The database isn't configured." };
  try {
    const rows = await run();
    return rows.length > 0 ? { ok: true } : STALE;
  } catch (error) {
    // A malformed id reaches Postgres as a failed uuid cast; it's the same as not found.
    if (errorCode(error) === "22P02") return STALE;
    console.error(`${where} failed`, error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : null;
}

function isConstraint(error: unknown, fragment: string): boolean {
  const name =
    typeof error === "object" && error !== null && "constraint" in error ? String(error.constraint) : "";
  return name.includes(fragment);
}

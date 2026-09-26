"use server";

import { revalidatePath } from "next/cache";
import { callOptions, model } from "@/lib/ai/model";
import { runAI } from "@/lib/ai/run";
import { sql } from "@/lib/db";
import { loadInventory } from "@/lib/inventory";
import {
  assemble,
  groupBySupplier,
  templateProse,
  writeProse,
  type SupplierEmail,
} from "@/lib/po-email";
import { formatReference, loadPurchaseOrderLines } from "@/lib/purchase-orders";
import { currentWorkspace } from "@/lib/workspace";

export type DraftLine = { variantId: string; quantity: number };

export type DraftResult = { ok: true; reference: string } | { ok: false; error: string };

const MAX_QUANTITY = 999;
const MAX_LINES = 500;
/** Two drafts racing for the same number: the loser takes the next one. */
const ATTEMPTS = 3;

/**
 * Saves a purchase order as a draft. Nothing is sent to a supplier.
 *
 * The client sends variant ids and quantities and nothing else. The workspace
 * comes from the session, and the unit costs and the model's suggestions are
 * read fresh from the workspace's own inventory — so a line for another
 * workspace's variant simply isn't found, and the recorded suggestion is what
 * restock actually said, not what the browser claims it said.
 */
export async function draftPurchaseOrder(lines: DraftLine[]): Promise<DraftResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: "Sign in to draft a purchase order." };
  if (!sql) return { ok: false, error: "The database isn't configured." };

  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    return { ok: false, error: "Pick at least one line to order." };
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (
      typeof line?.variantId !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: `Each line needs a quantity from 1 to ${MAX_QUANTITY}.` };
    }
    if (seen.has(line.variantId)) return { ok: false, error: "A line appears twice." };
    seen.add(line.variantId);
  }

  const workspaceId = current.workspace.id;
  let inventory;
  try {
    inventory = await loadInventory(workspaceId);
  } catch (error) {
    console.error("draftPurchaseOrder: loading inventory failed", error);
    return { ok: false, error: "Couldn't read inventory. Try again." };
  }
  const byId = new Map(inventory.lines.map((line) => [line.variantId, line]));
  const known = lines.map((line) => byId.get(line.variantId));
  if (known.some((line) => line === undefined)) {
    return { ok: false, error: "Some of those lines aren't in this workspace." };
  }

  const ids = lines.map((line) => line.variantId);
  const quantities = lines.map((line) => line.quantity);
  const suggested = known.map((line) => line?.score.suggested ?? 0);
  const costs = known.map((line) => line?.unitCostCents ?? 0);

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      // One statement, so the order and its lines land together or not at all.
      const rows = await sql`
        with po as (
          insert into bran.purchase_orders (workspace_id, number, created_by)
          select ${workspaceId}, coalesce(max(number), 0) + 1, ${current.user?.id ?? null}
            from bran.purchase_orders
           where workspace_id = ${workspaceId}
          returning id, number
        ), added as (
          insert into bran.purchase_order_lines
            (purchase_order_id, variant_id, quantity, suggested_quantity, unit_cost_cents)
          select po.id, t.variant_id, t.quantity, t.suggested, t.cost
            from po,
                 unnest(${ids}::uuid[], ${quantities}::int[], ${suggested}::int[], ${costs}::int[])
                   as t(variant_id, quantity, suggested, cost)
          returning 1
        )
        select number from po
      `;
      const number = (rows[0] as { number: number }).number;
      return { ok: true, reference: formatReference(number) };
    } catch (error) {
      if (isUniqueViolation(error) && attempt < ATTEMPTS) continue;
      console.error("draftPurchaseOrder: insert failed", error);
      return { ok: false, error: "Couldn't save the draft. Try again." };
    }
  }
  return { ok: false, error: "Couldn't save the draft. Try again." };
}


function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/* ------------------------------------------------------------- Lifecycle -- */

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Each transition is one guarded update: `where status = <from>`, scoped to
 * the session's workspace. A stale tab, a double click or another workspace's
 * id matches nothing and changes nothing.
 */
export async function markSent(orderId: string): Promise<TransitionResult> {
  return transition(orderId, async (ws) => sql!`
    update bran.purchase_orders set status = 'sent', sent_at = now()
     where id = ${orderId}::uuid and workspace_id = ${ws} and status = 'draft'
    returning id
  `);
}

export async function cancelOrder(orderId: string): Promise<TransitionResult> {
  return transition(orderId, async (ws) => sql!`
    update bran.purchase_orders set status = 'cancelled'
     where id = ${orderId}::uuid and workspace_id = ${ws} and status in ('draft', 'sent')
    returning id
  `);
}

/**
 * Receiving adds every line to stock. One statement, so the order can't read
 * "received" without the stock having arrived, or the other way round — and
 * the status guard makes a second receive a no-op instead of double stock.
 */
export async function markReceived(orderId: string): Promise<TransitionResult> {
  return transition(orderId, async (ws) => sql!`
    with received as (
      update bran.purchase_orders set status = 'received', received_at = now()
       where id = ${orderId}::uuid and workspace_id = ${ws} and status = 'sent'
      returning id
    ), stocked as (
      update bran.variants v
         set on_hand = v.on_hand + l.quantity
        from bran.purchase_order_lines l, received r
       where l.purchase_order_id = r.id
         and v.id = l.variant_id
         and v.workspace_id = ${ws}
      returning v.id
    )
    select id from received
  `);
}

async function transition(
  orderId: string,
  run: (workspaceId: string) => Promise<Record<string, unknown>[]>,
): Promise<TransitionResult> {
  const current = await currentWorkspace();
  if (!current || !sql) return { ok: false, error: "Sign in to change orders." };
  try {
    const rows = await run(current.workspace.id);
    if (rows.length === 0) {
      return { ok: false, error: "That order has already moved on, or isn't in this workspace." };
    }
  } catch (error) {
    // A malformed id fails the uuid cast: the same as not found.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "22P02") {
      return { ok: false, error: "That order isn't in this workspace." };
    }
    console.error("purchase order transition failed", error);
    return { ok: false, error: "Couldn't update the order. Try again." };
  }
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory");
  return { ok: true };
}

/* ---------------------------------------------------------- Supplier email -- */

export type EmailsResult = { ok: true; emails: SupplierEmail[] } | { ok: false; error: string };

/**
 * One email per supplier on the order. AI writes each subject, opening and
 * closing; the line list is always bran's. Any group whose AI prose is
 * missing or fails the checks gets the plain template instead, unmarked.
 */
export async function draftSupplierEmails(orderId: string): Promise<EmailsResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: "Sign in to draft emails." };

  let order;
  try {
    order = await loadPurchaseOrderLines(current.workspace.id, orderId);
  } catch (error) {
    console.error("draftSupplierEmails: load failed", error);
    return { ok: false, error: "Couldn't read that order." };
  }
  if (!order) return { ok: false, error: "That order isn't in this workspace." };

  const groups = groupBySupplier(order.lines);
  const emails = await Promise.all(
    groups.map(async (group) => {
      const context = {
        reference: order.reference,
        brand: current.workspace.name,
        leadTimeDays: Math.max(
          ...order.lines
            .filter((line) => group.lines.some((g) => g.sku === line.sku))
            .map((line) => line.leadTimeDays),
        ),
      };
      const prose = await runAI({
        feature: "po-email",
        workspaceId: current.workspace.id,
        call: async (signal) => {
          const result = await writeProse({
            model: model(),
            context,
            group,
            abortSignal: signal,
            providerOptions: callOptions.providerOptions,
          });
          return { value: result.prose, usage: result.usage };
        },
      });
      return prose
        ? assemble(prose, group, true)
        : assemble(templateProse(context), group, false);
    }),
  );
  return { ok: true, emails };
}


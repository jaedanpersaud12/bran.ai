"use server";

import { revalidatePath } from "next/cache";
import { callOptions, model } from "@/lib/ai/model";
import { runAI } from "@/lib/ai/run";
import { sql } from "@/lib/db";
import {
  assemble,
  groupBySupplier,
  templateProse,
  writeProse,
  type SupplierEmail,
} from "@/lib/po-email";
import {
  createDraftOrder,
  loadPurchaseOrderLines,
  type DraftLine,
  type DraftResult,
} from "@/lib/purchase-orders";
import { currentWorkspace } from "@/lib/workspace";

export type { DraftLine, DraftResult } from "@/lib/purchase-orders";

/** The planner's and the card's draft: the workspace and user come from the session. */
export async function draftPurchaseOrder(lines: DraftLine[]): Promise<DraftResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: "Sign in to draft a purchase order." };
  const result = await createDraftOrder(current.workspace.id, current.user?.id ?? null, lines);
  if (result.ok) revalidatePath("/inventory/purchase-orders");
  return result;
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


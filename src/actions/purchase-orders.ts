"use server";

import { sql } from "@/lib/db";
import { loadInventory } from "@/lib/inventory";
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

/** `PO-0002`. */
function formatReference(number: number): string {
  return `PO-${String(number).padStart(4, "0")}`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

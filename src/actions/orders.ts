"use server";

import { revalidatePath } from "next/cache";
import type { FieldErrors } from "@/lib/catalog-input";
import { parseOrder, type LineFields, type OrderFields, type OrderInput } from "@/lib/order-input";
import { nextStep, type OrderStatus, type Step } from "@/lib/order-status";
import {
  advanceOrder,
  cancelCustomerOrder,
  createOrder,
  markOrderPaid,
  type ChangeResult,
} from "@/lib/orders";
import {
  importFlvsOrders,
  isFlvsWorkspace,
  linkFlvsItem,
  loadFlvsPreview,
  type PreviewOrder,
} from "@/lib/storefront-flvs";
import { currentWorkspace } from "@/lib/workspace";

/**
 * Order writes from the Orders screen.
 *
 * Every action resolves the workspace from the session; the order id or the
 * variant ids in a request are only ever looked up inside it. Input is
 * re-parsed here with the same function the modal used.
 */

export type CreateOrderResult =
  | { ok: true; reference: string }
  | {
      ok: false;
      message?: string;
      errors?: FieldErrors<OrderFields>;
      lineErrors?: FieldErrors<LineFields>[];
    };

const SIGNED_OUT = "Sign in to manage orders.";

export async function createOrderAction(input: OrderInput): Promise<CreateOrderResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, message: SIGNED_OUT };

  const parsed = parseOrder({ ...input, lines: Array.isArray(input?.lines) ? input.lines : [] });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, lineErrors: parsed.lineErrors };

  const result = await createOrder(current.workspace.id, current.user?.id ?? null, parsed.value);
  if (!result.ok) return { ok: false, message: result.error };
  refresh();
  return result;
}

/** Moves an order one step: the step is worked out from the status the screen showed. */
export async function advanceOrderAction(orderId: string, from: OrderStatus): Promise<ChangeResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  const step: Step | null = nextStep(from);
  if (!step) return { ok: false, error: "That order has nowhere further to go." };
  const result = await advanceOrder(current.workspace.id, current.user?.id ?? null, orderId, step);
  if (result.ok) refresh();
  return result;
}

export async function markPaidAction(orderId: string): Promise<ChangeResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  const result = await markOrderPaid(current.workspace.id, current.user?.id ?? null, orderId);
  if (result.ok) refresh();
  return result;
}

export async function cancelOrderAction(orderId: string): Promise<ChangeResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  const result = await cancelCustomerOrder(current.workspace.id, current.user?.id ?? null, orderId);
  if (result.ok) refresh();
  return result;
}

/* ------------------------------------------------------ FLVS storefront -- */

export type PreviewResult = { ok: true; orders: PreviewOrder[] } | { ok: false; error: string };
export type ImportResult =
  | { ok: true; imported: string[]; skipped: { ref: string; error: string }[] }
  | { ok: false; error: string };

const NOT_FLVS = "Storefront import is only set up for the FLVS workspace.";

/** Reads the storefront's orders not yet imported. Reads `public.orders`; writes nothing. */
export async function previewStorefrontImport(): Promise<PreviewResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  if (!isFlvsWorkspace(current.workspace.slug)) return { ok: false, error: NOT_FLVS };
  try {
    return { ok: true, orders: await loadFlvsPreview(current.workspace.id) };
  } catch (error) {
    console.error("previewStorefrontImport failed", error);
    return { ok: false, error: "Couldn't read the storefront's orders. Try again." };
  }
}

export async function linkStorefrontItem(itemKey: string, variantId: string): Promise<{ ok: boolean; error?: string }> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  if (!isFlvsWorkspace(current.workspace.slug)) return { ok: false, error: NOT_FLVS };
  if (typeof itemKey !== "string" || itemKey.length === 0 || itemKey.length > 500) {
    return { ok: false, error: "That item can't be matched." };
  }
  try {
    const linked = await linkFlvsItem(current.workspace.id, itemKey, variantId);
    return linked ? { ok: true } : { ok: false, error: "That variant isn't in this workspace." };
  } catch (error) {
    console.error("linkStorefrontItem failed", error);
    return { ok: false, error: "Couldn't save the match. Try again." };
  }
}

export async function importStorefrontOrders(refs: string[]): Promise<ImportResult> {
  const current = await currentWorkspace();
  if (!current) return { ok: false, error: SIGNED_OUT };
  if (!isFlvsWorkspace(current.workspace.slug)) return { ok: false, error: NOT_FLVS };
  const chosen = Array.isArray(refs) ? refs.filter((ref) => typeof ref === "string").slice(0, 200) : [];
  if (chosen.length === 0) return { ok: false, error: "Tick at least one order to import." };
  try {
    const outcomes = await importFlvsOrders(current.workspace.id, current.user?.id ?? null, chosen);
    const imported = outcomes.filter((o) => o.result.ok).map((o) => o.ref);
    const skipped = outcomes.flatMap((o) => (o.result.ok ? [] : [{ ref: o.ref, error: o.result.error }]));
    if (imported.length > 0) refresh();
    return { ok: true, imported, skipped };
  } catch (error) {
    console.error("importStorefrontOrders failed", error);
    return { ok: false, error: "Couldn't import. Try again." };
  }
}

function refresh(): void {
  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/inventory/catalog");
}

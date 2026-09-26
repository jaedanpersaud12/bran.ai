import "server-only";

import { createHmac } from "node:crypto";
import { isStepCount, tool, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import { z } from "zod";
import { callOptions, model } from "@/lib/ai/model";
import { logRun } from "@/lib/ai/run";
import { loadCatalog, setVariantStock, type CatalogRow } from "@/lib/catalog";
import { loadInventory } from "@/lib/inventory";
import { createDraftOrder, loadPurchaseOrders } from "@/lib/purchase-orders";

/**
 * Ask bran: an agent over one workspace's own data.
 *
 * Built per request, so every tool closes over the workspace the route
 * resolved from the session — nothing in the conversation can point a tool
 * at another workspace. Reads run freely; the two writes (drafting a purchase
 * order, setting a stock count) stop for the owner's approval, and the
 * approval request carries a summary bran computed from the database, not
 * one the model wrote.
 */

export type AssistantContext = {
  workspaceId: string;
  workspaceName: string;
  userId: string | null;
};

/**
 * Signs approval requests so a crafted request can't approve itself: with
 * `useChat` the history is client input (AI SDK docs, "Tool Approvals →
 * Trust model"). `TOOL_APPROVAL_SECRET` when set; otherwise derived from the
 * auth secret, so there's always one and it's never a constant in the code.
 */
export function approvalSecret(): string | null {
  if (process.env.TOOL_APPROVAL_SECRET) return process.env.TOOL_APPROVAL_SECRET;
  const auth = process.env.BETTER_AUTH_SECRET;
  return auth ? createHmac("sha256", auth).update("bran:tool-approval:v1").digest("base64") : null;
}

const MAX_STEPS = 8;

function instructions(context: AssistantContext): string {
  const today = new Intl.DateTimeFormat("en-TT", { dateStyle: "full" }).format(new Date());
  return `You are bran, the back-office assistant for ${context.workspaceName}, a small Caribbean clothing brand. Today is ${today}.
You help the owner with stock, restock and purchase orders, using only the tools provided.
- Every number you state must come from a tool result in this conversation. If you don't have it, look it up or say you don't know.
- Restock's verdicts and suggested quantities come from a formula; report them as restock's, don't second-guess them.
- When the owner asks you to draft an order or set a count, call draftPurchaseOrder or setStock straight away — don't ask "shall I?" in text first. The owner is shown an approval card with bran's own summary, and nothing happens until they approve it; that card is the confirmation.
- For an order, use restock's suggested quantities unless the owner gave different ones.
- If the owner doesn't approve an action, don't retry it; ask what they'd like instead.
- Be brief and plain. Money is TT$. Use short lists, not tables.`;
}

/** Lower-cased words, punctuation and separators like "·" and "-" dropped. */
function searchWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const tt = (cents: number) =>
  `TT$${(cents / 100).toLocaleString("en-TT", { maximumFractionDigits: 2 })}`;

export function makeAssistant(context: AssistantContext, secret: string) {
  const started = Date.now();
  const { workspaceId } = context;

  /** The workspace's active variants by id, loaded once per request when a tool needs them. */
  let catalog: Promise<Map<string, CatalogRow>> | null = null;
  const variants = () =>
    (catalog ??= loadCatalog(workspaceId).then(
      (rows) => new Map(rows.filter((row) => !row.archived).map((row) => [row.variantId, row])),
    ));

  const orderLines = z
    .array(
      z.object({
        variantId: z.string().describe("A variantId from getRestock or findVariants"),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50);

  return new ToolLoopAgent({
    model: model(),
    instructions: instructions(context),
    providerOptions: callOptions.providerOptions,
    stopWhen: isStepCount(MAX_STEPS),
    experimental_toolApprovalSecret: secret,
    tools: {
      getRestock: tool({
        description:
          "Restock's current verdict for every active variant: reorder, watch or hold, with stock, units on order, days of cover, sales per day and the suggested order quantity.",
        inputSchema: z.object({
          verdict: z.enum(["reorder", "watch", "hold", "all"]).default("all"),
        }),
        execute: async ({ verdict }) => {
          const { lines, summary } = await loadInventory(workspaceId);
          return {
            summary: {
              linesToReorder: summary.flagged,
              unitsToOrder: summary.units,
              costToOrder: tt(summary.costCents),
              salesAtRisk: tt(summary.atRiskCents),
            },
            lines: lines
              .filter((line) => verdict === "all" || line.score.verdict === verdict)
              .map((line) => ({
                variantId: line.variantId,
                piece: `${line.name}, ${line.variant}`,
                sku: line.sku,
                verdict: line.score.verdict,
                onHand: line.onHand,
                onOrder: line.onOrder,
                daysOfCover: line.score.cover === null ? null : Math.round(line.score.cover),
                soldPerDay: Number(line.score.pace.toFixed(1)),
                suggestedOrder: line.score.suggested,
                unitCost: tt(line.unitCostCents),
              })),
          };
        },
      }),

      findVariants: tool({
        description: "Search the catalogue by product name, variant or SKU.",
        inputSchema: z.object({ query: z.string().min(1).max(60) }),
        execute: async ({ query }) => {
          // Word by word, ignoring punctuation: "flame s" has to find
          // "Flame · S", and "black small" shouldn't need the SKU.
          const words = searchWords(query);
          const found = [...(await variants()).values()]
            .filter((row) => {
              const haystack = searchWords(`${row.product} ${row.label} ${row.sku}`);
              return words.every((word) => haystack.some((token) => token.startsWith(word)));
            })
            .slice(0, 20);
          return found.map((row) => ({
            variantId: row.variantId,
            piece: `${row.product}, ${row.label}`,
            sku: row.sku,
            onHand: row.onHand,
            unitCost: tt(row.unitCostCents),
            price: tt(row.priceCents),
          }));
        },
      }),

      listPurchaseOrders: tool({
        description: "The workspace's ten most recent purchase orders and their status.",
        inputSchema: z.object({}),
        execute: async () =>
          (await loadPurchaseOrders(workspaceId)).slice(0, 10).map((order) => ({
            reference: order.reference,
            status: order.status,
            lines: order.lines,
            units: order.units,
            cost: tt(order.costCents),
          })),
      }),

      draftPurchaseOrder: tool({
        description:
          "Draft a purchase order. Needs the owner's approval. Nothing is sent to a supplier.",
        inputSchema: z.object({ lines: orderLines }),
        execute: async ({ lines }) => {
          const result = await createDraftOrder(workspaceId, context.userId, lines);
          return result.ok
            ? { drafted: result.reference, link: `/inventory/purchase-orders?open=${result.reference}` }
            : { error: result.error };
        },
      }),

      setStock: tool({
        description: "Set a variant's counted stock on hand. Needs the owner's approval.",
        inputSchema: z.object({
          variantId: z.string(),
          onHand: z.number().int().min(0).max(100_000),
        }),
        execute: async ({ variantId, onHand }) => {
          const row = (await variants()).get(variantId);
          if (!row) return { error: "That variant isn't in this workspace." };
          const changed = await setVariantStock(workspaceId, variantId, onHand);
          return changed
            ? { piece: `${row.product}, ${row.label}`, was: row.onHand, now: onHand }
            : { error: "That variant isn't in this workspace." };
        },
      }),
    },

    // The owner approves writes against bran's own summary of them. A line
    // that isn't this workspace's is refused before anyone is asked.
    toolApproval: {
      draftPurchaseOrder: async ({ lines }) => {
        const known = await variants();
        const rows = lines.map((line) => ({ line, row: known.get(line.variantId) }));
        if (rows.some(({ row }) => !row)) {
          return { type: "denied", reason: "Some of those variants aren't in this workspace." };
        }
        const units = lines.reduce((sum, line) => sum + line.quantity, 0);
        const cost = rows.reduce((sum, { line, row }) => sum + line.quantity * (row?.unitCostCents ?? 0), 0);
        const list = rows
          .map(({ line, row }) => `${row?.product}, ${row?.label} × ${line.quantity}`)
          .join("; ");
        return {
          type: "user-approval",
          reason: `Draft a purchase order: ${list}. ${units} units, ${tt(cost)} at cost. Nothing is sent to the supplier.`,
        };
      },
      setStock: async ({ variantId, onHand }) => {
        const row = (await variants()).get(variantId);
        if (!row) return { type: "denied", reason: "That variant isn't in this workspace." };
        return {
          type: "user-approval",
          reason: `Set ${row.product}, ${row.label} on hand from ${row.onHand} to ${onHand}.`,
        };
      },
    },

    onEnd: async (event) => {
      await logRun({
        feature: "assistant",
        workspaceId,
        ok: true,
        usage: {
          inputTokens: event.totalUsage.inputTokens,
          outputTokens: event.totalUsage.outputTokens,
        },
        ms: Date.now() - started,
      });
    },
  });
}

export type AssistantMessage = InferAgentUIMessage<ReturnType<typeof makeAssistant>>;


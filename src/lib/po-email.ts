/**
 * Supplier emails for a purchase order.
 *
 * AI writes the words; bran writes the numbers. The model is asked for a
 * subject, an opening and a closing — the parts where tone matters — and bran
 * puts the line list between them from the database. So a quantity, a price
 * or a piece name in the email can only ever be the one on the order.
 *
 * Pure and import-light (only `ai` and `zod`), so `node --test` runs it with a
 * mock model.
 */

import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

export type EmailLine = {
  piece: string;
  variant: string;
  sku: string;
  quantity: number;
  unitCostCents: number;
  supplierEmail: string | null;
};

export type EmailContext = {
  reference: string;
  brand: string;
  /** Longest lead time among the group's products, for "needed by". */
  leadTimeDays: number;
};

export type SupplierGroup = { supplierEmail: string | null; lines: EmailLine[] };

export type SupplierEmail = {
  supplierEmail: string | null;
  subject: string;
  body: string;
  /** Whether the subject, opening and closing were written by AI. */
  aiWritten: boolean;
};

/** One group per supplier; lines without a supplier email share the last group. */
export function groupBySupplier(lines: EmailLine[]): SupplierGroup[] {
  const groups = new Map<string | null, EmailLine[]>();
  for (const line of lines) {
    const key = line.supplierEmail?.trim().toLowerCase() || null;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([supplierEmail, grouped]) => ({ supplierEmail, lines: grouped }));
}

/** The line list, always from the order itself. */
export function lineList(lines: EmailLine[]): string {
  const rows = lines.map(
    (line) =>
      `- ${line.piece}, ${line.variant} (${line.sku}) × ${line.quantity} at ${money(line.unitCostCents)} each`,
  );
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0);
  return `${rows.join("\n")}\n\n${units} units, ${money(total)} at the prices above.`;
}

export type Prose = { subject: string; opening: string; closing: string };

/** The words with no model: plain, correct, and not marked as AI. */
export function templateProse(context: EmailContext): Prose {
  return {
    subject: `Purchase order ${context.reference} from ${context.brand}`,
    opening: `Hi,\n\nPlease find our purchase order ${context.reference} below. Could you confirm the quantities and let us know when it will be ready?`,
    closing: `We'd like it within ${context.leadTimeDays} days if possible. Thanks,\n${context.brand}`,
  };
}

export function assemble(prose: Prose, group: SupplierGroup, aiWritten: boolean): SupplierEmail {
  return {
    supplierEmail: group.supplierEmail,
    subject: prose.subject,
    body: `${prose.opening}\n\n${lineList(group.lines)}\n\n${prose.closing}`,
    aiWritten,
  };
}

export const INSTRUCTIONS = `You write purchase-order emails from a small Caribbean clothing brand to its supplier.
Write only three parts: a subject line, an opening paragraph, and a closing paragraph with a sign-off from the brand.
The order's lines are inserted between your opening and closing by the system — do not list items, quantities, prices or totals, and do not mention any number except the order reference.
Be warm, brief and professional. Ask the supplier to confirm quantities and a ready date. Plain text, no markdown.`;

const schema = z.object({ subject: z.string(), opening: z.string(), closing: z.string() });

/**
 * The model's prose for one supplier group, or null if it fails the checks —
 * the caller then uses `templateProse`.
 */
export async function writeProse({
  model,
  context,
  group,
  abortSignal,
  providerOptions,
}: {
  model: LanguageModel;
  context: EmailContext;
  group: SupplierGroup;
  abortSignal?: AbortSignal;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}): Promise<{ prose: Prose | null; usage: { inputTokens?: number; outputTokens?: number } }> {
  const result = await generateText({
    model,
    instructions: INSTRUCTIONS,
    prompt: JSON.stringify({
      brand: context.brand,
      order_reference: context.reference,
      supplier: group.supplierEmail ?? "unknown",
      pieces: [...new Set(group.lines.map((line) => line.piece))],
      needed_within_days: context.leadTimeDays,
    }),
    output: Output.object({ schema }),
    abortSignal,
    providerOptions,
    maxRetries: 1,
  });
  return {
    prose: acceptProse(result.output, context),
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
  };
}

/**
 * The guardrail: every part present and a sensible length, and no number in
 * any of them except the order reference's and the lead time. Quantities and
 * prices belong to the line list alone.
 */
export function acceptProse(raw: Prose, context: EmailContext): Prose | null {
  const tidy = (text: string) => text.replace(/[ \t]+/g, " ").trim();
  const prose = { subject: tidy(raw.subject), opening: tidy(raw.opening), closing: tidy(raw.closing) };
  if (!prose.subject || prose.subject.length > 120) return null;
  if (!prose.opening || prose.opening.length > 800) return null;
  if (!prose.closing || prose.closing.length > 600) return null;

  const allowed = new Set([
    ...(context.reference.match(/\d+/g) ?? []),
    String(Number(context.reference.replace(/\D/g, ""))),
    String(context.leadTimeDays),
  ]);
  const numbers = `${prose.subject} ${prose.opening} ${prose.closing}`.match(/\d+/g) ?? [];
  return numbers.every((number) => allowed.has(number)) ? prose : null;
}

function money(cents: number): string {
  return `TT$${(cents / 100).toLocaleString("en-TT", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The model's half of restock: turning a decision the formula already made
 * into a sentence an owner trusts.
 *
 * The model never decides anything. It is handed each line's verdict and
 * quantity along with the numbers behind them, and asked to say why in plain
 * words. Its answer replaces only the sentence, and only after it passes the
 * checks in `acceptReason` — anything off falls back to the formula's own.
 *
 * Takes the model as an argument and imports nothing from the app, so the
 * tests can hand it a mock and run under `node --test`.
 */

import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { Verdict } from "./restock.ts";

export type ExplainLine = {
  id: string;
  name: string;
  variant: string;
  verdict: Verdict;
  suggested: number;
  onHand: number;
  onOrder: number;
  leadTimeDays: number;
  /** Units a day. */
  pace: number;
  cover: number | null;
  trend: number | null;
};

/** One call explains at most this many lines; the rest wait for the next load. */
export const MAX_LINES_PER_CALL = 40;
const MAX_REASON = 240;

/**
 * What a reason depends on. If any of it changes, the cached sentence is
 * stale; if none of it does, the sentence still holds. Pace and cover are
 * rounded to what the sentence would say, so a sale that doesn't move the
 * story doesn't cost a call.
 */
export function fingerprint(line: ExplainLine): string {
  return [
    line.verdict,
    line.suggested,
    line.onHand,
    line.onOrder,
    line.leadTimeDays,
    line.pace.toFixed(1),
    line.cover === null ? "-" : Math.round(line.cover),
    trendWord(line.trend),
  ].join("|");
}

export const INSTRUCTIONS = `You explain stock decisions to the owner of a small Caribbean clothing brand.
A formula has already decided what to do with each line. Never change, question or soften its verdict or its quantity — explain them.
For each line, write one or two short sentences (under 200 characters) saying why, in plain words an owner reads on a phone.
Use only numbers that appear in that line's data. Do not invent dates, events, customers or causes.
No jargon like "velocity" or "SKU", no markdown, no emoji. Money is TT$.
Return one entry per line, using the line's id exactly.`;

export function buildPrompt(lines: ExplainLine[]): string {
  const data = lines.map((line) => ({
    id: line.id,
    piece: `${line.name}, ${line.variant}`,
    verdict: line.verdict,
    order_quantity: line.suggested,
    on_hand: line.onHand,
    on_order: line.onOrder,
    supplier_lead_time_days: line.leadTimeDays,
    sold_per_day: Number(line.pace.toFixed(1)),
    days_of_cover: line.cover === null ? null : Math.round(line.cover),
    week_on_week: trendWord(line.trend),
  }));
  return `Rules the formula follows: reorder when a line sells at least 0.5 a day and its cover is under the lead time plus 7 days, ordering enough for the lead time plus 30 days; hold when cover is over 35 days, sales are falling, or nothing sold in 14 days; otherwise watch.

Lines:
${JSON.stringify(data, null, 1)}`;
}

const schema = z.object({
  lines: z.array(z.object({ id: z.string(), reason: z.string() })),
});

/**
 * Asks the model for every line at once and returns only the reasons that
 * pass `acceptReason`, keyed by line id. Lines missing from the result keep
 * the formula's sentence.
 */
export async function explainLines({
  model,
  lines,
  abortSignal,
  providerOptions,
}: {
  model: LanguageModel;
  lines: ExplainLine[];
  abortSignal?: AbortSignal;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}): Promise<{ reasons: Map<string, string>; usage: { inputTokens?: number; outputTokens?: number } }> {
  const batch = lines.slice(0, MAX_LINES_PER_CALL);
  const result = await generateText({
    model,
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(batch),
    output: Output.object({ schema }),
    abortSignal,
    providerOptions,
    // runAI owns failure; one retry is plenty for a sentence nobody is waiting on.
    maxRetries: 1,
  });

  const byId = new Map(batch.map((line) => [line.id, line]));
  const reasons = new Map<string, string>();
  for (const entry of result.output.lines) {
    const line = byId.get(entry.id);
    if (!line || reasons.has(entry.id)) continue;
    const reason = acceptReason(entry.reason, line);
    if (reason) reasons.set(entry.id, reason);
  }
  return {
    reasons,
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
  };
}

/**
 * The guardrail. A reason is used only if it is non-empty, short enough to
 * sit in a table cell, and every number in it is one the model was given —
 * the cheapest reliable check that it explained the line rather than
 * invented a story about it. Returns the cleaned sentence, or null.
 */
export function acceptReason(raw: string, line: ExplainLine): string | null {
  const reason = raw.replace(/\s+/g, " ").trim();
  if (!reason || reason.length > MAX_REASON) return null;

  const allowed = new Set<string>(["0", "7", "14", "30", "35", "0.5"]);
  const add = (value: number | null) => {
    if (value === null) return;
    allowed.add(String(value));
    allowed.add(String(Math.round(value)));
    allowed.add(value.toFixed(1));
  };
  add(line.suggested);
  add(line.onHand);
  add(line.onOrder);
  add(line.leadTimeDays);
  add(line.leadTimeDays + 7);
  add(line.leadTimeDays + 30);
  add(line.pace);
  add(line.cover);
  add(line.onHand + line.onOrder);

  const numbers = reason.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.every((number) => allowed.has(number)) ? reason : null;
}

function trendWord(trend: number | null): string {
  if (trend === null) return "no prior week";
  if (trend > 1.3) return "rising";
  if (trend < 0.7) return "falling";
  return "steady";
}

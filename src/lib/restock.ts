/**
 * Restock scoring — blueprint §3, with the prototype's constants where the
 * blueprint leaves a number open.
 *
 * Deliberately a transparent formula rather than a model: with a small
 * brand's volumes (dozens of orders a week) a heuristic the owner can check
 * by hand beats anything fitted, and "why did it say hold" must always have
 * an answer. The model only ever writes the sentence; it never decides.
 *
 * Pure and import-free, so `node --test` runs it without a build.
 */

/** Days of sales the pace is averaged over. */
export const PACE_WINDOW_DAYS = 14;
/** Days of cover added to the lead time before a line counts as short. */
export const SAFETY_BUFFER_DAYS = 7;
/** Below this many units a day, a line is too slow to reorder on pace alone. */
export const MIN_PACE = 0.5;
/** A reorder covers the lead time plus this many days of selling. */
export const COVER_TARGET_DAYS = 30;
/** More cover than this is cash sitting on a shelf. */
export const HOLD_COVER_DAYS = 35;
export const RISING_TREND = 1.3;
export const FALLING_TREND = 0.7;

export type Verdict = "reorder" | "watch" | "hold";

export type VariantInput = {
  onHand: number;
  /** Units on purchase orders that have been sent and not yet received. */
  onOrder: number;
  leadTimeDays: number;
  minOrderQty: number;
  /** Units sold in the last 14 days. */
  sold14: number;
  /** Units sold in the last 7 days, and in the 7 before that. */
  sold7: number;
  soldPrior7: number;
};

export type Score = {
  verdict: Verdict;
  /** Units a day over the pace window. */
  pace: number;
  /** Days until stock plus what is on order runs out. `null` when nothing sells. */
  cover: number | null;
  /** Last week over the week before. `null` when the week before sold nothing. */
  trend: number | null;
  /** What restock would order today. Zero unless the verdict is reorder. */
  suggested: number;
  /** Units that will go unsold before a new order could land, if nothing is ordered. */
  shortfall: number;
  /** The reasoning in one sentence, from the same numbers. */
  reason: string;
};

export function scoreVariant(input: VariantInput): Score {
  const pace = input.sold14 / PACE_WINDOW_DAYS;
  const stock = input.onHand + input.onOrder;
  const cover = pace > 0 ? stock / pace : null;
  const trend = input.soldPrior7 > 0 ? input.sold7 / input.soldPrior7 : null;
  const falling = trend !== null && trend < FALLING_TREND;
  const rising = trend !== null && trend > RISING_TREND;
  const shortfall = Math.max(0, Math.ceil(pace * input.leadTimeDays - stock));

  const base = { pace, cover, trend, shortfall };

  if (pace >= MIN_PACE && cover !== null && cover < input.leadTimeDays + SAFETY_BUFFER_DAYS) {
    const needed = Math.ceil(pace * (input.leadTimeDays + COVER_TARGET_DAYS) - stock);
    const suggested = Math.max(input.minOrderQty, needed);
    return {
      ...base,
      verdict: "reorder",
      suggested,
      reason: reorderReason(input, pace, cover, suggested, rising),
    };
  }

  // Stock on the way that restock itself would have ordered is the plan
  // working, not overstock: the formula orders for lead time + a month, which
  // is more than HOLD_COVER_DAYS, so without this it would tell you to trim
  // the very order it suggested. Only cover beyond what it would order (plus
  // the buffer) is worth trimming.
  const planned = input.leadTimeDays + COVER_TARGET_DAYS + SAFETY_BUFFER_DAYS;
  if (input.onOrder > 0 && pace > 0 && cover !== null && cover <= planned) {
    return {
      ...base,
      verdict: "watch",
      suggested: 0,
      reason: `${input.onOrder} on order covers the ${input.leadTimeDays}-day wait, with ${days(cover)} of cover in all. Nothing more to order.`,
    };
  }

  if (pace === 0 || falling || (cover !== null && cover > HOLD_COVER_DAYS)) {
    return { ...base, verdict: "hold", suggested: 0, reason: holdReason(input, pace, cover, falling) };
  }

  return {
    ...base,
    verdict: "watch",
    suggested: 0,
    reason: `${days(cover)} of cover at ${rate(pace)}. ${
      rising ? "Picking up week on week; re-checked" : "Re-checked"
    } on every load.`,
  };
}

function reorderReason(
  input: VariantInput,
  pace: number,
  cover: number,
  suggested: number,
  rising: boolean,
): string {
  const now =
    input.onHand === 0
      ? `Out of stock, selling ${rate(pace)} before it ran out.`
      : `${days(cover)} left at ${rate(pace)}, under the ${input.leadTimeDays}-day lead time.`;
  const onOrder = input.onOrder > 0 ? ` ${input.onOrder} already on order.` : "";
  return `${now}${onOrder}${rising ? " Demand is rising." : ""} Order ${suggested} to cover the wait and a month after.`;
}

function holdReason(
  input: VariantInput,
  pace: number,
  cover: number | null,
  falling: boolean,
): string {
  if (pace === 0) {
    return input.onHand + input.onOrder > 0
      ? "Nothing sold in two weeks. Try a promo before ordering more."
      : "Nothing sold and nothing in stock. Leave it unless it's coming back.";
  }
  if (input.onOrder > 0 && cover !== null && cover > HOLD_COVER_DAYS) {
    return `${input.onOrder} on order takes cover to ${days(cover)}. Consider trimming that order.`;
  }
  if (falling) return `Sales fell week on week; ${days(cover)} of cover. Hold and watch.`;
  return `${days(cover)} of cover at ${rate(pace)}. Cash is tied up here; no reorder.`;
}

function days(cover: number | null): string {
  if (cover === null) return "No";
  if (cover > 90) return "90+ days";
  const whole = Math.round(cover);
  return `${whole} ${whole === 1 ? "day" : "days"}`;
}

function rate(pace: number): string {
  return `${pace < 10 ? pace.toFixed(1) : Math.round(pace)} a day`;
}

/* ------------------------------------------------------------------ Summary */

export type SummaryLine = {
  score: Score;
  unitCostCents: number;
  priceCents: number;
};

export type RestockSummary = {
  /** Lines the model would reorder today. */
  flagged: number;
  units: number;
  costCents: number;
  /** Revenue lost before new stock could land, if nothing is ordered today. */
  atRiskCents: number;
  /** Median days of cover across lines that sell. `null` when none do. */
  medianCover: number | null;
};

export function summarise(lines: SummaryLine[]): RestockSummary {
  const reorders = lines.filter((line) => line.score.verdict === "reorder");
  const covers = lines
    .map((line) => line.score.cover)
    .filter((cover): cover is number => cover !== null)
    .sort((a, b) => a - b);

  return {
    flagged: reorders.length,
    units: reorders.reduce((sum, line) => sum + line.score.suggested, 0),
    costCents: reorders.reduce((sum, line) => sum + line.score.suggested * line.unitCostCents, 0),
    atRiskCents: reorders.reduce((sum, line) => sum + line.score.shortfall * line.priceCents, 0),
    medianCover: median(covers),
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

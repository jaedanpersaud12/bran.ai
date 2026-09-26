"use client";

import RecommendationCard, { type RecommendationOption } from "@/components/primitives/RecommendationCard";
import { EntityChip } from "@/components/atoms/EntityChip";
import { ValuePill } from "@/components/atoms/ValuePill";
import { AiMark, RESTOCK_AI_TITLE } from "@/components/bran/AiMark";
import { draftPurchaseOrder } from "@/actions/purchase-orders";
import type { RestockLine } from "@/lib/inventory";
import { formatMoneyWhole } from "@/lib/metrics";
import type { RestockSummary } from "@/lib/restock";

/** Cover under this many days is "runs out this week". */
const THIS_WEEK = 7;

/**
 * Restock's call, built from the same scored lines as the planner below it.
 *
 * Up to three options: order everything restock flagged, order only what runs
 * out this week, or order nothing and accept the projected loss. Accepting an
 * order option drafts the purchase order with the model's own quantities —
 * the one-tap path. The planner is for disagreeing with it.
 */
export function RestockRecommendation({
  lines,
  summary,
}: {
  lines: RestockLine[];
  summary: RestockSummary;
}) {
  const reorders = lines.filter((line) => line.score.verdict === "reorder");
  const urgent = reorders.filter((line) => (line.score.cover ?? 0) < THIS_WEEK);
  const top = reorders[0];

  if (!top) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Nothing needs reordering today. Every line that sells has more cover than its lead time.
      </p>
    );
  }

  const byKey: Record<string, RestockLine[]> = { all: reorders, urgent };
  const options: RecommendationOption[] = [
    {
      key: "all",
      body: (
        <>
          Reorder {reorders.length} {reorders.length === 1 ? "line" : "lines"},{" "}
          <ValuePill tone="green">{summary.units} units</ValuePill> for{" "}
          {formatMoneyWhole(summary.costCents / 100)}. Most urgent: <EntityChip name={top.name} />{" "}
          {top.variant.toLowerCase()} — {lowerFirst(top.reason)}
          {top.reasonSource === "model" ? <AiMark title={RESTOCK_AI_TITLE} /> : null}
        </>
      ),
      short: `Reorder all ${reorders.length} · ${summary.units} units`,
      signal: 3,
      tone: "var(--green)",
      label: "Last 14 days of sales",
      cta: "Draft order",
      ctaVariant: "accent",
    },
  ];

  if (urgent.length > 0 && urgent.length < reorders.length) {
    const units = urgent.reduce((sum, line) => sum + line.score.suggested, 0);
    options.push({
      key: "urgent",
      body: (
        <>
          Only reorder the {urgent.length} {urgent.length === 1 ? "line" : "lines"} that run out
          this week — <ValuePill>{units} units</ValuePill> — and look at the rest next week.
        </>
      ),
      short: `Only what runs out this week · ${units} units`,
      signal: 2,
      tone: "var(--orange)",
      label: "Smaller outlay",
      cta: "Draft order",
      ctaVariant: "primary",
    });
  }

  options.push({
    key: "wait",
    body: <>Order nothing this week, and sell through what is on the shelf.</>,
    short: "Order nothing this week",
    signal: 0,
    tone: "var(--ink-3)",
    label: `Costs ${formatMoneyWhole(summary.atRiskCents / 100)} in projected sales`,
    cta: "Hold",
    ctaVariant: "primary",
  });

  const accept = async (key: string): Promise<string | null> => {
    const chosen = byKey[key];
    if (!chosen) return "Holding";
    const result = await draftPurchaseOrder(
      chosen.map((line) => ({ variantId: line.variantId, quantity: line.score.suggested })),
    );
    return result.ok ? `Drafted ${result.reference}` : null;
  };

  return (
    <RecommendationCard
      labels={{ title: "Draft this reorder?" }}
      options={options}
      onAccept={accept}
    />
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

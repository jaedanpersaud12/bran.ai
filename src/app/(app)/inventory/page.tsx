import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RecommendationCard from "@/components/primitives/RecommendationCard";
import { EntityChip } from "@/components/atoms/EntityChip";
import { ValuePill } from "@/components/atoms/ValuePill";
import { ReorderPlanner } from "@/components/bran/ReorderPlanner";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { RESTOCK_SIGNAL, STOCK, formatMoneyWhole, type StockState } from "@/lib/demo";

export const metadata = { title: "Inventory — bran" };

/**
 * Restock intelligence.
 *
 * The screen is ordered by urgency rather than by SKU, because the question a
 * brand owner opens it with is "what do I reorder today", never "what does the
 * catalogue look like". The advice column is the product: a count of units is
 * something any spreadsheet has, and a sentence saying the black small runs
 * out on Thursday is not.
 */

const STATE_LABEL: Record<StockState, string> = {
  healthy: "Healthy",
  low: "Low",
  out: "Out of stock",
  incoming: "Restock inbound",
};

/** Out is the only one that gets the alarm colour. Low is a plan, not a fire. */
function stateVariant(state: StockState) {
  if (state === "out") return "destructive" as const;
  if (state === "low") return "outline" as const;
  return "secondary" as const;
}

export default function InventoryPage() {
  // Worst cover first, and anything already out ahead of that.
  const ordered = [...STOCK].sort(
    (a, b) => (a.daysCover ?? -1) - (b.daysCover ?? -1),
  );

  return (
    <div className="w-full">
      <PageHeader
        title="Inventory"
        blurb="Every line, ordered by how long it has left. The model reads the last ninety days of sales, what is already on a purchase order, and what the calendar is about to promote."
      >
        <Button variant="outline" size="sm">
          Export
        </Button>
      </PageHeader>

      <StatRow
        stats={[
          {
            label: "Lines needing a reorder",
            value: String(RESTOCK_SIGNAL.flagged),
            note: `of ${STOCK.length} tracked`,
          },
          {
            label: "Units to order",
            value: String(RESTOCK_SIGNAL.units),
            note: `${formatMoneyWhole(RESTOCK_SIGNAL.cost)} at cost`,
          },
          {
            label: "Sales at risk",
            value: formatMoneyWhole(RESTOCK_SIGNAL.atRisk),
            note: "If nothing is ordered this week",
          },
          {
            label: "Median cover",
            value: "17 days",
            delta: { percent: -4.1, since: "vs prior 30 days" },
            riseIsGood: true,
          },
        ]}
      />

      {/*
       * Beautiful UI's Recommendation Card (beautifului.dev, MIT, via their
       * shadcn registry). It is the piece that fits this product best:
       * restock intelligence is only worth having if it ends in "shall I
       * order it", and a table of forecasts never asks.
       */}
      <Panel
        title="The model's call"
        hint="What it would do today, and what it would do instead."
      >
        <RecommendationCard
          labels={{ title: "Want me to place this reorder?" }}
          options={[
            {
              key: "urgent",
              body: (
                <>
                  Reorder the <EntityChip name="Tobago triangle top" /> in black, small and
                  medium, <ValuePill tone="green">100 units</ValuePill> — the medium has been
                  out since Friday with 11 people asking.
                </>
              ),
              short: "Reorder the triangle top · 100 units",
              signal: 3,
              tone: "var(--green)",
              label: "High confidence",
              cta: "Accept",
              ctaVariant: "accent",
            },
            {
              key: "pair",
              body: (
                <>
                  Add the <ValuePill>Buccoo wrap skirt</ValuePill> to the same run — it pairs
                  with that top in 6 of every 10 carts.
                </>
              ),
              short: "Add the wrap skirt to the run",
              signal: 2,
              tone: "var(--orange)",
              label: "Worth a look",
              cta: "Add to order",
              ctaVariant: "primary",
            },
            {
              key: "wait",
              body: (
                <>
                  Wait for Thursday&apos;s <span className="font-medium text-ink">80 units</span>{" "}
                  and reorder nothing this week.
                </>
              ),
              short: "Wait for Thursday's delivery",
              signal: 0,
              tone: "var(--ink-3)",
              label: "Costs TT$38,900 in projected sales",
              cta: "Hold the order",
              ctaVariant: "primary",
            },
          ]}
        />
      </Panel>

      <Panel
        title="Plan the reorder"
        hint="Filled in with what the model would order. Change anything you disagree with."
      >
        <ReorderPlanner items={ordered} />
      </Panel>
    </div>
  );
}

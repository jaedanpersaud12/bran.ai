import Link from "next/link";
import { after } from "next/server";
import { ReorderPlanner } from "@/components/bran/ReorderPlanner";
import { RestockRecommendation } from "@/components/bran/RestockRecommendation";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { Button } from "@/components/ui/button";
import { loadInventory } from "@/lib/inventory";
import { explainMissing } from "@/lib/restock-ai";
import { formatMoneyWhole } from "@/lib/metrics";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Inventory — bran" };

const BLURB =
  "Every line, ordered by how long it has left. Restock reads the last two weeks of sales and what is already on a sent purchase order.";

/**
 * Restock intelligence.
 *
 * The screen is ordered by urgency rather than by SKU, because the question a
 * brand owner opens it with is "what do I reorder today", never "what does the
 * catalogue look like". The reason column is the product: a count of units is
 * something any spreadsheet has, and a sentence saying the black small runs
 * out on Thursday is not.
 *
 * Scored on every load (see `src/lib/restock.ts`), so a stock change shows up
 * on the next visit rather than after a nightly job.
 */
export default async function InventoryPage() {
  const current = await currentWorkspace();

  if (!current) {
    return (
      <div className="w-full">
        <PageHeader title="Inventory" blurb={BLURB} />
        <p className="border-t border-border pt-6 text-[13px] text-muted-foreground">
          Sign in with your FLVS account to see your workspace&apos;s stock.
        </p>
      </div>
    );
  }

  const workspaceId = current.workspace.id;
  const { lines, summary, unexplained } = await loadInventory(workspaceId);

  // The model's sentences never hold up the page: this load shows the
  // formula's, and whatever the model writes is there on the next one.
  if (unexplained.length > 0) after(() => explainMissing(workspaceId, unexplained));

  return (
    <div className="w-full">
      <PageHeader title="Inventory" blurb={BLURB}>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory/catalog">Manage catalog</Link>
        </Button>
      </PageHeader>

      <StatRow
        stats={[
          {
            label: "Lines needing a reorder",
            value: String(summary.flagged),
            note: `of ${lines.length} tracked`,
          },
          {
            label: "Units to order",
            value: String(summary.units),
            note: `${formatMoneyWhole(summary.costCents / 100)} at cost`,
          },
          {
            label: "Sales at risk",
            value: formatMoneyWhole(summary.atRiskCents / 100),
            note: "Before new stock could land, if nothing is ordered",
          },
          {
            label: "Median cover",
            value:
              summary.medianCover === null ? "—" : `${Math.round(summary.medianCover)} days`,
            note: "Across lines that sold in the last two weeks",
          },
        ]}
      />

      <Panel title="Restock's call" hint="What it would order today, and the alternatives.">
        <RestockRecommendation lines={lines} summary={summary} />
      </Panel>

      <Panel
        title="Plan the reorder"
        hint="Filled in with what restock would order. Change anything you disagree with."
      >
        {lines.length > 0 ? (
          <ReorderPlanner items={lines} />
        ) : (
          <p className="text-[13px] text-muted-foreground">
            No products yet.{" "}
            <Link href="/inventory/catalog" className="text-foreground underline underline-offset-4">
              Add what you sell
            </Link>
            ; once it has stock and sales, restock scores it here.
          </p>
        )}
      </Panel>
    </div>
  );
}

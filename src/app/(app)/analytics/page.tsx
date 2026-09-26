import MonoAreaChart from "@/components/bran/MonoAreaChart";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadInventory } from "@/lib/inventory";
import { currentWorkspace } from "@/lib/workspace";
import { formatRange, reportingWindow, revenueSeries } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — bran" };

/**
 * The long view behind the dashboard's headline figures.
 *
 * Same chart component the dashboard uses, on the same series. That is
 * deliberate: two screens drawing the same number two different ways is how a
 * brand owner ends up not trusting either.
 */
export default async function AnalyticsPage() {
  const now = new Date();
  const { start, end } = reportingWindow(now);

  // Best sellers are the inverse of the restock list: whatever the next two
  // weeks will take the most of.
  const current = await currentWorkspace();
  const inventory = current ? await loadInventory(current.workspace.id) : null;
  const movers = (inventory?.lines ?? [])
    .map((line) => ({ ...line, forecast14: Math.round(line.score.pace * 14) }))
    .sort((a, b) => b.forecast14 - a.forecast14)
    .slice(0, 5);

  return (
    <div className="w-full">
      <PageHeader
        title="Analytics"
        blurb={`Everything the workspace recorded between ${formatRange(start, end)}.`}
      />

      <StatRow
        stats={[
          {
            label: "Revenue",
            value: "TT$284,920",
            delta: { percent: 27.4, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          {
            label: "Orders",
            value: "1,842",
            delta: { percent: 4.1, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          {
            label: "Average order value",
            value: "TT$154.60",
            delta: { percent: -1.3, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          {
            label: "Repeat purchase rate",
            value: "38.4%",
            delta: { percent: 2.7, since: "vs prior 30 days" },
            riseIsGood: true,
          },
        ]}
      />

      <Panel title="Monthly recurring revenue" hint="Daily, across the reporting window.">
        <MonoAreaChart series={revenueSeries(now)} />
      </Panel>

      <Panel title="Moving fastest" hint="By forecast demand over the next fourteen days.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Piece</TableHead>
                <TableHead className="text-right">Forecast · 14 days</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Cover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movers.map((item) => (
                <TableRow key={item.variantId}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-[12px] text-muted-foreground">{item.variant}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {item.forecast14}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.onHand}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.onHand === 0 ? (
                      <span className="text-negative">Out</span>
                    ) : item.score.cover === null ? (
                      "—"
                    ) : (
                      `${Math.round(item.score.cover)}d`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}

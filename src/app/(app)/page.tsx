import { DashboardView } from "@/components/bran/DashboardView";
import { firstName, getSessionUser } from "@/lib/session";
import { formatMoneyWhole, formatRange, greeting, reportingWindow, revenueSeries } from "@/lib/metrics";
import { loadInventory } from "@/lib/inventory";
import { currentWorkspace } from "@/lib/workspace";

// The window ends today and the greeting depends on the hour, so this cannot
// be baked at build time.
export const dynamic = "force-dynamic";

/** Reads the clock and the session, and hands the screen what it needs. */
export default async function Dashboard() {
  const now = new Date();
  const user = await getSessionUser();
  const { start, end } = reportingWindow(now);
  const current = await currentWorkspace();
  const inventory = current ? await loadInventory(current.workspace.id) : null;

  return (
    <DashboardView
      greeting={greeting(now)}
      name={firstName(user)}
      series={revenueSeries(now)}
      range={formatRange(start, end)}
      restock={
        inventory
          ? {
              flagged: inventory.summary.flagged,
              tracked: inventory.lines.length,
              atRisk: formatMoneyWhole(inventory.summary.atRiskCents / 100),
            }
          : null
      }
    />
  );
}

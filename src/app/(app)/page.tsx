import { DashboardView } from "@/components/bran/DashboardView";
import { firstName, getSessionUser } from "@/lib/session";
import { formatRange, greeting, reportingWindow, revenueSeries } from "@/lib/metrics";

// The window ends today and the greeting depends on the hour, so this cannot
// be baked at build time.
export const dynamic = "force-dynamic";

/** Reads the clock and the session, and hands the screen what it needs. */
export default async function Dashboard() {
  const now = new Date();
  const user = await getSessionUser();
  const { start, end } = reportingWindow(now);

  return (
    <DashboardView
      greeting={greeting(now)}
      name={firstName(user)}
      series={revenueSeries(now)}
      range={formatRange(start, end)}
    />
  );
}

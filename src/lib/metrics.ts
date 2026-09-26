/**
 * The figures behind the dashboard.
 *
 * Every number here is a placeholder. None of it comes out of the database
 * yet, because none of it exists there: recurring revenue, budget envelopes
 * and a tax payment belong to the subscription back office, and the only
 * tables bran owns so far are workspaces and their members. Keeping the whole
 * set in one module — shaped the way the real queries will return it — means
 * wiring it up later is a change to this file and its call site, not to the
 * screen.
 *
 * The reporting window is the one thing computed for real. A dashboard that
 * claims "last 30 days" and then prints a range from whenever the mock was
 * written is the first thing anyone notices.
 */

/** A point on the recurring-revenue line: one day, one figure. */
export type RevenuePoint = {
  /** Milliseconds since the epoch, so the caller formats for its own locale. */
  at: number;
  /** Monthly recurring revenue on that day, in dollars. */
  mrr: number;
};

export type Delta = {
  /** Percentage change, signed. Negative means down. */
  percent: number;
  /** What it is change against, spelled out. */
  since: string;
};

export type Kpi = {
  label: string;
  value: string;
  delta: Delta;
  /**
   * Whether a rise is the good outcome. Average order value falling is bad;
   * refund rate falling is good. Without this, the colour is a guess.
   */
  riseIsGood: boolean;
};

const DAY = 86_400_000;
export const WINDOW_DAYS = 30;

/**
 * Thirty days of recurring revenue, oldest first, in thousands.
 *
 * Hand-shaped rather than randomised: a fresh `Math.random()` on every render
 * gives a chart that twitches between reloads and a headline percentage that
 * disagrees with the line it sits above. These run from 72.2 to 92.0 — the
 * +27.4% the heading claims.
 */
const MRR_THOUSANDS = [
  72.2, 72.6, 72.0, 70.4, 69.3, 71.5, 73.8, 74.6, 74.2, 74.9, 75.3, 74.8, 75.6,
  76.1, 75.4, 76.8, 77.5, 78.2, 77.9, 79.4, 80.6, 82.1, 81.4, 79.8, 80.9, 82.4,
  83.1, 84.0, 86.7, 92.0,
];

/**
 * The window the whole screen reports on, ending today. `now` is a parameter
 * so the caller owns the clock: a server component reads it once per request,
 * and a test can pin it.
 */
export function reportingWindow(now: Date = new Date()) {
  const end = new Date(now);
  const start = new Date(now.getTime() - (WINDOW_DAYS - 1) * DAY);
  return { start, end, days: WINDOW_DAYS };
}

/** The recurring-revenue series, dated against the reporting window. */
export function revenueSeries(now: Date = new Date()): RevenuePoint[] {
  const { start } = reportingWindow(now);
  return MRR_THOUSANDS.map((thousands, index) => ({
    at: start.getTime() + index * DAY,
    mrr: Math.round(thousands * 1000),
  }));
}

export function currentMrr(): number {
  return Math.round(MRR_THOUSANDS[MRR_THOUSANDS.length - 1] * 1000);
}

export function mrrGrowth(): Delta {
  const first = MRR_THOUSANDS[0];
  const last = MRR_THOUSANDS[MRR_THOUSANDS.length - 1];
  return {
    percent: round1(((last - first) / first) * 100),
    since: `over last ${WINDOW_DAYS} days`,
  };
}

export const KPIS: Kpi[] = [
  {
    label: "Repeat purchase rate",
    value: "38.4%",
    delta: { percent: 2.7, since: `vs prior ${WINDOW_DAYS} days` },
    riseIsGood: true,
  },
  {
    label: "Orders",
    value: "1,842",
    delta: { percent: 4.1, since: `vs prior ${WINDOW_DAYS} days` },
    riseIsGood: true,
  },
  {
    label: "Average order value",
    value: formatMoney(154.6),
    delta: { percent: -1.3, since: `vs prior ${WINDOW_DAYS} days` },
    riseIsGood: true,
  },
];

/**
 * Total revenue, split the two ways the business actually bills: the monthly
 * subscription, and everything metered on top of it.
 */
export const REVENUE_SPLIT = {
  total: 284_920,
  parts: [
    { label: "Subscriptions", amount: 202_293 },
    { label: "Usage & services", amount: 82_627 },
  ],
};

export const CUSTOMERS = {
  total: 2_540,
  parts: [
    { label: "Paid", count: 1_981 },
    { label: "Free", count: 559 },
  ],
};

export const BUDGET = {
  total: 50_734,
  /** Ordered as they stack in the bar: unspent first, committed last. */
  parts: [
    { label: "Unused", share: 0.5 },
    { label: "Used", share: 0.25 },
    { label: "Reserved", share: 0.25 },
  ],
};

export const TAX_PAYMENT = {
  label: "Corporation tax",
  paidOn: new Date("2026-03-24T00:00:00Z"),
  amount: 1_450,
  method: "•••• 4432",
  status: "Completed" as const,
};

/** `TT$154.60`. Two decimals, because these are amounts, not counts. */
export function formatMoney(amount: number): string {
  return `TT$${amount.toLocaleString("en-TT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** `TT$50,734`. Whole dollars, for a figure nobody quotes to the cent. */
export function formatMoneyWhole(amount: number): string {
  return `TT$${Math.round(amount).toLocaleString("en-TT")}`;
}

/** `TT$92K` — the headline form, where exact cents are noise. */
export function formatMoneyCompact(amount: number): string {
  if (Math.abs(amount) < 1000) return `TT$${Math.round(amount)}`;
  return `TT$${round1(amount / 1000)}K`.replace(".0K", "K");
}

/**
 * `Aug 10 – Sep 8, 2026`. The year lands once, at the end.
 *
 * Month first, and `en-US` rather than `en-TT`, for one reason: en-TT
 * abbreviates September as "Sept" and August as "Aug", so an axis built from
 * it has a four-letter label in a row of three and reads as a rendering bug.
 * Every date on this screen goes through here or DATE_LOCALE, so they agree.
 */
export const DATE_LOCALE = "en-US";

export function formatRange(start: Date, end: Date): string {
  const day = new Intl.DateTimeFormat(DATE_LOCALE, { month: "short", day: "numeric" });
  return `${day.format(start)} – ${day.format(end)}, ${end.getFullYear()}`;
}

/** "Good morning" / "Good afternoon" / "Good evening", in Trinidad time. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Port_of_Spain",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

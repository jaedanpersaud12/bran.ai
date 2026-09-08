import { DeltaBadge } from "@/components/bran/DeltaBadge";
import type { Delta } from "@/lib/metrics";

/**
 * The parts every screen after the dashboard is built from.
 *
 * The dashboard set the vocabulary — a 28px greeting, figures at 30px on
 * tabular numerals, hairlines instead of cards — and these exist so the next
 * nine screens speak it without nine copies of the same class string drifting
 * apart. Nothing here is a card: the rule between two things is the whole
 * design, and a border plus a shadow plus a radius around each of eleven
 * panels is what it was avoiding.
 */

export function PageHeader({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  /** The section's actions, opposite the title. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em]">{title}</h1>
        {blurb ? (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            {blurb}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export type Stat = {
  label: string;
  value: string;
  delta?: Delta;
  /** Whether a rise is the good outcome. Only read when there is a delta. */
  riseIsGood?: boolean;
  /** Said instead of a delta, where there is nothing to compare against. */
  note?: string;
};

/**
 * The figure row that heads a screen, ruled the way the dashboard's is: a
 * hairline under the row, and one between each pair, appearing only once
 * there is a column beside it to separate.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <section className="grid grid-cols-1 border-b border-border sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`py-5 ${index > 0 ? "lg:border-l lg:border-border lg:pl-6" : ""} ${
            index < stats.length - 1 ? "border-b border-border lg:border-b-0 lg:pr-6" : ""
          }`}
        >
          <p className="text-[13px] text-muted-foreground">{stat.label}</p>
          <p className="mt-1.5 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
            {stat.value}
          </p>
          <div className="mt-2.5 min-h-[18px]">
            {stat.delta ? (
              <DeltaBadge delta={stat.delta} riseIsGood={stat.riseIsGood ?? true} />
            ) : stat.note ? (
              <p className="text-[12.5px] text-muted-foreground">{stat.note}</p>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

/** A titled block, separated from the one above it by a rule rather than a box. */
export function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-6 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

"use client";

import { useRef } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { PackageIcon } from "@/components/icons/package";
import { StatusPill } from "@/components/ui/status-pill";
import { ArrowRightIcon } from "@/components/icons/arrow-right";
import { LayersIcon } from "@/components/icons/layers";
import type { AnimatedIcon, AnimatedIconHandle } from "@/components/icons/types";
import MonoAreaChart from "@/components/bran/MonoAreaChart";
import { RevenueDial } from "@/components/bran/RevenueDial";
import { DeltaBadge } from "@/components/bran/DeltaBadge";
import { Legend, SegmentedBar } from "@/components/bran/SegmentedBar";
import { TickMeter } from "@/components/bran/TickMeter";
import { Toolbar } from "@/components/bran/Toolbar";
import {
  BUDGET,
  CUSTOMERS,
  DATE_LOCALE,
  KPIS,
  REVENUE_SPLIT,
  TAX_PAYMENT,
  currentMrr,
  formatMoney,
  formatMoneyCompact,
  formatMoneyWhole,
  mrrGrowth,
  type RevenuePoint,
} from "@/lib/metrics";

/**
 * The dashboard.
 *
 * A client component only because the icons animate on hover and need to hold
 * refs, and because Recharts renders in the browser; the figures themselves
 * are static and arrive from the server.
 */
export function DashboardView({
  greeting,
  name,
  series,
  range,
  restock,
}: {
  greeting: string;
  name: string | null;
  series: RevenuePoint[];
  range: string;
  /** The one live panel: computed from the workspace's stock. Null when signed out. */
  restock: { flagged: number; tracked: number; atRisk: string } | null;
}) {
  const growth = mrrGrowth();
  const paidShare = CUSTOMERS.parts[0].count / CUSTOMERS.total;
  const subscriptionShare = REVENUE_SPLIT.parts[0].amount / REVENUE_SPLIT.total;

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-6">
        <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em]">
          {greeting}
          {name ? `, ${name}` : ""}
        </h1>
        <Toolbar range={range} />
      </header>

      {/* Said once, at the top: everything but the restock panel is placeholder
          until orders (build-plan 08) and billing (13) exist. */}
      <p className="-mt-2 mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        <StatusPill tone="neutral" className="px-1.5 py-0 text-[10.5px]">
          Sample data
        </StatusPill>
        Revenue, customers and budget are sample figures until orders and billing are
        connected. Restock is live.
      </p>

      {/*
       * Hairlines rather than cards. Eleven separate panels on one screen is
       * eleven borders, eleven shadows and eleven radii competing for the same
       * attention; one ruled grid lets the figures be the only thing raised
       * off the page. The rule only appears once there is a column beside it
       * to separate, which is why every divider is breakpoint-scoped.
       */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px]">
        <div className="lg:border-r lg:border-border lg:pr-8">
          <section className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
            {KPIS.map((kpi, index) => (
              <div
                key={kpi.label}
                className={`py-5 ${index > 0 ? "sm:border-l sm:border-border sm:pl-6" : ""} ${
                  index < KPIS.length - 1 ? "border-b border-border sm:border-b-0 sm:pr-6" : ""
                }`}
              >
                <p className="text-[13px] text-muted-foreground">{kpi.label}</p>
                <p className="mt-1.5 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                  {kpi.value}
                </p>
                <div className="mt-2.5">
                  <DeltaBadge delta={kpi.delta} riseIsGood={kpi.riseIsGood} />
                </div>
              </div>
            ))}
          </section>

          <section className="border-b border-border py-6">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                  {formatMoneyCompact(currentMrr())}
                </p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  Monthly recurring revenue
                </p>
              </div>
              <DeltaBadge delta={growth} riseIsGood />
            </div>

            <div className="mt-5">
              <MonoAreaChart series={series} />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2">
            <div className="border-b border-border py-6 md:border-r md:border-b-0 md:pr-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-[13px] font-medium">
                  Restock
                  <StatusPill tone="success" className="px-1.5 py-0 text-[10.5px]">
                    Live
                  </StatusPill>
                </h2>
                <GhostButton icon={PackageIcon} href="/inventory">
                  Open restock
                </GhostButton>
              </div>

              {/* Computed, not generated: restock's own totals, in a sentence. */}
              <p className="mt-5 text-[24px] leading-[1.3] font-light tracking-[-0.01em] text-balance text-muted-foreground">
                {restock === null ? (
                  "Sign in to see what needs reordering."
                ) : restock.flagged === 0 ? (
                  <>
                    Nothing needs reordering today across{" "}
                    <strong className="font-semibold text-foreground">
                      {restock.tracked} lines
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-foreground">
                      {restock.flagged} of {restock.tracked} lines
                    </strong>{" "}
                    need reordering, with {restock.atRisk} of sales at risk before new stock
                    could land.
                  </>
                )}
              </p>
            </div>

            <div className="py-6 md:pl-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[13px] text-muted-foreground">Budget usage</h2>
                <GhostButton icon={LayersIcon}>Manage Budget</GhostButton>
              </div>

              <p className="mt-2 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {formatMoneyWhole(BUDGET.total)}
              </p>

              <div className="mt-5">
                <SegmentedBar segments={BUDGET.parts} />
              </div>
              <div className="mt-4">
                <Legend
                  items={[
                    { label: "Unused", className: "bg-step-1" },
                    { label: "Used", className: "bg-step-2" },
                    { label: "Reserved", className: "bg-step-3" },
                  ]}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:pl-8">
          <section className="border-t border-border pt-6 pb-7 lg:border-t-0 lg:pt-0">
            <RevenueDial
              share={subscriptionShare}
              label={`Total revenue ${formatMoney(REVENUE_SPLIT.total)}, ${Math.round(
                subscriptionShare * 100,
              )}% from subscriptions`}
            >
              <span className="mx-auto grid size-9 place-items-center rounded-full border border-border">
                <Wallet className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-[13px] text-muted-foreground">Total Revenue</p>
              <p className="mt-1 text-[19px] leading-none font-semibold tracking-[-0.01em] tabular-nums">
                {formatMoney(REVENUE_SPLIT.total)}
              </p>
            </RevenueDial>

            <div className="mt-1 flex justify-center">
              <Legend
                items={[
                  { label: "Subscriptions", className: "bg-step-3" },
                  { label: "Usage & services", className: "bg-track" },
                ]}
              />
            </div>

            <div className="mt-5">
              <PanelButton>View Detail</PanelButton>
            </div>
          </section>

          <section className="border-t border-border py-7">
            <p className="text-[13px] text-muted-foreground">Active customers</p>
            <p className="mt-2 flex items-center gap-2.5 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {/* The meter's zero, carried up to the number it counts. */}
              <span aria-hidden className="h-7 w-[3px] rounded-full bg-step-3" />
              {CUSTOMERS.total.toLocaleString()}
            </p>

            <div className="mt-4">
              <TickMeter
                share={paidShare}
                label={`${CUSTOMERS.parts[0].count.toLocaleString()} of ${CUSTOMERS.total.toLocaleString()} customers on a paid plan`}
              />
            </div>
            <div className="mt-4">
              <Legend
                items={[
                  { label: "Paid", className: "bg-step-3" },
                  { label: "Free", className: "bg-track" },
                ]}
              />
            </div>
          </section>

          <section className="border-t border-border py-7">
            <h2 className="text-[13px] text-muted-foreground">{TAX_PAYMENT.label}</h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <Row label="Date">
                {new Intl.DateTimeFormat(DATE_LOCALE, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(TAX_PAYMENT.paidOn)}
              </Row>
              <Row label="Amount">
                <span className="tabular-nums">{formatMoney(TAX_PAYMENT.amount)}</span>
              </Row>
              <Row label="Payment method">
                <span className="tabular-nums">{TAX_PAYMENT.method}</span>
              </Row>
              <Row label="Status">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium">
                  {TAX_PAYMENT.status}
                </span>
              </Row>
            </dl>

            <div className="mt-5">
              <PanelButton>View Details</PanelButton>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * The quiet action in a section heading — present, but never the loud thing.
 *
 * The icon arrives as a component rather than as children so the button can
 * hold the ref that drives it: the glyph is 14px inside a button three times
 * that, and the animation belongs to pointing at the action.
 */
function GhostButton({
  icon: Icon,
  href,
  children,
}: {
  icon: AnimatedIcon;
  /** A link when it goes somewhere; a button otherwise. */
  href?: string;
  children: React.ReactNode;
}) {
  const handle = useRef<AnimatedIconHandle>(null);
  const props = {
    onMouseEnter: () => handle.current?.startAnimation(),
    onMouseLeave: () => handle.current?.stopAnimation(),
    className:
      "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition-[background-color,scale] duration-150 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none active:scale-[0.96]",
  };
  const content = (
    <>
      <Icon ref={handle} size={14} className="shrink-0 text-muted-foreground" />
      {children}
    </>
  );
  return href ? (
    <Link href={href} {...props}>
      {content}
    </Link>
  ) : (
    <button type="button" {...props}>
      {content}
    </button>
  );
}

/** The one action that closes out a panel in the rail. */
function PanelButton({ children }: { children: React.ReactNode }) {
  const arrow = useRef<AnimatedIconHandle>(null);

  return (
    <button
      type="button"
      onMouseEnter={() => arrow.current?.startAnimation()}
      onMouseLeave={() => arrow.current?.stopAnimation()}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-muted text-[13px] font-medium transition-[background-color,scale] duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none active:scale-[0.96]"
    >
      {children}
      <ArrowRightIcon ref={arrow} size={14} strokeWidth={2} className="shrink-0" />
    </button>
  );
}

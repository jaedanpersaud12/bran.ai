"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MonoTooltip } from "@/components/bran/MonoTooltip";
import { DATE_LOCALE, formatMoney, type RevenuePoint } from "@/lib/metrics";

/**
 * Mono Curved Wave Area — the amicro Mono Charts area chart, on our data.
 *
 * Ported from `MonoRoundedAreaChart`, keeping what makes it that chart: the
 * horizontal-only dashed grid, the axes stripped of their lines and ticks, a
 * monotone spline at 2.5px with rounded caps and joins, and a fill that is a
 * single-hue gradient falling to zero. Their component hardcodes six readings
 * in `MONO_AREA_DATA` and takes no data prop, so the port is the chart, not
 * the module.
 *
 * Three things of theirs are left out. The header and footer, because the
 * section around this already says what it is. And the tinted stage panel the
 * chart sits on, because on a ruled grid it reads as a card that wandered in
 * from a different design — the line carries itself.
 */

/** Round, and the same whatever the window: a fitted axis makes a flat month
 *  and a doubled one draw the same shape. */
const CEILING = 100_000;
const TICKS = [0, 20_000, 40_000, 60_000, 80_000, 100_000];

export default function MonoAreaChart({ series }: { series: RevenuePoint[] }) {
  // A page with two of these would otherwise share one gradient id, and the
  // second would silently repaint the first.
  const gradientId = `${useId().replace(/:/g, "")}-mono-area`;

  /*
   * Recharts runs its own animation and knows nothing about
   * `prefers-reduced-motion`, so the CSS guard the rest of the charts sit
   * under does not reach it. Read after mount rather than during render: the
   * server has no media query to answer, and branching on one here would mean
   * the markup React builds on the client disagrees with what was sent.
   */
  const [stillness, setStillness] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStillness(query.matches);
    const onChange = () => setStillness(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const day = new Intl.DateTimeFormat(DATE_LOCALE, { month: "short", day: "numeric" });
  const full = new Intl.DateTimeFormat(DATE_LOCALE, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });

  const data = series.map((point) => ({
    at: point.at,
    label: day.format(new Date(point.at)),
    full: full.format(new Date(point.at)),
    mrr: point.mrr,
  }));

  return (
    <figure className="m-0">
      <div className="relative w-full">
        {/* The gradient lives in its own zero-sized svg, the way theirs does,
            so the definition survives Recharts re-rendering the chart tree. */}
        <svg className="pointer-events-none absolute size-0">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--line)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--line)" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              // Thirty labels would overlap into a grey smear; the one you
              // actually want is in the tooltip.
              interval={Math.max(0, Math.floor(data.length / 5) - 1)}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={[0, CEILING]}
              ticks={TICKS}
              width={44}
              tickFormatter={(value: number) => (value === 0 ? "0" : `${value / 1000}k`)}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--line)", strokeOpacity: 0.35, strokeWidth: 1 }}
              content={
                <MonoTooltip
                  indicator="dot"
                  format={(value) =>
                    typeof value === "number" ? formatMoney(value) : String(value)
                  }
                />
              }
              // The axis label is the short form; the card gets the long one
              // off the row itself, since Recharts hands the payload over.
              labelFormatter={(_label, items) =>
                (items?.[0]?.payload as { full?: string } | undefined)?.full ?? ""
              }
            />

            <Area
              type="monotone"
              dataKey="mrr"
              name="MRR"
              stroke="var(--line)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradientId})`}
              // A ring in the panel colour, so the dot stays legible sitting
              // on top of the line it is marking.
              activeDot={{ r: 4, fill: "var(--line)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={!stillness}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* The numbers behind the line, for anyone who cannot read the line. */}
      <figcaption className="sr-only">
        Monthly recurring revenue.{" "}
        {data.map((point) => `${point.label}: ${formatMoney(point.mrr)}`).join(". ")}
      </figcaption>
    </figure>
  );
}

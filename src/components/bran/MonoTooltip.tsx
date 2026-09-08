"use client";

/**
 * The Mono Charts tooltip, ported from `DitherChartTooltipContent` in the
 * amicro collection.
 *
 * Kept structurally identical — a bordered, blurred card, a hairline-separated
 * label row, then a dot, a name and a tabular value per series. The two
 * changes are ours: the palette comes from our tokens instead of their
 * hardcoded `#181818`/white pair, so it follows the app rather than carrying
 * its own theme prop, and the value goes through a formatter so a revenue
 * figure arrives as `TT$92,000.00` rather than `92000`.
 */
export type MonoTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    name?: string;
    dataKey?: string | number;
    color?: string;
    fill?: string;
  }>;
  label?: string;
  indicator?: "dot" | "line";
  format?: (value: number | string) => string;
};

export function MonoTooltip({
  active,
  payload,
  label,
  indicator = "dot",
  format,
}: MonoTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="pointer-events-none z-50 rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-2xl shadow-black/10 backdrop-blur-md">
      {label ? (
        <div className="mb-1.5 border-b border-border pb-1 font-medium tracking-tight text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => {
          const color = item.color || item.fill || "var(--line)";
          const value =
            format && item.value !== undefined
              ? format(item.value)
              : typeof item.value === "number"
                ? item.value.toLocaleString()
                : item.value;

          return (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {indicator === "dot" ? (
                  <span
                    className="size-2 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                  />
                ) : (
                  <span
                    className="h-0.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="font-normal text-muted-foreground">
                  {item.name || item.dataKey}
                </span>
              </div>
              <span className="font-semibold tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type Segment = {
  label: string;
  /** Fraction of the whole, 0 to 1. The set should add up to 1. */
  share: number;
};

/**
 * Parts of one budget, side by side.
 *
 * The three greys are a ramp rather than three hues: unused, used and reserved
 * are stages of the same money, so a ranking reads better than a category set,
 * and a ramp survives being printed or read by someone who cannot separate
 * red from green. The percentage is written above each part, since a viewer
 * should never have to measure a bar to get a number off it.
 */
const FILLS = ["bg-step-1", "bg-step-2", "bg-step-3"];

export function SegmentedBar({ segments }: { segments: Segment[] }) {
  return (
    <div className="flex gap-1.5">
      {segments.map((segment, index) => (
        <div key={segment.label} style={{ width: `${segment.share * 100}%` }}>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {Math.round(segment.share * 100)}%
          </p>
          {/* A hairline tying the figure to the start of the part it counts —
              without it the two rows read as unrelated. */}
          <div className="mt-1 h-2 w-px bg-input" />
          <div
            className={`segment mt-1.5 h-3.5 rounded-full ${FILLS[index % FILLS.length]}`}
            // Left to right, in the order the money is spoken about: what is
            // left, what went, what is promised.
            style={{ animationDelay: `${index * 90}ms` }}
            role="img"
            aria-label={`${segment.label}: ${Math.round(segment.share * 100)}%`}
          />
        </div>
      ))}
    </div>
  );
}

/** The key beneath a chart: a swatch, and what it stands for. */
export function Legend({
  items,
}: {
  items: { label: string; className: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-1.5 rounded-full ${item.className}`} />
          <span className="text-[12px] text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

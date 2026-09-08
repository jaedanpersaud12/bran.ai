const TICKS = 88;

/**
 * A share of a whole, as a row of ticks.
 *
 * A plain progress bar reads as "how far along", which is wrong here — nothing
 * is in progress, the population is simply split. Ticks read as a count, and
 * the eye can pick the boundary out of them without the percentage being
 * printed at all. It is printed anyway, above the boundary, because motion
 * and position are never the only channel.
 */
export function TickMeter({ share, label }: { share: number; label: string }) {
  const clamped = clamp(share, 0, 1);
  const filled = Math.round(clamped * TICKS);
  const percent = Math.round(clamped * 100);

  return (
    <div>
      <div className="relative h-4">
        <span
          className="absolute -translate-x-1/2 text-[11px] font-medium tabular-nums text-muted-foreground"
          // Kept off both ends so the label never hangs outside the meter it
          // belongs to.
          style={{ left: `${clamp(clamped, 0.06, 0.94) * 100}%` }}
        >
          {percent}%
        </span>
      </div>

      {/*
       * The wipe is one animation on the row, not eighty-eight on the columns.
       * Both read the same — the meter filling left to right — but staggering
       * a per-column entrance meant eighty-eight composited layers coming up
       * at once while the page was still hydrating, for an effect a single
       * clip-path gives away free.
       */}
      <div className="wipe flex h-7 items-stretch gap-px" role="img" aria-label={label}>
        {Array.from({ length: TICKS }, (_, index) => (
          <span
            key={index}
            className={`flex-1 rounded-full ${index < filled ? "bg-step-3" : "bg-track"}`}
          />
        ))}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

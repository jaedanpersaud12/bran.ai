import { ArrowDown, ArrowUp } from "lucide-react";
import type { Delta } from "@/lib/metrics";

/**
 * A change, and whether it is the change you wanted.
 *
 * Colour is the second signal here, not the first: the arrow points the way
 * the number moved, so the badge still reads with the colour taken away. Which
 * direction counts as good is the caller's to say — average order value
 * falling is bad, refund rate falling is not.
 */
export function DeltaBadge({ delta, riseIsGood }: { delta: Delta; riseIsGood: boolean }) {
  const rose = delta.percent >= 0;
  const good = rose === riseIsGood;
  const Arrow = rose ? ArrowUp : ArrowDown;

  return (
    <p className="flex items-center gap-1.5 text-[12.5px]">
      <span
        className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
          good ? "text-positive" : "text-negative"
        }`}
      >
        {/* 2px to match the medium-weight figure beside it. */}
        <Arrow className="size-3.5" strokeWidth={2} />
        {Math.abs(delta.percent)}%
      </span>
      <span className="text-muted-foreground">{delta.since}</span>
    </p>
  );
}

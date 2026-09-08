"use client";

import { useRef } from "react";
import { Calendar, Ellipsis } from "lucide-react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { SlidersHorizontalIcon } from "@/components/icons/sliders-horizontal";
import type { AnimatedIconHandle } from "@/components/icons/types";

/**
 * The controls that scope the screen.
 *
 * None of them are wired yet — the whole dashboard reads one fixed thirty-day
 * window (see `src/lib/metrics.ts`). They are real buttons rather than a
 * picture of buttons, so the states are already right when the handlers land.
 */

const PILL = [
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border",
  "text-[13px] font-medium",
  // Naming the properties keeps the transition off `border-color`, which the
  // focus ring changes — otherwise focus fades in late.
  "transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.96]",
  "focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none",
].join(" ");

export function Toolbar({ range }: { range: string }) {
  const chevron = useRef<AnimatedIconHandle>(null);
  const sliders = useRef<AnimatedIconHandle>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onMouseEnter={() => chevron.current?.startAnimation()}
        onMouseLeave={() => chevron.current?.stopAnimation()}
        className={`${PILL} px-3`}
      >
        <span>Last 30 days</span>
        <ChevronDownIcon ref={chevron} size={14} className="text-muted-foreground" />
      </button>

      <div className={`${PILL} px-3`}>
        <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="tabular-nums">{range}</span>
      </div>

      <button
        type="button"
        onMouseEnter={() => sliders.current?.startAnimation()}
        onMouseLeave={() => sliders.current?.stopAnimation()}
        className={`${PILL} px-3`}
      >
        <SlidersHorizontalIcon ref={sliders} size={14} className="text-muted-foreground" />
        <span>Customize</span>
      </button>

      <button type="button" aria-label="More options" className={`${PILL} w-9`}>
        <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.5} />
      </button>
    </div>
  );
}

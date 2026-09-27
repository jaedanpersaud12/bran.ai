"use client";

// Every list screen narrows the same way — pick a value,
// see it named on the control, click × to drop it. These are that one gesture.
// Options open in a Base UI menu.

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The one height every filter is built to — a 28px pill beside a 32px one reads as two
 * unrelated controls. The padding is the inset on all four sides and the halves stretch
 * into what's left, so the hover fill sits the same distance from every edge.
 */
const CHIP = "inline-flex h-8 items-stretch gap-0.5 rounded-lg border border-border bg-card p-1";

/**
 * The trigger inside a chip. No height of its own (see CHIP). Its radius is the chip's
 * less the 5px inset — 4px padding and the 1px border — so the two curves are concentric.
 */
const CHIP_TRIGGER =
  "flex h-full items-center gap-1.5 rounded-[calc(var(--radius-lg)-5px)] px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-popup-open:bg-muted";

/** The × that drops a filter back to "all". Square against whatever the inner height is. */
const CHIP_CLEAR =
  "flex aspect-square shrink-0 items-center justify-center rounded-[calc(var(--radius-lg)-5px)] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** The label half of a chip: what it filters, what it's set to, and the chevron. */
function FilterChipLabel({ icon, label, valueLabel }: { icon?: ReactNode; label: string; valueLabel: string | null }) {
  return (
    <>
      {icon ? (
        <span aria-hidden className="flex items-center text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="text-muted-foreground">{label}</span>
      {valueLabel ? (
        <>
          <span aria-hidden className="text-muted-foreground/60">
            =
          </span>
          <span className="whitespace-nowrap text-foreground">{valueLabel}</span>
        </>
      ) : null}
      <ChevronDownIcon aria-hidden className="size-3 text-muted-foreground/60" />
    </>
  );
}

type FilterChipProps<T extends string> = {
  label: string;
  icon?: ReactNode;
  /** The chosen option, or null when the filter is off (which also hides the ×). */
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | null) => void;
  className?: string;
};

/** One filter over a fixed set of options — click to change it, × to drop it. */
function FilterChip<T extends string>({ label, icon, value, options, onChange, className }: FilterChipProps<T>) {
  const valueLabel = options.find((option) => option.value === value)?.label ?? null;

  return (
    <span data-slot="filter-chip" className={cn(CHIP, className)}>
      <Menu.Root>
        <Menu.Trigger aria-label={`${label}${valueLabel ? `: ${valueLabel}` : ""}. Change filter`} className={CHIP_TRIGGER}>
          <FilterChipLabel icon={icon} label={label} valueLabel={valueLabel} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={6} className="isolate z-50">
            <Menu.Popup className="min-w-40 origin-(--transform-origin) rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-popover outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <Menu.RadioGroup value={value ?? ""} onValueChange={(next: string) => onChange((next || null) as T | null)}>
                {options.map((option) => (
                  <Menu.RadioItem
                    key={option.value}
                    value={option.value}
                    closeOnClick
                    className="flex h-8 cursor-default items-center justify-between gap-6 rounded-[calc(var(--radius-lg)-4px)] px-2 text-xs font-medium outline-none select-none data-highlighted:bg-muted"
                  >
                    {option.label}
                    <Menu.RadioItemIndicator>
                      <CheckIcon aria-hidden className="size-3.5 text-foreground" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {valueLabel ? (
        <button type="button" onClick={() => onChange(null)} aria-label={`Clear ${label} filter`} className={CHIP_CLEAR}>
          <XIcon className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/**
 * The band that holds filters: chips on the left, whatever the selection allows on the
 * right. Sits between a card header's rule and the table's own, so it pads both sides.
 */
function FilterBand({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div data-slot="filter-band" className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-2.5", className)}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Drops every filter at once. Render it only while at least one is set. */
function ClearFilters({ onClear, children = "Clear filters" }: { onClear: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <XIcon className="size-3" aria-hidden /> {children}
    </button>
  );
}

export { FilterChip, FilterChipLabel, FilterBand, ClearFilters, CHIP, CHIP_CLEAR, CHIP_TRIGGER };

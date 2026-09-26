import * as React from "react";

import { cn } from "@/lib/utils";

// Palette classes replaced with contract status tokens;
// every tone's text reads at small size on its own 10% tint.

type PillTone = "success" | "warning" | "danger" | "info" | "neutral" | "solid";

/** The pill's shape without a tone — shared with the filter chips so both read as one family. */
const PILL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0";

const PILL_TONES: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
  // The terminal state — something that landed reads as finished at a glance.
  solid: "border-transparent bg-foreground text-background",
};

/**
 * Status chip with a leading dot, or a leading `icon` in its place. Turn `dot` off for
 * labels that name a thing rather than a state (a payment method, a referral code) —
 * a dot there reads as a status the row doesn't have. `icon` wins over the dot.
 */
function StatusPill({
  tone = "neutral",
  dot = true,
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: PillTone; dot?: boolean; icon?: React.ReactNode }) {
  return (
    <span data-slot="status-pill" className={cn(PILL, PILL_TONES[tone], className)} {...props}>
      {icon ?? (dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null)}
      {children}
    </span>
  );
}

export { StatusPill, PILL, PILL_TONES, type PillTone };

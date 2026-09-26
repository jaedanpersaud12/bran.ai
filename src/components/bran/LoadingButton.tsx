"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A button that reports on its own round trip without changing width —
 * app-ui §8, built locally until `@ja3dan/loading-button` is published.
 *
 * Both labels sit in the same grid cell and the hidden one keeps its space,
 * so the button is as wide as its widest state from the start and never
 * nudges its neighbours mid-click.
 */
export function LoadingButton({
  pending,
  pendingLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button {...props} disabled={pending || props.disabled} aria-busy={pending}>
      <span className="grid">
        <span
          className={`col-start-1 row-start-1 transition-opacity duration-150 ${pending ? "opacity-0" : ""}`}
        >
          {children}
        </span>
        <span
          aria-hidden={!pending}
          className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 transition-opacity duration-150 ${
            pending ? "" : "opacity-0"
          }`}
        >
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          {pendingLabel}
        </span>
      </span>
    </Button>
  );
}

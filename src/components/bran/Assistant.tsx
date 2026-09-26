"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircleIcon } from "@/components/icons/message-circle";
import type { AnimatedIconHandle } from "@/components/icons/types";
import { assistantState, type AssistantState } from "@/actions/assistant";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Loaded when the sheet opens, not with every page (see AssistantChat). */
const Chat = dynamic(() => import("@/components/bran/AssistantChat"), {
  ssr: false,
  loading: () => <p className="p-5 text-[13px] text-muted-foreground">Loading…</p>,
});

/**
 * Ask bran — the assistant, working over this workspace's own data.
 *
 * A panel rather than a page, so it sits beside whatever screen you asked
 * from. Every answer comes from the tools it calls (shown, collapsed, with
 * the reply), and the two things it can change — a draft purchase order and a
 * stock count — stop at a confirmation bran wrote from the database, not the
 * model.
 */

export function Assistant() {
  const icon = useRef<AnimatedIconHandle>(null);
  const [state, setState] = useState<AssistantState | null>(null);

  const check = () => {
    assistantState()
      .then(setState)
      .catch(() => setState({ available: false, reason: "Couldn't reach bran. Try again." }));
  };

  return (
    <Sheet onOpenChange={(open) => (open ? check() : undefined)}>
      <SheetTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => icon.current?.startAnimation()}
          onMouseLeave={() => icon.current?.stopAnimation()}
          className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-background px-3 py-2 text-left text-[13px] font-medium transition-[background-color,scale] duration-150 hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/25 focus-visible:outline-none active:scale-[0.96] group-data-[collapsible=icon]:hidden"
        >
          <MessageCircleIcon ref={icon} size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1">Ask bran</span>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="text-[15px]">Ask bran</SheetTitle>
          <SheetDescription className="text-[13px]">
            Answers from your stock, restock and purchase orders. It asks before it drafts an
            order or changes a count.
          </SheetDescription>
        </SheetHeader>

        {state === null ? (
          <p className="p-5 text-[13px] text-muted-foreground">Checking…</p>
        ) : state.available ? (
          <Chat suggestions={state.suggestions} />
        ) : (
          // AI off or signed out is a normal state, said plainly — no input that goes nowhere.
          <p className="p-5 text-[13px] text-muted-foreground">{state.reason}</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

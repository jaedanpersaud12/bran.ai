"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleIcon } from "@/components/icons/message-circle";
import type { AnimatedIconHandle } from "@/components/icons/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import StreamingText from "@/components/primitives/StreamingText";
import ThinkingState from "@/components/primitives/ThinkingState";
import ToolChips from "@/components/primitives/ToolChips";
import TaskRows from "@/components/primitives/TaskRows";
import PromptBar from "@/components/primitives/PromptBar";
import { ASSISTANT, CONVERSATIONS } from "@/lib/demo";

/**
 * The assistant, as a panel rather than a section.
 *
 * It is not in the nav on purpose. An assistant that answers a customer while
 * you are looking at the restock list is worth having open next to the restock
 * list — making it a destination would mean leaving the screen you needed it
 * for.
 *
 * The thread is built from Beautiful UI's primitives (beautifului.dev, MIT,
 * installed through their shadcn registry): the reasoning trace, the tool
 * chips, the task rows, the streaming answer and the composer are all theirs.
 * Three conversations rather than one, because the assistant does three
 * different jobs here — it closes a sale in a DM, it reasons about stock, and
 * it runs the dispatch — and a single transcript would only ever show whichever
 * happened last.
 */

/** The DM thread's tool calls, in the shape ToolChips expects. */
const DM_STEPS = [
  {
    icon: "read",
    label: "Checked stock",
    chip: "FLV-TRI-BLK-S",
    mono: true,
    detailMono: true,
    detail: [{ text: "4 on hand · 3 days cover" }],
  },
  {
    icon: "write",
    label: "Reserved",
    chip: "1 unit · 2 hours",
    mono: false,
    detailMono: false,
    detail: [{ text: "Held against BRN-4822", tone: "add" as const }],
  },
  {
    icon: "run",
    label: "Quoted courier",
    chip: "Zoom TT · Chaguanas",
    mono: false,
    detailMono: false,
    detail: [{ text: "TT$35 · next-day" }],
  },
  {
    icon: "think",
    label: "Drafted reply",
    chip: "in dialect",
    mono: false,
    detailMono: false,
    detail: [{ text: "Matched to her own phrasing" }],
  },
];

/** The dispatch thread's run, in the shape TaskRows expects. */
const DISPATCH_ROWS = [
  {
    key: "packed",
    label: "Packed and paid",
    amount: "6 orders",
    status: "done" as const,
    details: [
      { label: "Zoom TT collection", meta: "5" },
      { label: "Moving Solutions", meta: "1" },
    ],
  },
  {
    key: "holds",
    label: "Holding stock on unpaid",
    amount: "3 orders",
    status: "running" as const,
    step: 1,
    details: [{ label: "Released in", meta: "58 min" }],
  },
  {
    key: "tobago",
    label: "Tobago collection",
    amount: "1 order",
    status: "sequence" as const,
    details: [{ label: "Moving Solutions collects", meta: "Tue" }],
  },
];

/**
 * Mirrors ToolChips' own `STEP_MS`. The handoff from the tool calls to the
 * answer is timed off the rate the chips actually step at, rather than a round
 * number picked to look about right — if that constant moves, this follows.
 */
const TOOL_STEP_MS = 700;

/** One word per token, which is how StreamingText reveals an answer. */
function tokens(answer: string) {
  return answer.split(" ").map((text) => ({ text }));
}

export function Assistant() {
  const icon = useRef<AnimatedIconHandle>(null);
  const [active, setActive] = useState(0);
  const conversation = CONVERSATIONS[active];

  /*
   * A run arrives in stages, not all at once.
   *
   * 0 — it is thinking. 1 — the tool calls it made. 2 — the answer.
   * Blocks accumulate rather than replace each other, which is what a real
   * transcript does: the reasoning and the calls stay above the answer they
   * produced. The advance is driven by the primitives' own signals where they
   * have them (`onSettled`), and by their own step rate where they do not.
   */
  const [stage, setStage] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Switching threads restarts the run.
  useEffect(() => {
    setStage(0);
  }, [conversation.key]);

  // Reduced motion gets the whole transcript at once: staging it would mean
  // withholding the answer from somebody who asked for no animation.
  useEffect(() => {
    if (still) setStage(2);
  }, [still, conversation.key]);

  const toolBlock =
    conversation.key === "dm" ? "chips" : conversation.key === "dispatch" ? "rows" : null;

  const onSettled = useCallback(() => {
    // Nothing to show between thinking and the answer on a thread with no
    // tool calls, so it skips straight past that stage.
    setStage((current) => (current === 0 ? (toolBlock ? 1 : 2) : current));
  }, [toolBlock]);

  useEffect(() => {
    if (stage !== 1 || still) return;
    const rows = toolBlock === "chips" ? DM_STEPS.length : DISPATCH_ROWS.length;
    const timer = setTimeout(() => setStage(2), rows * TOOL_STEP_MS);
    return () => clearTimeout(timer);
  }, [stage, toolBlock, still]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => icon.current?.startAnimation()}
          onMouseLeave={() => icon.current?.stopAnimation()}
          className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-background px-3 py-2 text-left text-[13px] font-medium transition-[background-color,scale] duration-150 hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/25 focus-visible:outline-none active:scale-[0.96] group-data-[collapsible=icon]:hidden"
        >
          <MessageCircleIcon ref={icon} size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1">Assistant</span>
          {/* The count is the reason to open it, so it goes on the trigger. */}
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {ASSISTANT.handled.toLocaleString()}
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="text-[15px]">Assistant</SheetTitle>
          <SheetDescription className="text-[13px]">
            Trained on this brand&apos;s own conversations, so it answers a customer in the
            language they asked in.
          </SheetDescription>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
            <Figure label="Handled" value={`${Math.round(ASSISTANT.handledShare * 100)}%`} />
            <Figure label="Orders closed" value={ASSISTANT.ordersClosed.toLocaleString()} />
            <Figure label="Median reply" value={`${ASSISTANT.medianReplySeconds}s`} />
          </dl>

          {/* Our own tabs rather than the composer's, because switching has to
              swap the whole thread — the trace, the tool calls and the answer
              all belong to one conversation. */}
          <div role="tablist" className="mt-4 flex flex-wrap gap-1">
            {CONVERSATIONS.map((item, index) => {
              const selected = index === active;
              return (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(index)}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-[background-color,color] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none ${
                    selected
                      ? "bg-muted text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Only the thread scrolls; the header and composer stay put. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-col items-end">
            <p className="max-w-[85%] rounded-xl bg-muted px-3 py-2 text-[13px] leading-relaxed ring-1 ring-border">
              {conversation.opener}
            </p>
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">{conversation.who}</p>
          </div>

          {/* Keyed on the conversation so every primitive restarts its own
              animation when you switch, instead of showing the last thread's
              finished state under the new thread's heading. */}
          <div key={conversation.key} className="space-y-4">
            <ThinkingState variant={conversation.thinking} onSettled={onSettled} />

            {stage >= 1 && toolBlock === "chips" ? (
              <div className="step-in">
                <ToolChips
                  steps={DM_STEPS}
                  diffs={[]}
                  diffLines={{}}
                  labels={{ header: `${DM_STEPS.length} tool calls, 1 message` }}
                />
              </div>
            ) : null}

            {stage >= 1 && toolBlock === "rows" ? (
              <div className="step-in">
                <TaskRows variant="List" rows={DISPATCH_ROWS} />
              </div>
            ) : null}

            {stage >= 2 ? (
              <div className="step-in">
                <StreamingText
                  fill
                  loop={false}
                  content={tokens(conversation.answer)}
                  sources={[]}
                  followUps={conversation.followUps}
                  labels={{ sources: "", followUps: "Follow-ups" }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border p-4">
          {/* `demo` off: the walkthrough that drives its own menus is for
              their gallery, and in a real panel it opens the slash palette
              over the thread you are reading. */}
          <PromptBar demo={false} placeholder="Step in and reply yourself…" />
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Replying yourself hands the thread back to you. The assistant stops until you
            release it.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

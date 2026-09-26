"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Minus, Plus, Sparkles, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { draftPurchaseOrder } from "@/actions/purchase-orders";
import type { RestockLine } from "@/lib/inventory";
import { formatMoneyWhole } from "@/lib/metrics";
import type { Verdict } from "@/lib/restock";

/**
 * Turning the model's advice into an order.
 *
 * The screen used to stop at a diagnosis: here are the lines running out, good
 * luck. Everything below exists to close that gap — the quantities arrive
 * filled in with what the model would do, and the work left is disagreeing
 * with it.
 *
 * Which is why a changed quantity is never silently accepted. Once a figure
 * differs from the suggestion the row says so in words and keeps the original
 * visible, because the whole value of restock intelligence is knowing what it
 * thought before you overrode it.
 */

/** Nothing sensible orders a negative quantity, and 999 is already absurd. */
const MAX = 999;

const VERDICT: Record<Verdict, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  reorder: { label: "Reorder", variant: "destructive" },
  watch: { label: "Watch", variant: "outline" },
  hold: { label: "Hold", variant: "secondary" },
};

export function ReorderPlanner({ items }: { items: RestockLine[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.variantId, item.score.suggested])),
  );
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.score.suggested > 0).map((item) => item.variantId)),
  );
  const [drafted, setDrafted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const order = useMemo(() => {
    const lines = items.filter((item) => picked.has(item.variantId) && quantities[item.variantId] > 0);
    return {
      items: lines,
      lines: lines.length,
      units: lines.reduce((sum, item) => sum + quantities[item.variantId], 0),
      cost: lines.reduce((sum, item) => sum + quantities[item.variantId] * item.unitCostCents, 0) / 100,
      /** Lines where the buyer has overruled the model. */
      changed: lines.filter((item) => quantities[item.variantId] !== item.score.suggested).length,
    };
  }, [items, picked, quantities]);

  const setQuantity = (id: string, next: number) => {
    setQuantities((current) => ({ ...current, [id]: clamp(next, 0, MAX) }));
    setDrafted(null);
  };

  const draft = () => {
    setError(null);
    startTransition(async () => {
      const result = await draftPurchaseOrder(
        order.items.map((item) => ({ variantId: item.variantId, quantity: quantities[item.variantId] })),
      );
      if (result.ok) setDrafted(result.reference);
      else setError(result.error);
    });
  };

  const toggle = (id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDrafted(null);
  };

  const allPicked = picked.size === items.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPicked}
                  aria-label={allPicked ? "Clear selection" : "Select every line"}
                  onCheckedChange={() =>
                    setPicked(allPicked ? new Set() : new Set(items.map((i) => i.variantId)))
                  }
                />
              </TableHead>
              <TableHead>Piece</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Cover</TableHead>
              <TableHead>Why</TableHead>
              <TableHead className="w-44 text-right">Order</TableHead>
              <TableHead className="text-right">Line cost</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item) => {
              const quantity = quantities[item.variantId];
              const selected = picked.has(item.variantId);
              const suggested = item.score.suggested;
              const overruled = selected && quantity !== suggested;
              const verdict = VERDICT[item.score.verdict];

              return (
                <TableRow key={item.variantId} data-state={selected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggle(item.variantId)}
                      aria-label={`Include ${item.name}, ${item.variant}`}
                    />
                  </TableCell>

                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {item.variant}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {item.onHand === 0 ? <Badge variant="destructive">Out</Badge> : item.onHand}
                    {item.onOrder > 0 ? (
                      <span className="block text-[11.5px] text-muted-foreground">
                        +{item.onOrder} coming
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {item.score.cover === null
                      ? "—"
                      : item.score.cover > 90
                        ? "90d+"
                        : `${Math.round(item.score.cover)}d`}
                  </TableCell>

                  <TableCell className="max-w-[24rem] min-w-56 whitespace-normal text-[12.5px] text-muted-foreground">
                    <Badge variant={verdict.variant} className="mb-1">
                      {verdict.label}
                    </Badge>
                    <span className="block">
                      {item.reason}
                      {/* Said, not just styled: the reader should know which
                          sentences a model wrote. */}
                      {item.reasonSource === "model" ? (
                        <span
                          title="Written by the model from the numbers in this row. The verdict and quantity are the formula's."
                          className="ml-1.5 inline-flex translate-y-[1px] items-center gap-0.5 text-[11px] text-subtle-foreground"
                        >
                          <Sparkles aria-hidden className="size-3" strokeWidth={1.5} />
                          <span className="sr-only">Explained by the model</span>
                        </span>
                      ) : null}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col items-end gap-1">
                      <Stepper
                        value={quantity}
                        disabled={!selected}
                        label={`Units of ${item.name}, ${item.variant}`}
                        onChange={(next) => setQuantity(item.variantId, next)}
                      />
                      {/* The override is stated, not just coloured — the point
                          of the suggestion is that you can see you left it. */}
                      {overruled ? (
                        <button
                          type="button"
                          onClick={() => setQuantity(item.variantId, suggested)}
                          className="flex items-center gap-1 rounded text-[11.5px] text-muted-foreground transition-[color] duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none"
                        >
                          <Undo2 className="size-3" strokeWidth={1.5} />
                          Model said {suggested}
                        </button>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {selected && quantity > 0 ? (
                      <>
                        <span className="font-medium">
                          {formatMoneyWhole((quantity * item.unitCostCents) / 100)}
                        </span>
                        {/* The arithmetic, so the total is checkable without
                            opening a calculator. */}
                        <span className="block text-[11.5px] text-muted-foreground">
                          {quantity} × {formatMoneyWhole(item.unitCostCents / 100)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/*
       * The order bar.
       *
       * Sticky rather than fixed, so it rides the page instead of hovering
       * over the sidebar, and it only exists once there is something to order
       * — a permanently docked bar reading "0 lines" is furniture.
       *
       * Outer radius is inner radius plus the padding: an 8px pad around a
       * 10px control wants an 18px corner, which is what keeps the two curves
       * concentric instead of merely both round.
       */}
      <div
        aria-hidden={order.lines === 0}
        className="pointer-events-none sticky bottom-4 z-20 mt-4 flex justify-center"
        style={{
          opacity: order.lines === 0 ? 0 : 1,
          transform: order.lines === 0 ? "translateY(8px)" : "none",
          transition:
            "opacity var(--duration-fast) var(--ease-smooth-out), transform var(--duration-fast) var(--ease-smooth-out)",
        }}
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-card p-2 pl-4 shadow-border">
          <p className="text-[13px] tabular-nums">
            <span className="font-semibold">{order.lines}</span>
            <span className="text-muted-foreground">
              {order.lines === 1 ? " line" : " lines"} ·{" "}
            </span>
            <span className="font-semibold">{order.units}</span>
            <span className="text-muted-foreground"> units · </span>
            <span className="font-semibold">{formatMoneyWhole(order.cost)}</span>
            {order.changed > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · {order.changed} changed
              </span>
            ) : null}
          </p>

          {drafted ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] font-medium">
              {/* 2px to carry the weight of the semibold text beside it. */}
              <Check className="size-3.5 text-positive" strokeWidth={2} />
              Drafted {drafted}
            </p>
          ) : (
            <Button size="sm" className="rounded-lg" disabled={pending} onClick={draft}>
              {pending ? "Saving…" : "Draft purchase order"}
            </Button>
          )}
        </div>
      </div>

      {drafted ? (
        <p className="mt-2 text-center text-[12.5px] text-muted-foreground">
          Saved as a draft for you to check. Nothing has been sent to a supplier.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-center text-[12.5px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Stepper({
  value,
  disabled,
  label,
  onChange,
}: {
  value: number;
  disabled: boolean;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Step
        label="One fewer"
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-3" strokeWidth={2} />
      </Step>

      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-14 rounded-md border border-border bg-background text-center text-[13px] font-medium tabular-nums transition-[background-color,border-color] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none disabled:text-muted-foreground disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <Step label="One more" disabled={disabled || value >= MAX} onClick={() => onChange(value + 1)}>
        <Plus className="size-3" strokeWidth={2} />
      </Step>
    </div>
  );
}

function Step({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-border transition-[background-color,scale] duration-150 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

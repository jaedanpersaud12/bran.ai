"use client";

import { useEffect, useState, useTransition } from "react";
import { Store } from "lucide-react";
import {
  importStorefrontOrders,
  linkStorefrontItem,
  previewStorefrontImport,
} from "@/actions/orders";
import type { VariantOption } from "@/components/bran/OrderDialog";
import { LoadingButton } from "@/components/bran/LoadingButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { mono } from "@/components/ui/table-card";
import { PAYMENT_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE, TIME_ZONE } from "@/lib/order-status";
import type { PreviewOrder } from "@/lib/storefront-flvs";

type Loaded = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; orders: PreviewOrder[] };

/**
 * FLVS storefront orders, brought into the queue.
 *
 * Opens on the storefront orders bran hasn't imported. Each item has to be
 * matched to a catalogue variant once — the storefront's products aren't
 * bran's — and the match is saved as soon as it's picked, so the next import
 * already knows it. Only fully matched orders can be ticked. Importing runs
 * each one through the same path as a typed-in order: stock comes off, the
 * sale counts on the day the customer ordered.
 */
export function StorefrontImport({
  open,
  onClose,
  variants,
}: {
  open: boolean;
  onClose: () => void;
  variants: VariantOption[];
}) {
  // A fresh read of the storefront every time it opens.
  const [generation, setGeneration] = useState(0);
  const close = () => {
    onClose();
    setGeneration((n) => n + 1);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="scroll-slim max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-3xl">
        {open ? <ImportBody key={generation} variants={variants} onDone={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({ variants, onDone }: { variants: VariantOption[]; onDone: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ ref: string; error: string }[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    previewStorefrontImport()
      .then((result) => {
        if (!live) return;
        if (!result.ok) {
          setLoaded({ state: "error", message: result.error });
          return;
        }
        setLoaded({ state: "ready", orders: result.orders });
        // Ready orders start ticked; cancelled ones take no stock, so they wait to be asked for.
        setTicked(
          new Set(
            result.orders
              .filter((o) => o.status !== "cancelled" && o.lines.length > 0 && o.lines.every((l) => l.variantId))
              .map((o) => o.ref),
          ),
        );
      })
      .catch(() => live && setLoaded({ state: "error", message: "Couldn't reach bran. Try again." }));
    return () => {
      live = false;
    };
  }, []);

  const orders = loaded.state === "ready" ? loaded.orders : [];
  const byId = new Map(variants.map((variant) => [variant.variantId, variant]));

  const link = (key: string, variantId: string) => {
    // Every order with this item picks up the match at once.
    const update = (list: PreviewOrder[]) =>
      list.map((order) => ({
        ...order,
        lines: order.lines.map((line) => (line.key === key ? { ...line, variantId } : line)),
      }));
    setLoaded((current) => (current.state === "ready" ? { state: "ready", orders: update(current.orders) } : current));
    linkStorefrontItem(key, variantId)
      .then((result) => {
        if (!result.ok) setMessage(result.error ?? "Couldn't save the match.");
      })
      .catch(() => setMessage("Couldn't save the match. Try again."));
  };

  const submit = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await importStorefrontOrders([...ticked]);
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        if (result.skipped.length === 0) {
          onDone();
          return;
        }
        setSkipped(result.skipped);
        setLoaded((current) =>
          current.state === "ready"
            ? { state: "ready", orders: current.orders.filter((o) => !result.imported.includes(o.ref)) }
            : current,
        );
        setTicked(new Set());
      } catch {
        setMessage("Couldn't reach bran. Try again.");
      }
    });

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          <Store />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-base font-semibold">Import from the FLVS storefront</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Orders from the website that aren&apos;t in bran yet. Match each item to a variant once; bran
            remembers it next time.
          </DialogDescription>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loaded.state === "loading" ? (
          <p className="text-[13px] text-muted-foreground">Reading the storefront…</p>
        ) : loaded.state === "error" ? (
          <p role="alert" className="text-[13px] text-negative">
            {loaded.message}
          </p>
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Every storefront order is already in bran.</p>
        ) : (
          orders.map((order) => {
            const matched = order.lines.length > 0 && order.lines.every((line) => line.variantId);
            const total =
              order.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0) + order.deliveryFeeCents;
            return (
              <section key={order.ref} className="rounded-lg border border-border p-3.5" aria-label={order.ref}>
                <div className="flex flex-wrap items-center gap-2">
                  <Checkbox
                    checked={ticked.has(order.ref)}
                    disabled={!matched}
                    onCheckedChange={(checked) =>
                      setTicked((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(order.ref);
                        else next.delete(order.ref);
                        return next;
                      })
                    }
                    aria-label={`Import ${order.ref}`}
                  />
                  <span className={`${mono} text-[13px] font-medium`}>{order.ref}</span>
                  <span className="text-[13px]">{order.customerName}</span>
                  <StatusPill tone={STATUS_TONE[order.status]} dot={order.status !== "cancelled"}>
                    {STATUS_LABEL[order.status]}
                  </StatusPill>
                  <StatusPill tone={PAYMENT_TONE[order.payment]} dot={false}>
                    {PAYMENT_LABEL[order.payment]}
                  </StatusPill>
                  <span className={`ml-auto ${mono} text-[12.5px] text-muted-foreground`}>
                    {new Date(order.placedAt).toLocaleDateString("en-TT", {
                      day: "numeric",
                      month: "short",
                      timeZone: TIME_ZONE,
                    })}{" "}
                    · TT$
                    {(total / 100).toLocaleString("en-TT")}
                  </span>
                </div>
                {!order.takesStock && order.status !== "cancelled" ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Already {order.status} on the storefront: it counts as a sale, and your shelf count isn&apos;t
                    changed.
                  </p>
                ) : null}
                {order.status === "cancelled" ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Cancelled on the storefront: it&apos;s kept for the record and doesn&apos;t count as a sale.
                  </p>
                ) : null}
                <ul className="mt-3 space-y-2">
                  {order.lines.map((line) => {
                    const variant = line.variantId ? byId.get(line.variantId) : undefined;
                    const short = variant && order.takesStock && variant.onHand < line.quantity;
                    return (
                      <li key={line.key} className="grid gap-2 sm:grid-cols-[1fr_16rem] sm:items-center">
                        <span className="min-w-0 text-[13px]">
                          <span className="font-medium">{line.name}</span>
                          {line.choices ? <span className="text-muted-foreground"> · {line.choices}</span> : null}
                          <span className={`${mono} text-muted-foreground`}> × {line.quantity}</span>
                        </span>
                        <div>
                          <Select value={line.variantId ?? ""} onValueChange={(id) => link(line.key, id)}>
                            <SelectTrigger
                              className="h-8 w-full text-xs"
                              aria-label={`Variant for ${line.name} ${line.choices}`}
                              aria-invalid={!line.variantId ? true : undefined}
                            >
                              <SelectValue placeholder="Match to a variant" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {variants.map((option) => (
                                <SelectItem key={option.variantId} value={option.variantId} className="text-xs">
                                  {option.product} · {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {short ? (
                            <p className="mt-1 text-[11px] text-negative">
                              Only {variant.onHand} on hand — restock it or skip this order.
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                  {order.lines.length === 0 ? (
                    <li className="text-[12.5px] text-muted-foreground">No items bran can read on this order.</li>
                  ) : null}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {skipped.length > 0 ? (
        <div role="alert" className="mt-4 space-y-1 text-[12.5px] text-negative">
          {skipped.map((skip) => (
            <p key={skip.ref}>
              <span className={mono}>{skip.ref}</span> wasn&apos;t imported: {skip.error}
            </p>
          ))}
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="mt-4 text-[12.5px] text-negative">
          {message}
        </p>
      ) : null}

      <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5">
        <Button type="button" variant="outline" onClick={onDone}>
          Close
        </Button>
        <LoadingButton
          type="button"
          pending={pending}
          pendingLabel="Importing"
          disabled={ticked.size === 0}
          onClick={submit}
        >
          Import {ticked.size}
        </LoadingButton>
      </DialogFooter>
    </>
  );
}

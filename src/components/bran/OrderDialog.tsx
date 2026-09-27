"use client";

import { useState, useTransition } from "react";
import { Plus, Truck, X } from "lucide-react";
import { createOrderAction } from "@/actions/orders";
import { LoadingButton } from "@/components/bran/LoadingButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mono } from "@/components/ui/table-card";
import { formatMoneyInput, parseMoney, type FieldErrors } from "@/lib/catalog-input";
import {
  orderTotals,
  parseOrder,
  type LineFields,
  type LineInput,
  type OrderFields,
  type OrderInput,
} from "@/lib/order-input";
import { CHANNELS, CHANNEL_LABEL, PAYMENT_LABEL, type Payment } from "@/lib/order-status";

/** One active variant as the picker offers it. */
export type VariantOption = {
  variantId: string;
  product: string;
  label: string;
  sku: string;
  onHand: number;
  priceCents: number;
};

type Line = LineInput & { key: number };

const EMPTY: Omit<OrderInput, "lines"> = {
  customerName: "",
  customerPhone: "",
  channel: "instagram",
  delivery: "courier",
  area: "",
  payment: "unpaid",
  deliveryFee: "",
  notes: "",
};

const PAYMENTS: Payment[] = ["unpaid", "cod", "paid"];

/**
 * New order, in a modal over the queue (app-ui §7).
 *
 * The customer, where the order came in, how it's getting to them and how
 * they're paying, then one line per variant. Prices start at the catalogue's
 * and can be changed for this customer. The form checks with the same parser
 * the server runs; stock is only knowable there, so an order for more than is
 * on the shelf comes back with the variant named.
 */
export function OrderDialog({
  open,
  onClose,
  variants,
}: {
  open: boolean;
  onClose: () => void;
  variants: VariantOption[];
}) {
  // A fresh form every time it opens.
  const [generation, setGeneration] = useState(0);
  // Anything typed yet? Closing a half-entered order asks first (app-ui §7).
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    onClose();
    setConfirming(false);
    setDirty(false);
    setGeneration((n) => n + 1);
  };
  const requestClose = () => (dirty ? setConfirming(true) : close());

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? null : requestClose())}>
        <DialogContent className="scroll-slim max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-2xl">
          <OrderForm
            key={generation}
            variants={variants}
            onEdit={() => setDirty(true)}
            onCancel={requestClose}
            onDone={close}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={(next) => (next ? null : setConfirming(false))}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this order?</AlertDialogTitle>
            <AlertDialogDescription>What you&apos;ve entered hasn&apos;t been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OrderForm({
  variants,
  onEdit,
  onCancel,
  onDone,
}: {
  variants: VariantOption[];
  onEdit: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [fields, setFields] = useState(EMPTY);
  const [lines, setLines] = useState<Line[]>([{ key: 0, variantId: "", quantity: "1", unitPrice: "" }]);
  const [errors, setErrors] = useState<FieldErrors<OrderFields>>({});
  const [lineErrors, setLineErrors] = useState<FieldErrors<LineFields>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(variants.map((variant) => [variant.variantId, variant]));
  const set = (key: keyof typeof EMPTY) => (value: string) => {
    onEdit();
    setFields((f) => ({ ...f, [key]: value }));
  };
  const setLine = (key: number, patch: Partial<LineInput>) => {
    onEdit();
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  // Live totals from whatever parses; a half-typed price just doesn't count yet.
  const priced = lines.map((line) => ({
    quantity: /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : 0,
    unitPriceCents: parseMoney(line.unitPrice) ?? 0,
  }));
  // A pickup has no delivery fee, whatever was typed before switching to it.
  const totals = orderTotals(priced, fields.delivery === "courier" ? (parseMoney(fields.deliveryFee) ?? 0) : 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input: OrderInput = {
      ...fields,
      lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitPrice: line.unitPrice })),
    };
    const local = parseOrder(input);
    setMessage(null);
    if (!local.ok) {
      setErrors(local.errors);
      setLineErrors(local.lineErrors);
      return;
    }
    setErrors({});
    setLineErrors([]);
    startTransition(async () => {
      try {
        const result = await createOrderAction(input);
        if (result.ok) {
          onDone();
          return;
        }
        setErrors(result.errors ?? {});
        setLineErrors(result.lineErrors ?? []);
        setMessage(result.message ?? null);
      } catch {
        setMessage("Couldn't reach bran. Nothing was saved — try again.");
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          <Truck />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-base font-semibold">New order</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A sale from a DM, WhatsApp or in person. It comes off the shelf and counts toward restock as soon as
            it&apos;s saved.
          </DialogDescription>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="order-name" label="Customer" error={errors.customerName}>
            <Input
              id="order-name"
              value={fields.customerName}
              onChange={(e) => set("customerName")(e.target.value)}
              placeholder="Keisha M. or @keisha.m"
              aria-invalid={errors.customerName ? true : undefined}
              className="h-9"
            />
          </Field>
          <Field id="order-phone" label="Phone" error={errors.customerPhone} hint="Optional.">
            <Input
              id="order-phone"
              value={fields.customerPhone}
              onChange={(e) => set("customerPhone")(e.target.value)}
              inputMode="tel"
              aria-invalid={errors.customerPhone ? true : undefined}
              className="h-9"
            />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field id="order-channel" label="Came in through" error={errors.channel}>
            <Choice
              id="order-channel"
              value={fields.channel}
              onChange={set("channel")}
              options={CHANNELS.filter((c) => c !== "storefront").map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
            />
          </Field>
          <Field id="order-delivery" label="Delivery">
            <Choice
              id="order-delivery"
              value={fields.delivery}
              onChange={set("delivery")}
              options={[
                { value: "courier", label: "Courier" },
                { value: "pickup", label: "Pickup" },
              ]}
            />
          </Field>
          <Field id="order-payment" label="Payment">
            <Choice
              id="order-payment"
              value={fields.payment}
              onChange={set("payment")}
              options={PAYMENTS.map((p) => ({ value: p, label: PAYMENT_LABEL[p] }))}
            />
          </Field>
        </div>

        {fields.delivery === "courier" ? (
          <div className="grid gap-3.5 sm:grid-cols-[1fr_10rem]">
            <Field id="order-area" label="Going to" error={errors.area}>
              <Input
                id="order-area"
                value={fields.area}
                onChange={(e) => set("area")(e.target.value)}
                placeholder="Woodbrook, POS"
                aria-invalid={errors.area ? true : undefined}
                className="h-9"
              />
            </Field>
            <Field id="order-fee" label="Delivery fee (TT$)" error={errors.deliveryFee}>
              <Input
                id="order-fee"
                value={fields.deliveryFee}
                onChange={(e) => set("deliveryFee")(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-invalid={errors.deliveryFee ? true : undefined}
                className="h-9"
              />
            </Field>
          </div>
        ) : null}

        <fieldset className="border-t border-border pt-3.5">
          <legend className="float-left mb-2 text-xs font-medium">Items</legend>
          <div className="clear-left space-y-2.5">
            {lines.map((line, index) => {
              const chosen = byId.get(line.variantId);
              const errs = lineErrors[index] ?? {};
              return (
                <div key={line.key} className="grid grid-cols-[1fr_4.5rem_6.5rem_2rem] items-start gap-2">
                  <div className="min-w-0">
                    <Select
                      value={line.variantId}
                      onValueChange={(variantId) => {
                        const picked = byId.get(variantId);
                        setLine(line.key, {
                          variantId,
                          unitPrice: picked ? formatMoneyInput(picked.priceCents) : line.unitPrice,
                        });
                      }}
                    >
                      <SelectTrigger
                        className="h-9 w-full"
                        aria-label={`Item ${index + 1}`}
                        aria-invalid={errs.variantId ? true : undefined}
                      >
                        <SelectValue placeholder="Pick a variant" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {variants.map((variant) => (
                          <SelectItem key={variant.variantId} value={variant.variantId} disabled={variant.onHand === 0}>
                            {variant.product} · {variant.label}
                            <span className="ml-2 text-muted-foreground">
                              {variant.onHand === 0 ? "out of stock" : `${variant.onHand} on hand`}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <LineNote
                      error={errs.variantId}
                      note={chosen ? `${chosen.sku} · ${chosen.onHand} on hand` : undefined}
                    />
                  </div>
                  <div>
                    <Input
                      value={line.quantity}
                      onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                      inputMode="numeric"
                      aria-label={`Quantity, item ${index + 1}`}
                      aria-invalid={errs.quantity ? true : undefined}
                      className="h-9 text-right"
                    />
                    <LineNote error={errs.quantity} />
                  </div>
                  <div>
                    <Input
                      value={line.unitPrice}
                      onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
                      inputMode="decimal"
                      placeholder="Price"
                      aria-label={`Unit price in TT$, item ${index + 1}`}
                      aria-invalid={errs.unitPrice ? true : undefined}
                      className="h-9 text-right"
                    />
                    <LineNote error={errs.unitPrice} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5"
                    aria-label={`Remove item ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => {
                      onEdit();
                      setLines((all) => all.filter((l) => l.key !== line.key));
                      setLineErrors([]);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
          {errors.lines ? <p className="mt-1 text-[11px] text-negative">{errors.lines}</p> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2.5"
            onClick={() => {
              onEdit();
              setLines((all) => [
                ...all,
                { key: Math.max(...all.map((l) => l.key)) + 1, variantId: "", quantity: "1", unitPrice: "" },
              ]);
            }}
          >
            <Plus />
            Add item
          </Button>
        </fieldset>

        <Field id="order-notes" label="Notes" hint="Optional — anything the packer should know.">
          <Input
            id="order-notes"
            value={fields.notes}
            onChange={(e) => set("notes")(e.target.value)}
            className="h-9"
          />
        </Field>

        <dl className="ml-auto w-56 space-y-1 text-[13px]">
          <Total label="Items" cents={totals.subtotalCents} />
          <Total label="Delivery" cents={totals.deliveryFeeCents} />
          <Total label="Total" cents={totals.totalCents} strong />
        </dl>
      </div>

      {message ? (
        <p role="alert" className="mt-4 text-[12.5px] text-negative">
          {message}
        </p>
      ) : null}

      <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="submit" pending={pending} pendingLabel="Saving">
          Save order
        </LoadingButton>
      </DialogFooter>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {note ? (
        <p className={`mt-1 text-[11px] ${error ? "text-negative" : "text-muted-foreground"}`}>{note}</p>
      ) : null}
    </div>
  );
}

function Choice({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LineNote({ error, note }: { error?: string; note?: string }) {
  if (!error && !note) return null;
  return (
    <p className={`mt-1 truncate text-[11px] ${error ? "text-negative" : `text-muted-foreground ${mono}`}`}>
      {error ?? note}
    </p>
  );
}

function Total({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-medium" : "text-muted-foreground"}`}>
      <dt>{label}</dt>
      <dd className={mono}>
        TT$
        {(cents / 100).toLocaleString("en-TT", {
          minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}
      </dd>
    </div>
  );
}

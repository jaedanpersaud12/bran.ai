"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  Ban,
  Banknote,
  Eye,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { advanceOrderAction, cancelOrderAction, markPaidAction } from "@/actions/orders";
import { OrderDialog, type VariantOption } from "@/components/bran/OrderDialog";
import { LoadingButton } from "@/components/bran/LoadingButton";
import { PadRows, TablePager, usePaged } from "@/components/bran/TablePager";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DataTable,
  StackedCell,
  TableCard,
  TableCardHeader,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  mono,
} from "@/components/ui/table-card";
import {
  CHANNEL_LABEL,
  PAYMENT_LABEL,
  PAYMENT_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TIME_ZONE,
  STEP_ACTION,
  canCancel,
  canMarkPaid,
  isOpen,
  nextStep,
  queueOrder,
  type OrderStatus,
  type Step,
} from "@/lib/order-status";
import type { OrderView } from "@/lib/orders";

/** Loaded on first open: the preview only matters to the FLVS workspace. */
const StorefrontImport = dynamic(
  () => import("@/components/bran/StorefrontImport").then((module) => module.StorefrontImport),
  { ssr: false },
);

const COLUMNS = ["w-36", "w-52", "w-28", "w-40", "w-16", "w-28", "", "w-14"] as const;

const STEP_ICON: Record<Step, LucideIcon> = { packed: Package, shipped: Truck, delivered: PackageCheck };

type Filter = "open" | OrderStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * The order queue: every order, whatever channel it came in through, with
 * the ones still needing hands first. Each row moves one step at a time from
 * its menu; cancelling asks first, because it puts the stock back and takes
 * the sale out of restock.
 */
export function OrdersTable({
  orders,
  variants,
  storefront,
  highlight,
}: {
  orders: OrderView[];
  /** Active variants, for the New order modal's picker. */
  variants: VariantOption[];
  /** Whether this workspace can import from the FLVS storefront. */
  storefront: boolean;
  /** An order to open on arrival — `?open=ORD-0004`. */
  highlight?: string;
}) {
  const [filter, setFilter] = useState<Filter | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<boolean | null>(null);
  const [open, setOpen] = useState<string | null>(
    () => orders.find((order) => order.reference === highlight)?.id ?? null,
  );
  const [cancelling, setCancelling] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      orders
        .filter((order) =>
          filter === null ? true : filter === "open" ? isOpen(order.status) : order.status === filter,
        )
        .sort(queueOrder),
    [orders, filter],
  );
  const paged = usePaged(visible, 10);
  const selected = orders.find((order) => order.id === open) ?? null;
  const openCount = orders.filter((order) => isOpen(order.status)).length;

  return (
    <>
      <TableCard>
        <TableCardHeader
          icon={<Truck />}
          title="Orders"
          note={
            // A failed row action reads here, in the note's one line, so nothing
            // below it moves; the next action clears it.
            error ? (
              <span role="alert" title={error} className="block truncate text-negative">
                {error}
              </span>
            ) : (
              `${openCount} open, ${orders.length} in all`
            )
          }
        >
          <FilterChip
            label="Status"
            value={filter}
            options={FILTERS}
            onChange={(next) => {
              setFilter(next);
              paged.setPage(1);
            }}
          />
          <div className="ml-auto flex gap-2">
            {storefront ? (
              <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
                <Store />
                Import from storefront
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New order
            </Button>
          </div>
        </TableCardHeader>

        {visible.length === 0 ? (
          <EmptyState
            // The height of the table it stands in for — a 39px header band and
            // ten 68px rows — so filtering to nothing doesn't shrink the card.
            className="h-[719px] justify-center py-0"
            icon={<Truck />}
            title={orders.length === 0 ? "No orders yet" : "No orders with that status"}
            description={
              orders.length === 0
                ? "Enter a sale from a DM, WhatsApp or in person. It comes off the shelf and counts toward restock straight away."
                : "Try another status, or clear the filter to see every order."
            }
            action={
              orders.length === 0 ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus />
                  New order
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setFilter(null)}>
                  Clear filter
                </Button>
              )
            }
          />
        ) : (
          <DataTable columns={COLUMNS} minWidth={900} density="comfortable">
            <Thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Items</Th>
                <Th align="right">Total</Th>
                <Th>Going to</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </Thead>
            <Tbody>
              {paged.rows.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <StackedCell
                      primary={<span className={mono}>{order.reference}</span>}
                      secondary={placed(order.placedAt)}
                    />
                  </Td>
                  <Td>
                    <StackedCell primary={order.customerName} secondary={CHANNEL_LABEL[order.channel]} />
                  </Td>
                  <Td>
                    <StatusPill tone={STATUS_TONE[order.status]} dot={order.status !== "cancelled"}>
                      {STATUS_LABEL[order.status]}
                    </StatusPill>
                  </Td>
                  <Td>
                    {order.status === "cancelled" ? (
                      <span className="text-[12.5px] text-muted-foreground">—</span>
                    ) : (
                      <StatusPill tone={PAYMENT_TONE[order.payment]} dot={false}>
                        {PAYMENT_LABEL[order.payment]}
                      </StatusPill>
                    )}
                  </Td>
                  <Td align="right" className={mono}>
                    {order.units}
                  </Td>
                  <Td align="right" className={mono}>
                    {money(order.subtotalCents + order.deliveryFeeCents)}
                  </Td>
                  <Td className="truncate text-[13px] text-muted-foreground">{destination(order)}</Td>
                  <Td align="right" className="px-2">
                    <RowMenu
                      order={order}
                      onView={() => setOpen(order.id)}
                      onCancel={() => setCancelling(order)}
                      onError={setError}
                    />
                  </Td>
                </Tr>
              ))}
              <PadRows count={paged.pad} columns={COLUMNS.length} />
            </Tbody>
          </DataTable>
        )}
        <TablePager paged={paged} noun="orders" />
      </TableCard>

      <Dialog open={selected !== null} onOpenChange={(next) => (next ? null : setOpen(null))}>
        <DialogContent className="scroll-slim max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-2xl">
          {selected ? (
            <OrderDetail key={selected.id} order={selected} onCancel={() => setCancelling(selected)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <OrderDialog open={creating} onClose={() => setCreating(false)} variants={variants} />

      {importing === null ? null : (
        <StorefrontImport open={importing} onClose={() => setImporting(false)} variants={variants} />
      )}

      <CancelDialog
        order={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          setOpen(null);
        }}
      />
    </>
  );
}

function RowMenu({
  order,
  onView,
  onCancel,
  onError,
}: {
  order: OrderView;
  onView: () => void;
  onCancel: () => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const step = nextStep(order.status);
  const StepIcon = step ? STEP_ICON[step] : null;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      onError(null);
      try {
        const result = await action();
        if (!result.ok) onError(`${order.reference}: ${result.error ?? "Couldn't save that."}`);
      } catch {
        onError(`${order.reference}: couldn't reach bran. Try again.`);
      }
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${order.reference}`} disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onView}>
          <Eye />
          View order
        </DropdownMenuItem>
        {step && StepIcon ? (
          <DropdownMenuItem onSelect={() => run(() => advanceOrderAction(order.id, order.status))}>
            <StepIcon />
            {STEP_ACTION[step]}
          </DropdownMenuItem>
        ) : null}
        {canMarkPaid(order.status, order.payment) ? (
          <DropdownMenuItem onSelect={() => run(() => markPaidAction(order.id))}>
            <Banknote />
            Mark paid
          </DropdownMenuItem>
        ) : null}
        {canCancel(order.status) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onCancel}>
              <Ban />
              Cancel order
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: "Order entered",
  imported: "Imported from the storefront",
  packed: "Marked packed",
  shipped: "Marked shipped",
  delivered: "Marked delivered",
  paid: "Marked paid",
  cancelled: "Cancelled",
};

function OrderDetail({ order, onCancel }: { order: OrderView; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const step = nextStep(order.status);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await action();
        if (!result.ok) setError(result.error ?? "Couldn't save that.");
      } catch {
        setError("Couldn't reach bran. Try again.");
      }
    });

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          <Truck />
        </span>
        <div className="min-w-0">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <span className={mono}>{order.reference}</span>
            <StatusPill tone={STATUS_TONE[order.status]} dot={order.status !== "cancelled"}>
              {STATUS_LABEL[order.status]}
            </StatusPill>
            {order.status === "cancelled" ? null : (
              <StatusPill tone={PAYMENT_TONE[order.payment]} dot={false}>
                {PAYMENT_LABEL[order.payment]}
              </StatusPill>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {CHANNEL_LABEL[order.channel]} · {placed(order.placedAt)}
            {order.externalRef ? ` · ${order.externalRef}` : ""}
          </DialogDescription>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3">
        <Detail label="Customer" value={order.customerName} />
        <Detail label="Phone" value={order.customerPhone ?? "—"} />
        <Detail label="Delivery" value={destination(order)} />
      </dl>

      <div className="scroll-slim mt-5 max-h-[40vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Piece</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Line</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {order.lines.map((line) => (
              <tr key={line.variantId}>
                <td className="px-3 py-2">
                  <span className="font-medium">{line.piece}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {line.variant} · <span className={mono}>{line.sku}</span>
                  </span>
                </td>
                <td className={`px-3 py-2 text-right ${mono}`}>{line.quantity}</td>
                <td className={`px-3 py-2 text-right ${mono}`}>{money(line.unitPriceCents)}</td>
                <td className={`px-3 py-2 text-right ${mono}`}>{money(line.quantity * line.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border text-[13px]">
            <TotalRow label="Subtotal" cents={order.subtotalCents} />
            <TotalRow label="Delivery" cents={order.deliveryFeeCents} />
            <TotalRow label="Total" cents={order.subtotalCents + order.deliveryFeeCents} strong />
          </tfoot>
        </table>
      </div>

      {order.notes ? (
        <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">{order.notes}</p>
      ) : null}

      <section className="mt-5" aria-labelledby="order-history">
        <h3 id="order-history" className="text-xs font-medium text-muted-foreground">
          History
        </h3>
        <ol className="mt-2 space-y-1.5 text-[13px]">
          {order.events.map((event, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span>
                {event.kind === "cancelled" && order.tookStock
                  ? "Cancelled — stock returned"
                  : (EVENT_LABEL[event.kind] ?? event.kind)}
                {event.by ? <span className="text-muted-foreground"> · {event.by}</span> : null}
              </span>
              <span className={`${mono} text-[12px] text-muted-foreground`}>{when(event.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {error ? (
        <p role="alert" className="mt-4 text-[12.5px] text-negative">
          {error}
        </p>
      ) : null}

      <div className="mt-5 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-border bg-muted/50 p-5 sm:flex-row sm:justify-between">
        <div>
          {canCancel(order.status) ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel order
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {canMarkPaid(order.status, order.payment) ? (
            <LoadingButton
              type="button"
              variant="outline"
              pending={pending}
              pendingLabel="Saving"
              onClick={() => run(() => markPaidAction(order.id))}
            >
              <Banknote />
              Mark paid
            </LoadingButton>
          ) : null}
          {step ? (
            <LoadingButton
              type="button"
              pending={pending}
              pendingLabel="Saving"
              onClick={() => run(() => advanceOrderAction(order.id, order.status))}
            >
              {STEP_ACTION[step]}
            </LoadingButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">{value}</dd>
    </div>
  );
}

function TotalRow({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <tr className={strong ? "font-medium" : "text-muted-foreground"}>
      <td className="px-3 py-1.5" colSpan={3}>
        {label}
      </td>
      <td className={`px-3 py-1.5 text-right ${mono}`}>{money(cents)}</td>
    </tr>
  );
}

/** Cancelling puts the stock back and takes the sale out of restock, so it asks first. */
function CancelDialog({
  order,
  onClose,
  onCancelled,
}: {
  order: OrderView | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog
      open={order !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        {order ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel {order.reference}?</AlertDialogTitle>
              <AlertDialogDescription>
                {order.tookStock
                  ? `${order.units} ${order.units === 1 ? "unit goes" : "units go"} back on the shelf and the sale stops counting toward restock. The order is kept, marked cancelled. This can't be undone.`
                  : "The sale stops counting toward restock. It was imported after it shipped, so its units never came off your shelf and none go back. The order is kept, marked cancelled. This can't be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <p role="alert" className="text-[12.5px] text-negative">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep order</AlertDialogCancel>
              <LoadingButton
                variant="destructive"
                pending={pending}
                pendingLabel="Cancelling"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await cancelOrderAction(order.id);
                      if (result.ok) onCancelled();
                      else setError(result.error);
                    } catch {
                      setError("Couldn't reach bran. Try again.");
                    }
                  })
                }
              >
                Cancel order
              </LoadingButton>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function destination(order: OrderView): string {
  if (order.delivery === "pickup") return "Pickup";
  return order.area ?? "Courier";
}

/** The purchase-order table's format: whole dollars bare, cents only when there are some. */
function money(cents: number): string {
  return `TT$${(cents / 100).toLocaleString("en-TT", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function placed(iso: string): string {
  return new Date(iso).toLocaleDateString("en-TT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-TT", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

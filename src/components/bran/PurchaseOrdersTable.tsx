"use client";

import { useState, useTransition } from "react";
import {
  Ban,
  Check,
  ClipboardList,
  Copy,
  Eye,
  Mail,
  MoreHorizontal,
  PackageCheck,
  Send,
} from "lucide-react";
import {
  cancelOrder,
  draftSupplierEmails,
  markReceived,
  markSent,
  type TransitionResult,
} from "@/actions/purchase-orders";
import { AiMark } from "@/components/bran/AiMark";
import { LoadingButton } from "@/components/bran/LoadingButton";
import { PadRows, TablePager, usePaged } from "@/components/bran/TablePager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
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
import { Textarea } from "@/components/ui/textarea";
import type { SupplierEmail } from "@/lib/po-email";
import type { PoLine, PoStatus, PoSummary } from "@/lib/purchase-orders";

const COLUMNS = ["w-40", "w-32", "w-40", "w-24", "w-24", "w-32", "", "w-14"] as const;

const STATUS: Record<PoStatus, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  received: { label: "Received", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const EMAIL_AI_TITLE =
  "Subject, opening and closing written by AI. The lines, quantities and prices come from the order.";

/**
 * Supplier orders: every draft restock or the owner made, and where each one
 * is in draft → sent → received. Sent orders count as stock on the way;
 * receiving one puts it on the shelf.
 */
export function PurchaseOrdersTable({
  orders,
  lines,
  highlight,
}: {
  orders: PoSummary[];
  lines: Record<string, PoLine[]>;
  /** An order to open on arrival — `?open=PO-0003` from a "Drafted" link. */
  highlight?: string;
}) {
  const paged = usePaged(orders, 10);
  const [open, setOpen] = useState<string | null>(
    () => orders.find((order) => order.reference === highlight)?.id ?? null,
  );
  const [cancelling, setCancelling] = useState<PoSummary | null>(null);
  const selected = orders.find((order) => order.id === open) ?? null;

  return (
    <>
      <TableCard>
        <TableCardHeader
          icon={<ClipboardList />}
          title="Purchase orders"
          note={`${orders.filter((o) => o.status === "sent").length} on the way, ${
            orders.filter((o) => o.status === "draft").length
          } in draft`}
        />

        {orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No purchase orders yet"
            description="Draft one from restock's plan on the Inventory page. It lands here, where you send it, email the supplier and receive it into stock."
          />
        ) : (
          <DataTable columns={COLUMNS} minWidth={760} density="comfortable">
            <Thead>
              <tr>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th align="right">Lines</Th>
                <Th align="right">Units</Th>
                <Th align="right">Cost</Th>
                <Th />
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
                      secondary={milestone(order)}
                    />
                  </Td>
                  <Td>
                    <StatusPill tone={STATUS[order.status].tone} dot={order.status !== "cancelled"}>
                      {STATUS[order.status].label}
                    </StatusPill>
                  </Td>
                  <Td className={`${mono} text-[12.5px] text-muted-foreground`}>
                    {date(order.createdAt)}
                  </Td>
                  <Td align="right" className={mono}>
                    {order.lines}
                  </Td>
                  <Td align="right" className={mono}>
                    {order.units}
                  </Td>
                  <Td align="right" className={mono}>
                    {money(order.costCents)}
                  </Td>
                  <Td />
                  <Td align="right" className="px-2">
                    <RowMenu
                      order={order}
                      onView={() => setOpen(order.id)}
                      onCancel={() => setCancelling(order)}
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
        {/* Scrolls itself: with a supplier email or two open it's taller than
            the screen, and the footer's actions must stay reachable. */}
        <DialogContent className="scroll-slim max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-3xl">
          {selected ? (
            <OrderDetail
              key={selected.id}
              order={selected}
              lines={lines[selected.id] ?? []}
              onCancel={() => setCancelling(selected)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <CancelDialog order={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}

function RowMenu({
  order,
  onView,
  onCancel,
}: {
  order: PoSummary;
  onView: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const run = (action: (id: string) => Promise<TransitionResult>) =>
    startTransition(async () => {
      await action(order.id);
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
        {order.status === "draft" ? (
          <DropdownMenuItem onSelect={() => run(markSent)}>
            <Send />
            Mark as sent
          </DropdownMenuItem>
        ) : null}
        {order.status === "sent" ? (
          <DropdownMenuItem onSelect={() => run(markReceived)}>
            <PackageCheck />
            Receive into stock
          </DropdownMenuItem>
        ) : null}
        {order.status === "draft" || order.status === "sent" ? (
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

function OrderDetail({
  order,
  lines,
  onCancel,
}: {
  order: PoSummary;
  lines: PoLine[];
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<SupplierEmail[] | null>(null);
  const [drafting, startDrafting] = useTransition();

  const run = (action: (id: string) => Promise<TransitionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action(order.id);
      if (!result.ok) setError(result.error);
    });

  const draftEmails = () =>
    startDrafting(async () => {
      setError(null);
      const result = await draftSupplierEmails(order.id);
      if (result.ok) setEmails(result.emails);
      else setError(result.error);
    });

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          <ClipboardList />
        </span>
        <div className="min-w-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span className={mono}>{order.reference}</span>
            <StatusPill tone={STATUS[order.status].tone} dot={order.status !== "cancelled"}>
              {STATUS[order.status].label}
            </StatusPill>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {milestone(order)} · {order.units} units · {money(order.costCents)}
          </DialogDescription>
        </div>
      </div>

      <div className="scroll-slim mt-5 max-h-[40vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Piece</th>
              <th className="px-3 py-2 text-right font-medium">Ordered</th>
              <th className="px-3 py-2 text-right font-medium">Restock said</th>
              <th className="px-3 py-2 text-right font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Line</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {lines.map((line) => (
              <tr key={line.variantId}>
                <td className="px-3 py-2">
                  <span className="font-medium">{line.piece}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {line.variant} · <span className={mono}>{line.sku}</span>
                  </span>
                </td>
                <td className={`px-3 py-2 text-right ${mono}`}>{line.quantity}</td>
                <td className={`px-3 py-2 text-right ${mono} text-muted-foreground`}>
                  {line.suggested === 0 ? "—" : line.suggested}
                </td>
                <td className={`px-3 py-2 text-right ${mono}`}>{money(line.unitCostCents)}</td>
                <td className={`px-3 py-2 text-right ${mono}`}>
                  {money(line.quantity * line.unitCostCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emails ? (
        <div className="mt-5 space-y-4">
          {emails.map((email) => (
            <EmailDraft key={email.supplierEmail ?? "none"} email={email} />
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-[12.5px] text-negative">
          {error}
        </p>
      ) : null}

      <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5 sm:justify-between">
        <div className="flex gap-2">
          {order.status === "draft" || order.status === "sent" ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel order
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <LoadingButton
            type="button"
            variant="outline"
            pending={drafting}
            pendingLabel="Drafting"
            onClick={draftEmails}
          >
            <Mail />
            {emails ? "Redraft emails" : "Draft supplier email"}
          </LoadingButton>
          {order.status === "draft" ? (
            <LoadingButton pending={pending} pendingLabel="Saving" onClick={() => run(markSent)}>
              <Send />
              Mark as sent
            </LoadingButton>
          ) : null}
          {order.status === "sent" ? (
            <LoadingButton pending={pending} pendingLabel="Receiving" onClick={() => run(markReceived)}>
              <PackageCheck />
              Receive into stock
            </LoadingButton>
          ) : null}
        </div>
      </DialogFooter>
    </div>
  );
}

/**
 * One supplier's email, editable. Nothing here is sent by bran: Copy puts it
 * on the clipboard, and "Open in mail app" hands it to the owner's own mail.
 */
function EmailDraft({ email }: { email: SupplierEmail }) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [copied, setCopied] = useState(false);
  const id = `email-${email.supplierEmail ?? "none"}`;
  const mailto = `mailto:${email.supplierEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <section className="rounded-lg border border-border p-3.5" aria-labelledby={`${id}-to`}>
      <p id={`${id}-to`} className="flex items-center gap-1 text-[12.5px] font-medium">
        To: {email.supplierEmail ?? <span className="text-muted-foreground">No supplier email set</span>}
        {email.aiWritten ? <AiMark title={EMAIL_AI_TITLE} label="Written by AI" /> : null}
      </p>
      <label htmlFor={`${id}-subject`} className="mt-3 block text-xs font-medium text-muted-foreground">
        Subject
      </label>
      <Input
        id={`${id}-subject`}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        className="mt-1 h-9"
      />
      <label htmlFor={`${id}-body`} className="mt-3 block text-xs font-medium text-muted-foreground">
        Message
      </label>
      <Textarea
        id={`${id}-body`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={10}
        className="mt-1 font-mono text-[12px]"
      />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button asChild size="sm">
          <a href={mailto}>
            <Mail />
            Open in mail app
          </a>
        </Button>
      </div>
    </section>
  );
}

/** Cancelling can't be undone, so it asks — app-ui §7's confirm, on the local Dialog. */
function CancelDialog({ order, onClose }: { order: PoSummary | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={order !== null} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="p-5 sm:max-w-md">
        {order ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive [&_svg]:size-4">
                <Ban />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">Cancel {order.reference}?</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-muted-foreground">
                  {order.status === "sent"
                    ? "Its units stop counting as on the way, so restock may suggest them again. This can't be undone."
                    : "The draft is kept for your records but can't be sent or received. This can't be undone."}
                </DialogDescription>
              </div>
            </div>
            {error ? (
              <p role="alert" className="mt-3 text-[12.5px] text-negative">
                {error}
              </p>
            ) : null}
            <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 pb-5">
              <Button type="button" variant="outline" onClick={onClose}>
                Keep order
              </Button>
              <LoadingButton
                variant="destructive"
                pending={pending}
                pendingLabel="Cancelling"
                onClick={() =>
                  startTransition(async () => {
                    const result = await cancelOrder(order.id);
                    if (result.ok) onClose();
                    else setError(result.error);
                  })
                }
              >
                Cancel order
              </LoadingButton>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function milestone(order: PoSummary): string {
  if (order.status === "received" && order.receivedAt) return `Received ${date(order.receivedAt)}`;
  if (order.status === "sent" && order.sentAt) return `Sent ${date(order.sentAt)}`;
  if (order.status === "cancelled") return "Cancelled";
  return `Drafted ${date(order.createdAt)}`;
}

function date(iso: string): string {
  return new Intl.DateTimeFormat("en-TT", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

function money(cents: number): string {
  return `TT$${(cents / 100).toLocaleString("en-TT", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

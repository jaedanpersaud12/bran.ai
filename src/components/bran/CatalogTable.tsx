"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  Archive,
  ArchiveRestore,
  FileUp,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  SquarePen,
} from "lucide-react";
import { setArchived, setStock } from "@/actions/catalog";
import { CatalogDialog, type DialogState } from "@/components/bran/CatalogDialog";
import { PadRows, TablePager, usePaged } from "@/components/bran/TablePager";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
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
import type { CatalogRow } from "@/lib/catalog";

/** Loaded on first open, so AI Elements doesn't ship with the catalogue (see CatalogImport). */
const CatalogImport = dynamic(
  () => import("@/components/bran/CatalogImport").then((module) => module.CatalogImport),
  { ssr: false },
);

const COLUMNS = ["w-64", "w-44", "w-28", "w-28", "w-28", "w-24", "", "w-14"] as const;

/**
 * The catalogue: every variant, one row each, paged at ten.
 *
 * Search and the archived filter run over rows already on the client — a
 * workspace's range is a few hundred variants at most — so both are instant
 * and neither needs the URL. Writes go through the catalogue actions, which
 * revalidate this page; the rows prop is always the server's copy, and the
 * only local state is what's being typed.
 */
export function CatalogTable({ rows, canImport }: { rows: CatalogRow[]; canImport: boolean }) {
  const [query, setQuery] = useState("");
  // Mounted from the first open on, so closing it can animate out.
  const [importing, setImporting] = useState<boolean | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (showArchived || !row.archived) &&
        (!needle ||
          row.product.toLowerCase().includes(needle) ||
          row.label.toLowerCase().includes(needle) ||
          row.sku.toLowerCase().includes(needle)),
    );
  }, [rows, query, showArchived]);

  const paged = usePaged(visible, 10);
  const active = rows.filter((row) => !row.archived).length;

  return (
    <>
      <TableCard>
        <TableCardHeader
          icon={<Package />}
          title="Variants"
          note={`${active} active ${active === 1 ? "variant" : "variants"}${
            rows.length > active ? `, ${rows.length - active} archived` : ""
          }`}
        >
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                // A new search starts from the first page, not wherever the last one was.
                setQuery(event.target.value);
                paged.setPage(1);
              }}
              placeholder="Search by product, variant or SKU"
              aria-label="Search the catalog"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(next) => {
                setShowArchived(next);
                paged.setPage(1);
              }}
            />
            {/* htmlFor, not wrapping: a label around a button-based switch doesn't name it. */}
            <label htmlFor="show-archived">Show archived</label>
          </div>
          <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
            <FileUp />
            Import
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: "create-product" })}>
            <Plus />
            Add product
          </Button>
        </TableCardHeader>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={rows.length === 0 ? "No products yet" : "Nothing matches"}
            description={
              rows.length === 0
                ? "Add what you sell, with its cost, price and how many are on the shelf. Restock scores it as soon as it sells."
                : "No variant's product name, variant or SKU contains that. Archived variants only show with the switch on."
            }
            action={
              rows.length === 0 ? (
                <Button size="sm" onClick={() => setDialog({ kind: "create-product" })}>
                  <Plus />
                  Add product
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    paged.setPage(1);
                  }}
                >
                  Clear search
                </Button>
              )
            }
          />
        ) : (
          <DataTable columns={COLUMNS} minWidth={820} density="comfortable">
            <Thead>
              <tr>
                <Th>Piece</Th>
                <Th>SKU</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Price</Th>
                <Th align="right">Lead time</Th>
                <Th />
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </Thead>
            <Tbody>
              {paged.rows.map((row) => (
                <Tr key={row.variantId} className={row.archived ? "text-muted-foreground" : undefined}>
                  <Td>
                    <StackedCell
                      primary={row.product}
                      secondary={
                        row.archived ? (
                          <span className="flex items-center gap-1.5">
                            {row.label}
                            <StatusPill tone="neutral" className="px-1.5 py-0 text-[10.5px]">
                              Archived
                            </StatusPill>
                          </span>
                        ) : (
                          row.label
                        )
                      }
                    />
                  </Td>
                  <Td className={`${mono} text-[12.5px]`}>{row.sku}</Td>
                  <Td align="right">
                    <StockCell row={row} />
                  </Td>
                  <Td align="right" className={mono}>
                    {money(row.unitCostCents)}
                  </Td>
                  <Td align="right" className={mono}>
                    {money(row.priceCents)}
                  </Td>
                  <Td align="right" className={`${mono} text-muted-foreground`}>
                    {row.leadTimeDays}d
                  </Td>
                  <Td />
                  <Td align="right" className="px-2">
                    <RowMenu row={row} onOpen={setDialog} />
                  </Td>
                </Tr>
              ))}
              <PadRows count={paged.pad} columns={COLUMNS.length} />
            </Tbody>
          </DataTable>
        )}

        <TablePager paged={paged} noun="variants" />
      </TableCard>

      <CatalogDialog state={dialog} onClose={() => setDialog(null)} />
      {importing === null ? null : (
        <CatalogImport
          open={importing}
          onClose={() => setImporting(false)}
          catalog={rows}
          available={canImport}
        />
      )}
    </>
  );
}

function RowMenu({ row, onOpen }: { row: CatalogRow; onOpen: (state: DialogState) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${row.product}, ${row.label}`}
          disabled={pending}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onOpen({ kind: "edit-variant", row })}>
          <Pencil />
          Edit variant
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpen({ kind: "edit-product", row })}>
          <SquarePen />
          Edit product
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpen({ kind: "add-variant", row })}>
          <Plus />
          Add variant
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              await setArchived(row.variantId, !row.archived);
            })
          }
        >
          {row.archived ? <ArchiveRestore /> : <Archive />}
          {row.archived ? "Restore variant" : "Archive variant"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The one field people change constantly, edited in place (app-ui §5):
 * plain text until clicked, then an input. Enter saves, Escape cancels. The
 * new count shows at once and rolls back, with the reason, if the save fails.
 */
function StockCell({ row }: { row: CatalogRow }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(row.onHand);
  const [, startTransition] = useTransition();

  const open = () => {
    setDraft(String(row.onHand));
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const next = Number(draft);
    setEditing(false);
    if (draft.trim() === String(row.onHand)) return;
    startTransition(async () => {
      if (Number.isInteger(next) && next >= 0) setShown(next);
      const result = await setStock(row.variantId, draft);
      if (!result.ok) setError(result.errors.onHand ?? result.message ?? "Couldn't save.");
    });
  };

  if (editing) {
    return (
      <input
        autoFocus
        // Selected on open, so typing a fresh count replaces the old one
        // instead of appending to it — a shelf of 6 recounted as 60 must
        // not become 660.
        onFocus={(event) => event.currentTarget.select()}
        inputMode="numeric"
        aria-label={`On hand for ${row.product}, ${row.label}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className={`h-7 w-16 rounded-md border border-border bg-background px-2 text-right text-[13px] ${mono} focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none`}
      />
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={open}
        aria-label={`On hand for ${row.product}, ${row.label}: ${shown}. Edit`}
        className={`rounded-md px-1.5 py-0.5 ${mono} transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none ${
          shown === 0 ? "text-negative" : ""
        }`}
      >
        {shown}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-negative">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function money(cents: number): string {
  return `TT$${(cents / 100).toLocaleString("en-TT", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

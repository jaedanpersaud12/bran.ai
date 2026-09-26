import { PageHeader } from "@/components/bran/Page";
import { TableCard } from "@/components/ui/table-card";

/**
 * Purchase orders while they load: the same header, then a table card of the same
 * height — header strip, column band, ten comfortable rows, pager —
 * so the real table replaces it without moving anything.
 */
export default function PurchaseOrdersLoading() {
  return (
    <div className="w-full" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeader title="Purchase orders" blurb=" " />
      <TableCard>
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3.5">
          <span className="size-7 animate-pulse rounded-lg bg-foreground/10" />
          <div className="text-lg leading-tight">
            <Bar className="w-24" />
            <p className="mt-0.5 h-4 text-[11px]">
              <Bar className="w-32" />
            </p>
          </div>
        </div>
        <div className="h-[39px] border-b border-border bg-muted/40" />
        <div className="divide-y divide-border/70">
          {["w-3/5", "w-2/5", "w-1/2", "w-3/5", "w-2/5", "w-1/2", "w-3/5", "w-2/5", "w-1/2", "w-3/5"].map(
            (width, index) => (
              <div key={index} className="flex h-[68px] items-center px-4 text-sm">
                <Bar className={width} />
              </div>
            ),
          )}
        </div>
        <div className="h-[52px] border-t border-border" />
      </TableCard>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[1em] animate-pulse rounded-chip bg-foreground/10 align-middle ${className}`}
    />
  );
}

import { PageHeader } from "@/components/bran/Page";
import { TableCard } from "@/components/ui/table-card";

/**
 * Orders while they load: the same header, the same four-up stat row, then a
 * table card of the same height — header strip, column band, ten comfortable
 * rows, pager — so the real screen replaces it without moving anything.
 */
export default function OrdersLoading() {
  return (
    <div className="w-full" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeader title="Orders" blurb=" " />

      <section className="grid grid-cols-1 border-b border-border sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`py-5 ${index > 0 ? "lg:border-l lg:border-border lg:pl-6" : ""} ${
              index < 3 ? "border-b border-border lg:border-b-0 lg:pr-6" : ""
            }`}
          >
            <p className="text-[13px]">
              <Bar className="w-28" />
            </p>
            <p className="mt-1.5 text-[30px] leading-none">
              <Bar className="w-20" />
            </p>
            <p className="mt-2.5 text-[12.5px]">
              <Bar className="w-32" />
            </p>
          </div>
        ))}
      </section>

      <div className="mt-6">
        <TableCard>
          <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3.5">
            <span className="size-7 animate-pulse rounded-lg bg-foreground/10" />
            <div className="text-lg leading-tight">
              <Bar className="w-16" />
              <p className="mt-0.5 h-4 text-[11px]">
                <Bar className="w-28" />
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
    </div>
  );
}

/** Inherits the type size of the slot it sits in, so it's as tall as the text will be. */
function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[1em] animate-pulse rounded-chip bg-foreground/10 align-middle ${className}`}
    />
  );
}

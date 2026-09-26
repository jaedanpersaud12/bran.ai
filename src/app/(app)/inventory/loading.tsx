import { PageHeader, Panel } from "@/components/bran/Page";

/**
 * The inventory screen while it scores. Built from the page's own containers
 * — the same header, the same four-up stat row, the same panels — so the real
 * content lands where the placeholders were rather than shoving them aside.
 */
export default function InventoryLoading() {
  return (
    <div className="w-full" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeader title="Inventory" blurb=" " />

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

      <Panel title="Restock's call" hint="What it would order today, and the alternatives.">
        <div className="h-[150px] w-full max-w-95 animate-pulse rounded-card bg-foreground/10" />
      </Panel>

      <Panel
        title="Plan the reorder"
        hint="Filled in with what restock would order. Change anything you disagree with."
      >
        <div className="space-y-5">
          {["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/5", "w-2/5"].map((width, index) => (
            <p key={index} className="text-[13px]">
              <Bar className={width} />
            </p>
          ))}
        </div>
      </Panel>
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

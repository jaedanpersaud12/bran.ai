import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { STOREFRONTS, formatMoneyWhole } from "@/lib/demo";

export const metadata = { title: "Storefronts — bran" };

/**
 * DM-Commerce: every label the owner runs, each with its own storefront.
 *
 * The figure that matters on this screen is the DM share. A storefront whose
 * orders mostly start in a direct message is not really a shop with a
 * checkout — it is a conversation with a receipt, and that is the shape of
 * commerce this product is built around.
 */
export default function StorefrontsPage() {
  const live = STOREFRONTS.filter((store) => store.status === "live");
  const revenue = live.reduce((sum, store) => sum + store.revenue30, 0);
  const orders = live.reduce((sum, store) => sum + store.orders30, 0);
  const dmOrders = live.reduce((sum, store) => sum + store.orders30 * store.fromDm, 0);

  return (
    <div className="w-full">
      <PageHeader
        title="Storefronts"
        blurb="One workspace can carry more than one label. Each gets its own storefront, its own handle and its own numbers, drawing on shared inventory underneath."
      >
        <Button size="sm">New storefront</Button>
      </PageHeader>

      <StatRow
        stats={[
          { label: "Live storefronts", value: String(live.length), note: `${STOREFRONTS.length} total` },
          {
            label: "Revenue · 30 days",
            value: formatMoneyWhole(revenue),
            delta: { percent: 27.4, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          { label: "Orders · 30 days", value: orders.toLocaleString(), note: "Across every label" },
          {
            label: "Started in a DM",
            value: `${Math.round((dmOrders / orders) * 100)}%`,
            note: "Rather than at a checkout",
          },
        ]}
      />

      <Panel title="Your labels" hint="Shared inventory, separate shopfronts.">
        <ul className="divide-y divide-border">
          {STOREFRONTS.map((store) => (
            <li
              key={store.handle}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* Each label gets its own mark, seeded off the handle so the
                    same shop is the same colour every time it is drawn. */}
                <span
                  aria-hidden
                  className="size-9 shrink-0 rounded-full"
                  style={{ background: markFor(store.handle) }}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] font-semibold">
                    {store.name}
                    <Badge variant={store.status === "live" ? "secondary" : "outline"}>
                      {store.status}
                    </Badge>
                  </p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {store.handle} · <span className="font-mono">{store.domain}</span>
                  </p>
                </div>
              </div>

              <dl className="flex items-center gap-x-8 gap-y-2 text-[13px]">
                <Figure label="Pieces" value={String(store.products)} />
                <Figure label="Orders" value={store.orders30.toLocaleString()} />
                <Figure label="Revenue" value={formatMoneyWhole(store.revenue30)} />
                <Figure
                  label="From DMs"
                  value={store.orders30 ? `${Math.round(store.fromDm * 100)}%` : "—"}
                />
              </dl>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
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

/** A stable two-stop gradient per handle — the same shop, the same mark. */
function markFor(handle: string): string {
  let hash = 0;
  for (const character of handle) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return `radial-gradient(circle at 30% 25%, hsl(${hash} 70% 62%), hsl(${(hash + 48) % 360} 62% 38%))`;
}

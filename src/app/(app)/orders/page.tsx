import { Truck } from "lucide-react";
import { OrdersTable } from "@/components/bran/OrdersTable";
import { PageHeader, StatRow } from "@/components/bran/Page";
import { EmptyState } from "@/components/ui/empty-state";
import { loadCatalog } from "@/lib/catalog";
import { formatMoneyWhole } from "@/lib/metrics";
import { awaitingPayment, isOpen } from "@/lib/order-status";
import { loadOrders } from "@/lib/orders";
import { isFlvsWorkspace } from "@/lib/storefront-flvs";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Orders — bran" };

const BLURB =
  "One queue, whatever channel the order came in through. Orders come off the shelf and count toward restock when they're entered.";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Fulfilment: every customer order, DM or storefront, in one queue.
 *
 * An order that arrived as a DM and an order that arrived through the
 * storefront are the same order here — the channel is a column, not a
 * separate inbox — so the owner packs one queue in the morning, not three.
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const [{ open }, current] = await Promise.all([searchParams, currentWorkspace()]);

  if (!current) {
    return (
      <div className="w-full">
        <PageHeader title="Orders" blurb={BLURB} />
        <EmptyState
          icon={<Truck />}
          title="Sign in to see your orders"
          description="Use your FLVS account. Orders belong to your workspace, so there's nothing to show until we know which one."
        />
      </div>
    );
  }

  const [orders, catalog] = await Promise.all([
    loadOrders(current.workspace.id),
    loadCatalog(current.workspace.id),
  ]);

  const openOrders = orders.filter((order) => isOpen(order.status));
  const unpaid = orders.filter((order) => awaitingPayment(order.status, order.payment));
  const shipped = orders.filter((order) => order.status === "shipped");
  // Server-rendered per request, so "now" is the request's.
  // eslint-disable-next-line react-hooks/purity
  const monthAgo = Date.now() - 30 * DAY;
  const recent = orders.filter(
    (order) => order.status !== "cancelled" && new Date(order.placedAt).getTime() >= monthAgo,
  );
  const totalOf = (list: typeof orders) =>
    list.reduce((sum, order) => sum + order.subtotalCents + order.deliveryFeeCents, 0);

  return (
    <div className="w-full">
      <PageHeader title="Orders" blurb={BLURB} />

      <StatRow
        stats={[
          {
            label: "Open orders",
            value: String(openOrders.length),
            note: `${openOrders.filter((o) => o.status === "new").length} not packed yet`,
          },
          {
            label: "Awaiting payment",
            value: String(unpaid.length),
            note: unpaid.length ? `${formatMoneyWhole(totalOf(unpaid) / 100)} unpaid or cash on delivery` : "Nothing owed",
          },
          { label: "Shipped", value: String(shipped.length), note: "With a courier, not yet delivered" },
          {
            label: "Last 30 days",
            value: formatMoneyWhole(totalOf(recent) / 100),
            note: `${recent.length} ${recent.length === 1 ? "order" : "orders"}, cancelled ones excluded`,
          },
        ]}
      />

      <div className="mt-6">
        <OrdersTable
          orders={orders}
          variants={catalog
            .filter((row) => !row.archived)
            .map((row) => ({
              variantId: row.variantId,
              product: row.product,
              label: row.label,
              sku: row.sku,
              onHand: row.onHand,
              priceCents: row.priceCents,
            }))}
          storefront={isFlvsWorkspace(current.workspace.slug)}
          highlight={open}
        />
      </div>
    </div>
  );
}

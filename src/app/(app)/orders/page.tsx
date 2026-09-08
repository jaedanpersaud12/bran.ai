import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { DISPATCH, ORDERS, formatMoneyWhole, type FulfilmentState } from "@/lib/demo";

export const metadata = { title: "Orders — bran" };

/**
 * Fulfilment and courier dispatch.
 *
 * An order that arrived as a DM and an order that arrived through the
 * storefront are the same order here — the channel is a column, not a
 * separate inbox. That is the whole argument for the screen: the brand owner
 * packs one queue in the morning instead of three.
 */

/** Where a state sits in the pipeline. Drives the order of the queue. */
const PIPELINE: FulfilmentState[] = [
  "unpaid",
  "packing",
  "awaiting courier",
  "in transit",
  "delivered",
];

function stateVariant(state: FulfilmentState) {
  if (state === "unpaid") return "destructive" as const;
  if (state === "delivered") return "secondary" as const;
  if (state === "awaiting courier") return "default" as const;
  return "outline" as const;
}

export default function OrdersPage() {
  // Earliest in the pipeline first: the things still needing a pair of hands
  // sit above the things already on a van.
  const queue = [...ORDERS].sort(
    (a, b) => PIPELINE.indexOf(a.state) - PIPELINE.indexOf(b.state),
  );

  return (
    <div className="w-full">
      <PageHeader
        title="Orders"
        blurb="One queue, whatever channel the order came in through. Paid orders are handed to a courier automatically on the next run unless you hold them."
      >
        <Button variant="outline" size="sm">
          Print packing slips
        </Button>
        <Button size="sm">Dispatch {DISPATCH.readyToDispatch} orders</Button>
      </PageHeader>

      <StatRow
        stats={[
          {
            label: "Ready to dispatch",
            value: String(DISPATCH.readyToDispatch),
            note: "Packed and paid",
          },
          {
            label: "Awaiting payment",
            value: String(DISPATCH.awaitingPayment),
            note: "Reserved for 2 hours, then released",
          },
          { label: "In transit", value: String(DISPATCH.inTransit), note: "Across 2 couriers" },
          {
            label: "Median handover",
            value: `${DISPATCH.medianHandoverHours} h`,
            delta: { percent: -18.4, since: "vs prior 30 days" },
            riseIsGood: false,
          },
        ]}
      />

      <Panel title="Today's queue" hint="Earliest in the pipeline first.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Going to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((order) => (
                <TableRow key={order.ref}>
                  <TableCell>
                    <span className="font-mono text-[12px] font-medium">{order.ref}</span>
                    <span className="block text-[12px] text-muted-foreground">{order.placed}</span>
                  </TableCell>
                  <TableCell className="font-medium">{order.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{order.channel}</TableCell>
                  <TableCell className="text-right tabular-nums">{order.items}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyWhole(order.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(order.state)} className="capitalize">
                      {order.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.destination}
                    {order.courier ? (
                      <span className="block text-[12px]">via {order.courier}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}

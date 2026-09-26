import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/bran/Page";
import { PurchaseOrdersTable } from "@/components/bran/PurchaseOrdersTable";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadAllPurchaseOrderLines, loadPurchaseOrders } from "@/lib/purchase-orders";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Purchase orders — bran" };

const BLURB =
  "Orders to your suppliers. Sent orders count as stock on the way; receiving one puts it on the shelf.";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [{ open }, current] = await Promise.all([searchParams, currentWorkspace()]);

  return (
    <div className="w-full">
      <PageHeader title="Purchase orders" blurb={BLURB}>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">
            <ArrowLeft />
            Restock
          </Link>
        </Button>
      </PageHeader>

      {current ? (
        <PurchaseOrdersTable
          orders={await loadPurchaseOrders(current.workspace.id)}
          lines={await loadAllPurchaseOrderLines(current.workspace.id)}
          highlight={open}
        />
      ) : (
        <EmptyState
          icon={<ClipboardList />}
          title="Sign in to see purchase orders"
          description="Use your FLVS account. Purchase orders belong to your workspace."
        />
      )}
    </div>
  );
}

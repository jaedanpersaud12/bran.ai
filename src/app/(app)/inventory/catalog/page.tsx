import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { CatalogTable } from "@/components/bran/CatalogTable";
import { PageHeader } from "@/components/bran/Page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { aiConfigured } from "@/lib/ai/model";
import { loadCatalog } from "@/lib/catalog";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Catalog — bran" };

const BLURB =
  "What you sell, what it costs, and how many are on the shelf. Restock scores from these numbers.";

/**
 * Inventory's back room: where the numbers restock scores are kept. It sits
 * under /inventory so the sidebar keeps Inventory lit, and it's reached from
 * the Inventory header rather than a nav entry of its own.
 */
export default async function CatalogPage() {
  const current = await currentWorkspace();

  return (
    <div className="w-full">
      <PageHeader title="Catalog" blurb={BLURB}>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">
            <ArrowLeft />
            Restock
          </Link>
        </Button>
      </PageHeader>

      {current ? (
        <CatalogTable rows={await loadCatalog(current.workspace.id)} canImport={aiConfigured} />
      ) : (
        <EmptyState
          icon={<Package />}
          title="Sign in to see your catalog"
          description="Use your FLVS account. The catalog belongs to your workspace, so there's nothing to show until we know which one."
        />
      )}
    </div>
  );
}

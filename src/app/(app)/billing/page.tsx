import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { PLANS, USAGE, formatMoneyWhole } from "@/lib/demo";

export const metadata = { title: "Billing — bran" };

/**
 * The subscription, and the three tiers it sits in.
 *
 * The current plan is marked in words as well as by its surface, and the tier
 * above it is not styled as the recommended one — this screen exists to tell a
 * brand owner what they are paying for, not to sell them the next tier while
 * they are looking for their renewal date.
 */
export default function BillingPage() {
  const current = PLANS.find((plan) => plan.current);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Billing"
        blurb="What this workspace is on, what it has used, and what the other tiers carry."
      >
        <Button variant="outline" size="sm">
          Payment method
        </Button>
        <Button variant="outline" size="sm">
          Invoices
        </Button>
      </PageHeader>

      <StatRow
        stats={[
          {
            label: "Current plan",
            value: current?.name ?? "—",
            note: `${formatMoneyWhole(current?.price ?? 0)} a month`,
          },
          {
            label: "Orders this cycle",
            value: USAGE.ordersThisCycle.toLocaleString(),
            note: USAGE.ordersIncluded ? `of ${USAGE.ordersIncluded}` : "Unlimited on Studio",
          },
          {
            label: "Storefronts",
            value: `${USAGE.storefrontsUsed} of ${USAGE.storefrontsIncluded}`,
            note: "Both live",
          },
          { label: "Renews", value: "Oct 1", note: USAGE.renewsOn },
        ]}
      />

      <Panel title="Plans" hint="Every tier, and what changes between them.">
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              // The current plan is raised off the page; the others sit flat.
              // Depth on all three would make the choice look open when one of
              // them is simply a fact about this account.
              className={`rounded-xl p-5 ${
                plan.current ? "bg-card shadow-border" : "border border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                {plan.current ? <Badge variant="secondary">Current plan</Badge> : null}
              </div>

              <p className="mt-3 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {formatMoneyWhole(plan.price)}
                <span className="ml-1 text-[13px] font-normal text-muted-foreground">/ month</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-balance text-muted-foreground">
                {plan.blurb}
              </p>

              <ul className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]">
                {plan.includes.map((line) => (
                  <li key={line} className="flex gap-2 text-muted-foreground">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-step-1" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <Button
                  variant={plan.current ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  disabled={plan.current}
                >
                  {plan.current ? "Your plan" : `Move to ${plan.name}`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

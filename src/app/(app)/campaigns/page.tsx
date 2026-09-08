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
import { CAMPAIGNS, formatMoneyWhole } from "@/lib/demo";

export const metadata = { title: "Campaigns — bran" };

/**
 * What each push actually brought back.
 *
 * Return is the first column after the name, before spend. A campaign screen
 * that leads with spend invites the brand owner to read it as a bill; leading
 * with what came back is the only reason to keep running them.
 */
export default function CampaignsPage() {
  const running = CAMPAIGNS.filter((campaign) => campaign.status === "running");
  const spend = running.reduce((sum, campaign) => sum + campaign.spend, 0);
  const revenue = running.reduce((sum, campaign) => sum + campaign.revenue, 0);
  const orders = running.reduce((sum, campaign) => sum + campaign.orders, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Campaigns"
        blurb="Drops and promotions, and the orders each one is responsible for. Attribution follows the order back to the post or ad the customer arrived from."
      >
        <Button size="sm">New campaign</Button>
      </PageHeader>

      <StatRow
        stats={[
          { label: "Running now", value: String(running.length), note: `${CAMPAIGNS.length} this year` },
          { label: "Spend", value: formatMoneyWhole(spend), note: "Across running campaigns" },
          {
            label: "Revenue returned",
            value: formatMoneyWhole(revenue),
            delta: { percent: 31.6, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          {
            label: "Return on spend",
            value: `${(revenue / spend).toFixed(1)}×`,
            note: `${orders.toLocaleString()} orders attributed`,
          },
        ]}
      />

      <Panel title="Every campaign" hint="Newest first.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead className="text-right">Orders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAMPAIGNS.map((campaign) => (
                <TableRow key={campaign.name}>
                  <TableCell>
                    <span className="font-medium">{campaign.name}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {campaign.channel} · {campaign.window}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        campaign.status === "running"
                          ? "default"
                          : campaign.status === "scheduled"
                            ? "outline"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {campaign.revenue ? formatMoneyWhole(campaign.revenue) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {campaign.spend ? formatMoneyWhole(campaign.spend) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.spend ? `${(campaign.revenue / campaign.spend).toFixed(1)}×` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {campaign.orders ? campaign.orders.toLocaleString() : "—"}
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

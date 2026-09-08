import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { INTEGRATIONS, type Integration } from "@/lib/demo";

export const metadata = { title: "Integrations — bran" };

/**
 * The couriers, payment providers and channels the workspace is wired to.
 *
 * Grouped by what they do rather than listed alphabetically: a brand owner
 * arrives here because a parcel needs to move or a card needs to clear, not
 * because they were looking for something beginning with W.
 */
const ORDER: Integration["category"][] = ["Courier", "Payments", "Channel", "Messaging"];

export default function IntegrationsPage() {
  const connected = INTEGRATIONS.filter((item) => item.connected);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Integrations"
        blurb="What bran is plugged into. Couriers collect from the orders queue, payment providers settle in TTD, and channels feed both the calendar and the assistant."
      />

      <StatRow
        stats={[
          { label: "Connected", value: String(connected.length), note: `of ${INTEGRATIONS.length} available` },
          { label: "Couriers", value: "2", note: "Zoom TT and Moving Solutions" },
          { label: "Channels", value: "3", note: "Instagram, TikTok, WhatsApp" },
          { label: "Settled · 30 days", value: "TT$284,920", note: "Through WiPay" },
        ]}
      />

      {ORDER.map((category) => {
        const items = INTEGRATIONS.filter((item) => item.category === category);
        return (
          <Panel key={category} title={category} hint={`${items.length} available.`}>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-6 py-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                      {item.name}
                      {item.connected ? null : <Badge variant="outline">Not connected</Badge>}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{item.blurb}</p>
                    {item.activity ? (
                      <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                        {item.activity}
                      </p>
                    ) : null}
                  </div>
                  {/* The switch carries the state and the label beside it says
                      the same thing in words — colour is never the only cue. */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-[12.5px] text-muted-foreground">
                      {item.connected ? "On" : "Off"}
                    </span>
                    <Switch
                      defaultChecked={item.connected}
                      aria-label={`${item.name} connection`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

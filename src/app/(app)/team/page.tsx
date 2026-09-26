import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/bran/Page";
import { ROLE_RIGHTS, TEAM } from "@/lib/demo";

export const metadata = { title: "Team — bran" };

/**
 * Who can open this workspace, and what they are allowed to do.
 *
 * Each row says what the role actually permits rather than naming it and
 * leaving you to guess — "Fulfilment" means nothing until it says it cannot
 * see billing.
 */
export default function TeamPage() {
  return (
    <div className="w-full">
      <PageHeader
        sample="These team members are examples. Invites come with onboarding."
        title="Team"
        blurb="Everyone with access to FLVS Swim. Accounts are shared with the storefront, so a person signs in once and lands wherever their role allows."
      >
        <Button size="sm">Invite someone</Button>
      </PageHeader>

      <Panel title="Members" hint={`${TEAM.length} people with access.`}>
        <ul className="divide-y divide-border">
          {TEAM.map((member) => (
            <li
              key={member.email}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="text-[12px] font-medium">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{member.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">{member.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="max-w-sm">
                  <Badge variant={member.role === "Owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                    {ROLE_RIGHTS[member.role]}
                  </p>
                </div>
                <p className="w-40 text-[12.5px] text-muted-foreground">{member.lastSeen}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatRow } from "@/components/bran/Page";
import { POSTS, WEEK, type PostState } from "@/lib/demo";

export const metadata = { title: "Content Calendar — bran" };

/**
 * The week, as a board.
 *
 * A list would fit more on screen and would be the wrong shape: the question
 * is "what is going out and when", and the gap between Wednesday and Friday is
 * the answer. An empty column is information here, so empty columns are drawn
 * rather than collapsed.
 */

const STATE_VARIANT: Record<PostState, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  drafted: "outline",
  published: "secondary",
  "needs approval": "default",
};

export default function ContentCalendarPage() {
  const scheduled = POSTS.filter((post) => post.state === "scheduled").length;
  const approvals = POSTS.filter((post) => post.state === "needs approval").length;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Content Calendar"
        blurb="What is going out this week, across every channel. The assistant drafts from the pieces you are restocking, so a post and the stock behind it are never out of step."
      >
        <Button variant="outline" size="sm">
          Connect a channel
        </Button>
        <Button size="sm">New post</Button>
      </PageHeader>

      <StatRow
        stats={[
          { label: "Scheduled this week", value: String(scheduled), note: "Across 3 channels" },
          { label: "Waiting on you", value: String(approvals), note: "Drafted by the assistant" },
          {
            label: "Posted last 30 days",
            value: "31",
            delta: { percent: 14.8, since: "vs prior 30 days" },
            riseIsGood: true,
          },
          {
            label: "Revenue from posts",
            value: "TT$71,200",
            delta: { percent: 22.1, since: "vs prior 30 days" },
            riseIsGood: true,
          },
        ]}
      />

      <Panel title="This week" hint="Monday to Sunday, in the brand's own time.">
        {/* Scrolls inside its own container rather than pushing the page
            sideways — seven columns will not fit a phone and should not try. */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[52rem] grid-cols-7 gap-px bg-border">
            {WEEK.map((day) => {
              const posts = POSTS.filter((post) => post.day === day);
              return (
                <div key={day} className="min-h-[13rem] bg-background p-3">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    {day}
                  </p>

                  <ul className="mt-3 space-y-2">
                    {posts.map((post) => (
                      <li
                        key={post.id}
                        className="rounded-lg border border-border p-2.5 transition-[background-color] duration-150 hover:bg-muted"
                      >
                        <p className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono tabular-nums">{post.time}</span>
                          <span>{post.kind}</span>
                        </p>
                        <p className="mt-1.5 text-[12.5px] leading-snug font-medium text-balance">
                          {post.caption}
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant={STATE_VARIANT[post.state]}>{post.state}</Badge>
                          <span className="text-[11px] text-muted-foreground">{post.channel}</span>
                        </p>
                      </li>
                    ))}

                    {posts.length === 0 ? (
                      <li className="rounded-lg border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">
                        Nothing planned
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}

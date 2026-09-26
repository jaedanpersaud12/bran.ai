"use server";

import { approvalSecret } from "@/lib/ai/assistant";
import { aiConfigured } from "@/lib/ai/model";
import { loadInventory } from "@/lib/inventory";
import { currentWorkspace } from "@/lib/workspace";

export type AssistantState =
  | { available: true; suggestions: string[] }
  | { available: false; reason: string };

/**
 * What the sheet needs when it opens: whether the assistant can run here, and
 * starter questions drawn from the workspace's restock state right now — so a
 * suggestion is always something with a real answer.
 */
export async function assistantState(): Promise<AssistantState> {
  const current = await currentWorkspace();
  if (!current) return { available: false, reason: "Sign in with your FLVS account to use the assistant." };
  if (!aiConfigured || !approvalSecret()) {
    return { available: false, reason: "AI is off for this workspace, so the assistant can't answer." };
  }

  try {
    const { lines, summary } = await loadInventory(current.workspace.id);
    const top = lines.find((line) => line.score.verdict === "reorder");
    const suggestions =
      summary.flagged > 0 && top
        ? [
            "What should I reorder, and why?",
            `Draft an order for the ${summary.flagged} ${summary.flagged === 1 ? "line" : "lines"} restock flagged`,
            `How long will the ${top.name.toLowerCase()} in ${top.variant.toLowerCase()} last?`,
            "What's on order right now?",
          ]
        : ["What's selling fastest?", "What's on order right now?", "Anything I'm overstocked on?"];
    return { available: true, suggestions };
  } catch (error) {
    console.error("assistantState failed", error);
    return { available: true, suggestions: ["What should I reorder?"] };
  }
}

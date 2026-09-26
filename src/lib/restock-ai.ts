import "server-only";

import { sql } from "@/lib/db";
import { aiConfigured, callOptions, model, modelId } from "@/lib/ai/model";
import { runAI } from "@/lib/ai/run";
import { explainLines, fingerprint, type ExplainLine } from "@/lib/restock-explain";

/**
 * Explains the lines the cache didn't cover, and stores what passes.
 *
 * Called from `after()` on the inventory page, so nobody waits on it: this
 * load shows the formula's sentences, the next one shows the model's. A
 * failure is logged by `runAI` and leaves the cache as it was.
 */
export async function explainMissing(workspaceId: string, lines: ExplainLine[]): Promise<void> {
  if (!aiConfigured || !sql || lines.length === 0) return;

  const result = await runAI({
    feature: "restock-explain",
    workspaceId,
    call: async (signal) => {
      const { reasons, usage } = await explainLines({
        model: model(),
        lines,
        abortSignal: signal,
        providerOptions: callOptions.providerOptions,
      });
      return { value: reasons, usage };
    },
  });
  if (!result || result.size === 0) return;

  const explained = lines.filter((line) => result.has(line.id));
  const ids = explained.map((line) => line.id);
  const prints = explained.map(fingerprint);
  const reasons = explained.map((line) => result.get(line.id) ?? "");

  try {
    // Joined to the workspace's own variants, so an id can only land in the
    // workspace that asked for it.
    await sql`
      insert into bran.restock_explanations (workspace_id, variant_id, fingerprint, reason, model)
      select ${workspaceId}, v.id, t.fingerprint, t.reason, ${modelId}
        from unnest(${ids}::uuid[], ${prints}::text[], ${reasons}::text[]) as t(id, fingerprint, reason)
        join bran.variants v on v.id = t.id and v.workspace_id = ${workspaceId}
      on conflict (workspace_id, variant_id) do update
        set fingerprint = excluded.fingerprint, reason = excluded.reason,
            model = excluded.model, created_at = now()
    `;
  } catch (error) {
    console.error("restock_explanations upsert failed", error);
  }
}

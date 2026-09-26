import "server-only";

import { sql } from "@/lib/db";
import { aiConfigured, modelId } from "@/lib/ai/model";

/** Long enough for a batched explanation; short enough that a stuck call dies. */
const TIMEOUT_MS = 15_000;

export type Usage = { inputTokens?: number; outputTokens?: number };

/**
 * Every AI call in bran goes through here.
 *
 * It never throws: a model call is always an enhancement on something the app
 * can already do without it, so the caller gets `null` and carries on with
 * its fallback. It always logs one `bran.ai_runs` row — feature, model,
 * tokens, time, outcome, never the prompt or the answer — so what the model
 * costs per workspace is a query, not a guess.
 */
export async function runAI<T>({
  feature,
  workspaceId,
  call,
  timeoutMs = TIMEOUT_MS,
  model = modelId,
}: {
  /** Short, stable name for the ai_runs log: `restock-explain`, later `dm-reply`. */
  feature: string;
  workspaceId: string | null;
  call: (signal: AbortSignal) => Promise<{ value: T; usage?: Usage }>;
  /** Overrides the 15s default for calls that read a whole document. */
  timeoutMs?: number;
  /** The model id to log, when the call used another model than the default. */
  model?: string;
}): Promise<T | null> {
  if (!aiConfigured) return null;

  const started = Date.now();
  try {
    const { value, usage } = await call(AbortSignal.timeout(timeoutMs));
    await logRun({ feature, workspaceId, model, ok: true, usage, ms: Date.now() - started });
    return value;
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`AI call "${feature}" failed`, message);
    await logRun({ feature, workspaceId, model, ok: false, error: message, ms: Date.now() - started });
    return null;
  }
}

/**
 * One `bran.ai_runs` row. `runAI` calls it for request/response calls; a
 * streamed agent logs from its `onEnd` with the run's total usage.
 */
export async function logRun(run: {
  feature: string;
  workspaceId: string | null;
  model?: string;
  ok: boolean;
  error?: string;
  usage?: Usage;
  ms: number;
}): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into bran.ai_runs
        (workspace_id, feature, model, ok, error, input_tokens, output_tokens, duration_ms)
      values (${run.workspaceId}, ${run.feature}, ${run.model ?? modelId}, ${run.ok},
              ${run.error?.slice(0, 500) ?? null}, ${run.usage?.inputTokens ?? null},
              ${run.usage?.outputTokens ?? null}, ${run.ms})
    `;
  } catch (error) {
    // Losing a log row must never cost the caller its answer.
    console.error("ai_runs insert failed", error);
  }
}

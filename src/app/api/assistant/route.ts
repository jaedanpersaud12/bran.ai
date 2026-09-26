import { createAgentUIStreamResponse } from "ai";
import { approvalSecret, makeAssistant } from "@/lib/ai/assistant";
import { aiConfigured } from "@/lib/ai/model";
import { currentWorkspace } from "@/lib/workspace";

/** One agent turn. Streams UI messages to the Assistant sheet's `useChat`. */
export async function POST(request: Request): Promise<Response> {
  const current = await currentWorkspace();
  if (!current) return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });

  const secret = approvalSecret();
  if (!aiConfigured || !secret) {
    return Response.json({ error: "AI is off for this workspace." }, { status: 503 });
  }

  // Only the messages are read from the body. The workspace, and so every
  // tool's reach, comes from the session above.
  const body: unknown = await request.json().catch(() => null);
  const messages =
    typeof body === "object" && body !== null && "messages" in body && Array.isArray(body.messages)
      ? body.messages
      : null;
  if (!messages) return Response.json({ error: "Expected { messages }." }, { status: 400 });

  const agent = makeAssistant(
    {
      workspaceId: current.workspace.id,
      workspaceName: current.workspace.name,
      userId: current.user?.id ?? null,
    },
    secret,
  );
  return createAgentUIStreamResponse({ agent, uiMessages: messages, abortSignal: request.signal });
}

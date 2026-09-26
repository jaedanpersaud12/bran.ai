"use client";

import { useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isStaticToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ToolUIPart,
} from "ai";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { AiMark } from "@/components/bran/AiMark";
import type { AssistantMessage } from "@/lib/ai/assistant";

/**
 * The conversation itself. Its own module, loaded only when the sheet opens:
 * `ai`, `@ai-sdk/react` and the markdown renderer are a lot of client code to
 * ship on every page for a panel most visits never open.
 */

/** What each tool is called on screen: what it did, in the owner's words. */
const TOOL_TITLES: Record<string, string> = {
  getRestock: "Read restock",
  findVariants: "Searched the catalogue",
  listPurchaseOrders: "Read purchase orders",
  draftPurchaseOrder: "Draft purchase order",
  setStock: "Set stock count",
};

const WRITES = new Set(["draftPurchaseOrder", "setStock"]);

const AI_TITLE =
  "Written by AI from the tool results shown with it. Restock's verdicts and quantities come from its formula.";

export default function Chat({ suggestions }: { suggestions: string[] }) {
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/assistant" }));
  const { messages, sendMessage, status, stop, error, addToolApprovalResponse } =
    useChat<AssistantMessage>({
      transport,
      // Once the owner answers an approval, carry on without another prompt.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  return (
    <>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 p-5">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask about your stock"
              description="Try one of these, or ask your own."
            >
              <Suggestions className="mt-4 flex-wrap justify-center">
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={(text) => sendMessage({ text })}
                  />
                ))}
              </Suggestions>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    const key = `${message.id}-${index}`;
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <div key={key} className="text-[13.5px] leading-relaxed">
                          <MessageResponse>{part.text}</MessageResponse>
                          {part.state === "done" ? (
                            <AiMark title={AI_TITLE} label="Written by AI" />
                          ) : null}
                        </div>
                      ) : (
                        <p key={key} className="text-[13.5px]">
                          {part.text}
                        </p>
                      );
                    }
                    if (!isStaticToolUIPart(part)) return null;
                    const name = getToolName(part);

                    return WRITES.has(name) ? (
                      <ActionCard
                        key={key}
                        name={name}
                        part={part}
                        onRespond={(approved) => {
                          if (part.approval) addToolApprovalResponse({ id: part.approval.id, approved });
                        }}
                      />
                    ) : (
                      <Tool key={key} className="mb-0">
                        <ToolHeader type={part.type} state={part.state} title={TOOL_TITLES[name] ?? name} />
                        <ToolContent>
                          <ToolInput input={part.input} />
                          <ToolOutput
                            output={part.state === "output-available" ? part.output : undefined}
                            errorText={part.state === "output-error" ? part.errorText : undefined}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {error ? (
            <p role="alert" className="text-[12.5px] text-negative">
              Something went wrong: {error.message}. Try asking again.
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-4">
        <PromptInput
          onSubmit={(message) => {
            if (message.text.trim()) sendMessage({ text: message.text });
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about stock, restock or orders…" />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

type WriteOutput = {
  drafted?: string;
  link?: string;
  piece?: string;
  was?: number;
  now?: number;
  error?: string;
};

/**
 * A write the assistant wants to make. The summary is bran's — computed on the
 * server from the database when the approval was requested — so what the
 * owner approves is exactly what will run.
 */
function ActionCard({
  name,
  part,
  onRespond,
}: {
  name: string;
  part: ToolUIPart;
  onRespond: (approved: boolean) => void;
}) {
  const output = (part.state === "output-available" ? part.output : null) as WriteOutput | null;

  return (
    <Confirmation approval={part.approval} state={part.state} className="border-border bg-card text-[13px]">
      <p className="font-medium">{TOOL_TITLES[name] ?? name}</p>
      <ConfirmationTitle className="text-muted-foreground">
        {part.approval && "requestReason" in part.approval && part.approval.requestReason
          ? part.approval.requestReason
          : "The assistant wants to make a change."}
      </ConfirmationTitle>
      <ConfirmationRequest>
        <ConfirmationActions>
          <ConfirmationAction variant="outline" onClick={() => onRespond(false)}>
            Don&apos;t
          </ConfirmationAction>
          <ConfirmationAction onClick={() => onRespond(true)}>
            {name === "draftPurchaseOrder" ? "Draft it" : "Set it"}
          </ConfirmationAction>
        </ConfirmationActions>
      </ConfirmationRequest>
      <ConfirmationAccepted>
        <p className="text-[12.5px] text-success">
          {output?.error ? (
            output.error
          ) : output?.drafted && output.link ? (
            <>
              Approved — drafted{" "}
              <Link href={output.link} className="underline underline-offset-4">
                {output.drafted}
              </Link>
              .
            </>
          ) : output?.piece ? (
            `Approved — ${output.piece} set from ${output.was} to ${output.now}.`
          ) : (
            "Approved."
          )}
        </p>
      </ConfirmationAccepted>
      <ConfirmationRejected>
        <p className="text-[12.5px] text-muted-foreground">Not approved. Nothing was changed.</p>
      </ConfirmationRejected>
    </Confirmation>
  );
}

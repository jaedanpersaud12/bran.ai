import { Sparkles } from "lucide-react";

/**
 * Marks text a language model wrote, where it sits (ui-rules: "How AI is
 * presented"). Everything without it on the screen is computed by bran.
 *
 * `title` says what the model did and didn't decide, for anyone who hovers;
 * the sr-only label says it for screen readers.
 */
export function AiMark({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="ml-1.5 inline-flex translate-y-[1px] items-center text-subtle-foreground"
    >
      <Sparkles aria-hidden className="size-3" strokeWidth={1.5} />
      <span className="sr-only">Explained by AI</span>
    </span>
  );
}

/** The restock wording, shared so the planner and the card say the same thing. */
export const RESTOCK_AI_TITLE =
  "Written by AI from the numbers in this row. The verdict and the quantity come from restock's formula.";

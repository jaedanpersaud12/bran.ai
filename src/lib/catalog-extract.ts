/**
 * The model's half of catalogue import: reading a price list, an invoice or a
 * supplier's message and saying which products and variants are in it.
 *
 * It only transcribes. Every field is nullable and the instructions forbid
 * guessing, because a made-up price or count would go straight into restock;
 * a blank is something the owner fills in on the review table. What the
 * model returns is a draft — `catalog-import.ts` checks it, and nothing is
 * written until the owner imports.
 *
 * Takes the model as an argument and imports nothing from the app, so the
 * tests can hand it a mock and run under `node --test`.
 */

import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

/** Existing products named in the prompt, so a big catalogue doesn't crowd out the document. */
const MAX_KNOWN_PRODUCTS = 200;

/** A draft longer than this is cut, and the dialog says so. */
export const MAX_DRAFT_ROWS = 100;
/** Pasted text beyond this is refused before any call is made. */
export const MAX_TEXT = 20_000;

export const INSTRUCTIONS = `You read documents from a small Caribbean clothing brand's suppliers — price lists, invoices, order confirmations, WhatsApp messages — and list the products in them.
Each item is one sellable variant: a product (e.g. "Linen shirt") in one size, colour or style (e.g. "White · M"). If a line covers several sizes or colours, return one item per size or colour.
Copy values exactly as the document gives them. Never guess, estimate or calculate a value the document doesn't state: use null instead.
- product: the product's name, without the size or colour.
- variant: the size, colour or style. "One size" if the document says there is only one.
- sku: the supplier's code or SKU for that item, or null.
- unitCost: what the brand pays per unit, as written (e.g. "68.50"), or null.
- price: the retail selling price per unit, only if the document states one, or null. Never copy the cost into price.
- minOrderQty: the supplier's minimum order quantity for that item, or null.
- onHand: units the brand already has in stock, only if the document says so, or null. An ordered or invoiced quantity is not stock on hand.
- currency: the currency the document's money is in, as an ISO code (TTD, USD, CNY…), or null if it doesn't say.
- supplierEmail: the supplier's email address if the document shows one, or null.
- leadTimeDays: the supplier's stated lead time or turnaround in days ("2 weeks" is 14), or null.
If an item is one of the brand's existing products (listed with the document), use that product's exact name, and write its variant the way the existing variants are written.
Return at most ${MAX_DRAFT_ROWS} items. If the document has no products, return an empty list.`;

const nullableText = z.string().nullable();

export const extractSchema = z.object({
  currency: nullableText,
  supplierEmail: nullableText,
  leadTimeDays: z.number().nullable(),
  items: z.array(
    z.object({
      product: nullableText,
      variant: nullableText,
      sku: nullableText,
      unitCost: nullableText,
      price: nullableText,
      minOrderQty: z.number().nullable(),
      onHand: z.number().nullable(),
    }),
  ),
});

export type Extracted = z.infer<typeof extractSchema>;
export type ExtractedItem = Extracted["items"][number];

export type ExtractSource =
  | { kind: "text"; text: string }
  /**
   * A data URL (`data:image/jpeg;base64,…`), already downsized by the browser,
   * and anything the owner typed alongside it.
   */
  | { kind: "image"; dataUrl: string; note?: string };

/** One of the brand's products, with a few of its variant labels as a style guide. */
export type KnownProduct = { name: string; variants: string[] };

export type ExtractResult = {
  extracted: Extracted;
  /** The document had more than `MAX_DRAFT_ROWS` items; the rest were dropped. */
  truncated: boolean;
  usage: { inputTokens?: number; outputTokens?: number };
};

/** `data:image/jpeg;base64,…` → its media type and bytes, or null if it isn't an image. */
export function parseDataUrl(dataUrl: string): { mediaType: string; data: Uint8Array } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: Buffer.from(match[2], "base64") };
}

export async function extractCatalog({
  model,
  source,
  known = [],
  abortSignal,
  providerOptions,
}: {
  model: LanguageModel;
  source: ExtractSource;
  /** The workspace's products, so a new variant of one joins it instead of becoming a new product. */
  known?: KnownProduct[];
  abortSignal?: AbortSignal;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}): Promise<ExtractResult> {
  const context = { type: "text" as const, text: knownProducts(known) };
  const content =
    source.kind === "text"
      ? [context, { type: "text" as const, text: `The document:\n\n${source.text}` }]
      : [
          context,
          {
            type: "text" as const,
            text: source.note
              ? `The document is this photo. The owner adds:\n\n${source.note}`
              : "The document is this photo.",
          },
          imagePart(source.dataUrl),
        ];

  const result = await generateText({
    model,
    instructions: INSTRUCTIONS,
    messages: [{ role: "user", content }],
    output: Output.object({ schema: extractSchema }),
    abortSignal,
    providerOptions,
    maxRetries: 1,
  });

  const items = result.output.items;
  return {
    extracted: { ...result.output, items: items.slice(0, MAX_DRAFT_ROWS) },
    truncated: items.length > MAX_DRAFT_ROWS,
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
  };
}

/** The existing-products list the instructions refer to. */
export function knownProducts(known: KnownProduct[]): string {
  if (known.length === 0) return "The brand has no products yet.";
  const lines = known
    .slice(0, MAX_KNOWN_PRODUCTS)
    .map((product) => `- ${product.name} (${product.variants.slice(0, 3).join("; ")})`);
  return `The brand's existing products, with some of their variants:\n${lines.join("\n")}`;
}

function imagePart(dataUrl: string) {
  const image = parseDataUrl(dataUrl);
  if (!image) throw new Error("Not an image data URL");
  return { type: "file" as const, mediaType: image.mediaType, data: image.data };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { extractCatalog, MAX_DRAFT_ROWS, parseDataUrl } from "./catalog-extract.ts";

const row = { product: "Linen shirt", variant: "M", sku: null, unitCost: "85", price: null, minOrderQty: null, onHand: null };

function mockModel(items: unknown[]) {
  const calls: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options.prompt);
      return {
        content: [{ type: "text", text: JSON.stringify({ currency: "TTD", supplierEmail: null, leadTimeDays: null, items }) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 900, noCache: 900, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 300, text: 300, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, calls };
}

test("returns the model's items and its token counts", async () => {
  const { model } = mockModel([row]);
  const result = await extractCatalog({ model, source: { kind: "text", text: "Linen shirt M 85" } });
  assert.equal(result.extracted.items.length, 1);
  assert.equal(result.extracted.currency, "TTD");
  assert.equal(result.truncated, false);
  assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 300 });
});

test(`cuts a draft at ${MAX_DRAFT_ROWS} rows and says so`, async () => {
  const { model } = mockModel(Array.from({ length: MAX_DRAFT_ROWS + 5 }, () => row));
  const result = await extractCatalog({ model, source: { kind: "text", text: "a long list" } });
  assert.equal(result.extracted.items.length, MAX_DRAFT_ROWS);
  assert.equal(result.truncated, true);
});

test("a photo is sent as an image file part", async () => {
  const { model, calls } = mockModel([row]);
  await extractCatalog({ model, source: { kind: "image", dataUrl: "data:image/jpeg;base64,/9j/4AAQ" } });
  const prompt = JSON.stringify(calls[0]);
  assert.match(prompt, /"type":"file"/);
  assert.match(prompt, /image\/jpeg/);
});

test("anything but an image data URL is refused before a call", async () => {
  assert.equal(parseDataUrl("data:text/html;base64,PGgxPg=="), null);
  assert.equal(parseDataUrl("https://example.com/list.jpg"), null);
  const { model, calls } = mockModel([row]);
  await assert.rejects(extractCatalog({ model, source: { kind: "image", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" } }));
  assert.equal(calls.length, 0);
});

test("the brand's existing products go with the document, so new variants can join them", async () => {
  const { model, calls } = mockModel([row]);
  await extractCatalog({
    model,
    source: { kind: "text", text: "maracas flame L $74" },
    known: [{ name: "Maracas bandeau", variants: ["Flame · M", "Flame · S"] }],
  });
  assert.match(JSON.stringify(calls[0]), /Maracas bandeau \(Flame · M; Flame · S\)/);
});

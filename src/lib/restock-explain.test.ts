import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import {
  acceptReason,
  buildPrompt,
  explainLines,
  fingerprint,
  type ExplainLine,
} from "./restock-explain.ts";

const blackS: ExplainLine = {
  id: "v-black-s",
  name: "Tobago triangle top",
  variant: "Black · S",
  verdict: "reorder",
  suggested: 76,
  onHand: 5,
  onOrder: 0,
  leadTimeDays: 21,
  pace: 1.6,
  cover: 3.1,
  trend: 1,
};

const sandL: ExplainLine = {
  ...blackS,
  id: "v-sand-l",
  name: "Store Bay high-waist",
  variant: "Sand · L",
  verdict: "hold",
  suggested: 0,
  onHand: 40,
  pace: 0.8,
  cover: 51,
};

/** A mock that answers with `payload` as the model's JSON text. */
function answering(payload: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 420, noCache: 420, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 64, text: 64, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

test("valid reasons come back keyed by line, with token usage", async () => {
  const { reasons, usage } = await explainLines({
    model: answering({
      lines: [
        { id: "v-black-s", reason: "Only 5 left and it sells 1.6 a day, so it's gone long before a new run lands in 21 days. Order 76." },
        { id: "v-sand-l", reason: "About 51 days on the shelf already. No need to tie up more cash." },
      ],
    }),
    lines: [blackS, sandL],
  });
  assert.equal(reasons.size, 2);
  assert.match(reasons.get("v-black-s") ?? "", /Order 76/);
  assert.deepEqual(usage, { inputTokens: 420, outputTokens: 64 });
});

test("unknown ids, duplicates, empty and overlong reasons are dropped line by line", async () => {
  const { reasons } = await explainLines({
    model: answering({
      lines: [
        { id: "v-somebody-elses", reason: "Order 5." },
        { id: "v-black-s", reason: "   " },
        { id: "v-sand-l", reason: "x".repeat(300) },
      ],
    }),
    lines: [blackS, sandL],
  });
  assert.equal(reasons.size, 0);
});

test("the first answer for a line wins over a later duplicate", async () => {
  const { reasons } = await explainLines({
    model: answering({
      lines: [
        { id: "v-black-s", reason: "Order 76 now." },
        { id: "v-black-s", reason: "Order 5." },
      ],
    }),
    lines: [blackS],
  });
  assert.equal(reasons.get("v-black-s"), "Order 76 now.");
});

test("a reason quoting a number the model wasn't given is refused", () => {
  assert.equal(acceptReason("11 people asked about it in DMs. Order 76.", blackS), null);
  assert.equal(acceptReason("Carnival is in 40 days.", blackS), null);
  assert.equal(acceptReason("5 left at 1.6 a day; order 76 to cover 51 days.", blackS),
    "5 left at 1.6 a day; order 76 to cover 51 days.");
  // Whitespace is tidied, not refused.
  assert.equal(acceptReason("  Order\n76.  ", blackS), "Order 76.");
});

test("a model error propagates, so runAI can log it and the caller falls back", async () => {
  const failing = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("503 from provider");
    },
  });
  await assert.rejects(explainLines({ model: failing, lines: [blackS] }), /503/);
});

test("the fingerprint changes when what the sentence describes changes, and only then", () => {
  const base = fingerprint(blackS);
  assert.equal(fingerprint({ ...blackS, pace: 1.64 }), base, "pace rounds to what's said");
  assert.equal(fingerprint({ ...blackS, cover: 3.4 }), base, "cover rounds to whole days");
  assert.notEqual(fingerprint({ ...blackS, onHand: 6 }), base);
  assert.notEqual(fingerprint({ ...blackS, suggested: 80 }), base);
  assert.notEqual(fingerprint({ ...blackS, trend: 1.5 }), base);
});

test("the prompt carries each line's numbers and id", () => {
  const prompt = buildPrompt([blackS]);
  assert.match(prompt, /"id": "v-black-s"/);
  assert.match(prompt, /"order_quantity": 76/);
  assert.match(prompt, /"days_of_cover": 3/);
});

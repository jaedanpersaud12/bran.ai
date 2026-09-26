import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import {
  acceptProse,
  assemble,
  groupBySupplier,
  lineList,
  templateProse,
  writeProse,
  type EmailContext,
  type EmailLine,
} from "./po-email.ts";

const context: EmailContext = { reference: "PO-0002", brand: "FLVS Swim", leadTimeDays: 21 };

const lines: EmailLine[] = [
  { piece: "Tobago triangle top", variant: "Black · S", sku: "FLV-TRI-BLK-S", quantity: 76, unitCostCents: 6800, supplierEmail: "orders@portofspainsewing.tt" },
  { piece: "Buccoo wrap skirt", variant: "Palm", sku: "FLV-WRP-GRN-U", quantity: 51, unitCostCents: 7650, supplierEmail: "Orders@PortOfSpainSewing.tt " },
  { piece: "Store Bay high-waist", variant: "Sand · M", sku: "FLV-HIP-SND-M", quantity: 10, unitCostCents: 8200, supplierEmail: null },
  { piece: "Pigeon Point one-piece", variant: "Navy · S", sku: "FLV-ONE-NVY-S", quantity: 47, unitCostCents: 9600, supplierEmail: "hello@medellinswim.co" },
];

function answering(payload: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 180, noCache: 180, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 90, text: 90, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

test("lines group by supplier, case- and space-insensitively, with no-supplier last", () => {
  const groups = groupBySupplier(lines);
  assert.deepEqual(
    groups.map((group) => [group.supplierEmail, group.lines.length]),
    [
      ["hello@medellinswim.co", 1],
      ["orders@portofspainsewing.tt", 2],
      [null, 1],
    ],
  );
});

test("the line list is exact: quantities, unit costs and totals from the order", () => {
  const list = lineList(lines.slice(0, 2));
  assert.match(list, /Tobago triangle top, Black · S \(FLV-TRI-BLK-S\) × 76 at TT\$68 each/);
  assert.match(list, /× 51 at TT\$76\.50 each/);
  // 76 × 68 + 51 × 76.50 = 5,168 + 3,901.50
  assert.match(list, /127 units, TT\$9,069\.50/);
});

test("model prose is used, and the body carries bran's line list between opening and closing", async () => {
  const group = groupBySupplier(lines)[1];
  const { prose, usage } = await writeProse({
    model: answering({
      subject: "Purchase order PO-0002 — FLVS Swim",
      opening: "Hi team,\n\nHope the week's going well. Here's our next order, PO-0002.",
      closing: "Could you confirm quantities and a ready date? Within 21 days would be ideal.\n\nThanks,\nFLVS Swim",
    }),
    context,
    group,
  });
  assert.ok(prose);
  const email = assemble(prose, group, true);
  assert.equal(email.aiWritten, true);
  assert.match(email.body, /^Hi team,[\s\S]*× 76 at TT\$68 each[\s\S]*Thanks,\nFLVS Swim$/);
  assert.deepEqual(usage, { inputTokens: 180, outputTokens: 90 });
});

test("prose that mentions a quantity or price is refused, so the template is used", async () => {
  const { prose } = await writeProse({
    model: answering({
      subject: "PO-0002",
      opening: "Please send 76 triangle tops at TT$68.",
      closing: "Thanks",
    }),
    context,
    group: groupBySupplier(lines)[1],
  });
  assert.equal(prose, null);
});

test("empty or overlong parts are refused; the reference and lead time are allowed", () => {
  assert.equal(acceptProse({ subject: "", opening: "Hi", closing: "Thanks" }, context), null);
  assert.equal(acceptProse({ subject: "Order", opening: "x".repeat(900), closing: "Thanks" }, context), null);
  assert.ok(acceptProse({ subject: "PO-0002", opening: "Order 0002 below.", closing: "Within 21 days, please." }, context));
  assert.equal(acceptProse({ subject: "PO-0002", opening: "Order below.", closing: "Within 30 days." }, context), null);
});

test("the template is complete and correct on its own", () => {
  const group = groupBySupplier(lines)[2];
  const email = assemble(templateProse(context), group, false);
  assert.equal(email.subject, "Purchase order PO-0002 from FLVS Swim");
  assert.equal(email.aiWritten, false);
  assert.match(email.body, /× 10 at TT\$82 each/);
  assert.match(email.body, /within 21 days/);
});

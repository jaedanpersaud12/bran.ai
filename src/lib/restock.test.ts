import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreVariant, summarise, type VariantInput } from "./restock.ts";

/** A line that sells 2 a day, steadily, with a 21-day lead time. */
const steady: VariantInput = {
  onHand: 20,
  onOrder: 0,
  leadTimeDays: 21,
  minOrderQty: 5,
  sold14: 28,
  sold7: 14,
  soldPrior7: 14,
};

test("short cover on a line that sells is a reorder sized to lead time plus a month", () => {
  const score = scoreVariant(steady);
  assert.equal(score.verdict, "reorder");
  assert.equal(score.pace, 2);
  assert.equal(score.cover, 10);
  // 2/day × (21 + 30) − 20 on hand
  assert.equal(score.suggested, 82);
  // 2/day × 21 days of lead time − 20 on hand
  assert.equal(score.shortfall, 22);
});

test("an out-of-stock line that was selling is a reorder and says it is out", () => {
  const score = scoreVariant({ ...steady, onHand: 0 });
  assert.equal(score.verdict, "reorder");
  assert.equal(score.cover, 0);
  assert.equal(score.suggested, 102);
  assert.match(score.reason, /^Out of stock/);
});

test("stock on order counts toward cover and comes off the suggestion", () => {
  const short = scoreVariant({ ...steady, onOrder: 20 });
  assert.equal(short.verdict, "reorder");
  assert.equal(short.cover, 20);
  assert.equal(short.suggested, 62);
  assert.match(short.reason, /20 already on order/);

  // 40 days of cover once 60 land: within what restock would order, so it's
  // the plan working, not overstock.
  const covered = scoreVariant({ ...steady, onOrder: 60 });
  assert.equal(covered.verdict, "watch");
  assert.equal(covered.suggested, 0);
  assert.match(covered.reason, /60 on order covers the 21-day wait/);
});

test("following restock's own suggestion never earns a 'trim that order' hold", () => {
  const first = scoreVariant(steady);
  const after = scoreVariant({ ...steady, onOrder: first.suggested });
  assert.equal(after.verdict, "watch");
  assert.doesNotMatch(after.reason, /trim/i);
});

test("more on order than restock would ever suggest is flagged to trim", () => {
  // 20 + 200 = 110 days of cover, past 21 + 30 + 7.
  const over = scoreVariant({ ...steady, onOrder: 200 });
  assert.equal(over.verdict, "hold");
  assert.match(over.reason, /200 on order takes cover to 90\+ days. Consider trimming/);
});

test("a suggestion never goes below the supplier's minimum", () => {
  // Cover of 27.5 days is just under 21 + 7, so it reorders, but a month's
  // extra need is only a few units.
  const score = scoreVariant({ ...steady, onHand: 55, minOrderQty: 50 });
  assert.equal(score.verdict, "reorder");
  assert.equal(score.suggested, 50);
});

test("comfortable cover and a steady trend is a watch", () => {
  const score = scoreVariant({ ...steady, onHand: 60 });
  assert.equal(score.verdict, "watch");
  assert.equal(score.suggested, 0);
  assert.equal(score.cover, 30);
});

test("more than 35 days of cover is a hold", () => {
  const score = scoreVariant({ ...steady, onHand: 80 });
  assert.equal(score.verdict, "hold");
  assert.equal(score.suggested, 0);
});

test("a falling trend holds a line that isn't short", () => {
  const score = scoreVariant({ ...steady, onHand: 60, sold7: 4, soldPrior7: 24 });
  assert.equal(score.verdict, "hold");
  assert.match(score.reason, /fell/);
});

test("a slow line is never reordered on cover alone", () => {
  const score = scoreVariant({ ...steady, onHand: 1, sold14: 5, sold7: 3, soldPrior7: 2 });
  assert.equal(score.pace, 5 / 14);
  assert.notEqual(score.verdict, "reorder");
});

test("zero sales is a hold with no cover and no trend", () => {
  const score = scoreVariant({ ...steady, sold14: 0, sold7: 0, soldPrior7: 0 });
  assert.equal(score.verdict, "hold");
  assert.equal(score.cover, null);
  assert.equal(score.trend, null);
  assert.equal(score.suggested, 0);
});

test("the summary adds up reorders only and takes the median of real covers", () => {
  const lines = [
    { score: scoreVariant(steady), unitCostCents: 1000, priceCents: 3000 },
    { score: scoreVariant({ ...steady, onHand: 60 }), unitCostCents: 1000, priceCents: 3000 },
    { score: scoreVariant({ ...steady, sold14: 0, sold7: 0, soldPrior7: 0 }), unitCostCents: 1000, priceCents: 3000 },
  ];
  const summary = summarise(lines);
  assert.equal(summary.flagged, 1);
  assert.equal(summary.units, 82);
  assert.equal(summary.costCents, 82_000);
  assert.equal(summary.atRiskCents, 22 * 3000);
  // Covers 10 and 30; the line that doesn't sell has none.
  assert.equal(summary.medianCover, 20);
});

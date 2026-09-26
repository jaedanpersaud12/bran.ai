import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoneyInput,
  parseMoney,
  parseProduct,
  parseStock,
  parseVariant,
  type VariantInput,
} from "./catalog-input.ts";

const variant: VariantInput = {
  label: "Black · S",
  sku: "flv-tri-blk-s",
  unitCost: "68",
  price: "240.00",
  onHand: "12",
  minOrderQty: "5",
};

test("money parses whole, one and two decimals, commas and a TT$ prefix, in cents", () => {
  assert.equal(parseMoney("68"), 6800);
  assert.equal(parseMoney("68.5"), 6850);
  assert.equal(parseMoney("68.50"), 6850);
  assert.equal(parseMoney(" TT$1,250.99 "), 125099);
  assert.equal(parseMoney("0"), 0);
  // The float trap: 0.29 * 100 is 28.999… as a float.
  assert.equal(parseMoney("0.29"), 29);
});

test("money refuses negatives, three decimals, words and absurd amounts", () => {
  for (const bad of ["-5", "68.505", "sixty", "", "1e3", "12.", "10000000"]) {
    assert.equal(parseMoney(bad), null, bad);
  }
});

test("cents format back to what a person would type", () => {
  assert.equal(formatMoneyInput(6800), "68");
  assert.equal(formatMoneyInput(6850), "68.50");
  assert.equal(formatMoneyInput(5), "0.05");
});

test("a valid variant parses, with the SKU upper-cased", () => {
  const result = parseVariant(variant);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      label: "Black · S",
      sku: "FLV-TRI-BLK-S",
      unitCostCents: 6800,
      priceCents: 24000,
      onHand: 12,
      minOrderQty: 5,
    });
  }
});

test("every bad variant field gets its own message, and nothing parses", () => {
  const result = parseVariant({
    label: "  ",
    sku: "has spaces",
    unitCost: "-1",
    price: "abc",
    onHand: "2.5",
    minOrderQty: "0",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(Object.keys(result.errors).sort(), [
      "label",
      "minOrderQty",
      "onHand",
      "price",
      "sku",
      "unitCost",
    ]);
  }
});

test("a product needs a name and a lead time; the supplier email is optional but checked", () => {
  const ok = parseProduct({ name: " Tobago top ", leadTimeDays: "21", supplierEmail: "" });
  assert.deepEqual(ok, { ok: true, value: { name: "Tobago top", leadTimeDays: 21, supplierEmail: null } });

  const bad = parseProduct({ name: "", leadTimeDays: "0", supplierEmail: "not-an-email" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["leadTimeDays", "name", "supplierEmail"]);
});

test("a stock count is a whole number from zero up", () => {
  assert.equal(parseStock("0"), 0);
  assert.equal(parseStock("1,200"), 1200);
  assert.equal(parseStock("-3"), null);
  assert.equal(parseStock("4.5"), null);
  assert.equal(parseStock(""), null);
});

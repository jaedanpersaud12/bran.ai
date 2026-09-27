import { test } from "node:test";
import assert from "node:assert/strict";
import { flvsItemKey, importTakesStock, mapFlvsOrder, orderTotals, parseOrder, type OrderInput } from "./order-input.ts";

const input = (over: Partial<OrderInput> = {}): OrderInput => ({
  customerName: "Keisha M.",
  customerPhone: "+1 868 555 0142",
  channel: "instagram",
  delivery: "courier",
  area: "Woodbrook",
  payment: "cod",
  deliveryFee: "35",
  notes: "",
  lines: [{ variantId: "v1", quantity: "2", unitPrice: "260" }],
  ...over,
});

test("a complete order parses, money into cents", () => {
  const result = parseOrder(input());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.deliveryFeeCents, 3500);
  assert.deepEqual(result.value.lines, [{ variantId: "v1", quantity: 2, unitPriceCents: 26000 }]);
  assert.equal(result.value.payment, "cod");
  assert.equal(result.value.notes, null);
});

test("a blank delivery fee is zero; pickup needs no area", () => {
  const result = parseOrder(input({ deliveryFee: "", delivery: "pickup", area: "" }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.deliveryFeeCents, 0);
});

test("switching to pickup drops the area and fee that were typed for a courier", () => {
  const result = parseOrder(input({ delivery: "pickup", area: "x".repeat(200), deliveryFee: "abc" }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.area, null);
  assert.equal(result.value.deliveryFeeCents, 0);
});

test("a line that isn't an object is refused as an empty line, not thrown on", () => {
  const result = parseOrder({ ...input(), lines: [null as unknown as OrderInput["lines"][number]] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.lineErrors[0].variantId);
});

test("missing name, bad phone, unknown channel and courier without area are refused per field", () => {
  const result = parseOrder(input({ customerName: " ", customerPhone: "call me", channel: "fax", area: "" }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.customerName);
  assert.ok(result.errors.customerPhone);
  assert.ok(result.errors.channel);
  assert.ok(result.errors.area);
});

test("line problems are reported against their line", () => {
  const result = parseOrder(
    input({
      lines: [
        { variantId: "v1", quantity: "2", unitPrice: "260" },
        { variantId: "", quantity: "0", unitPrice: "abc" },
      ],
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.lineErrors[0], {});
  assert.ok(result.lineErrors[1].variantId);
  assert.ok(result.lineErrors[1].quantity);
  assert.ok(result.lineErrors[1].unitPrice);
});

test("no lines is refused", () => {
  const result = parseOrder(input({ lines: [] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.lines);
});

test("two lines for one variant merge, keeping the first price", () => {
  const result = parseOrder(
    input({
      lines: [
        { variantId: "v1", quantity: "2", unitPrice: "260" },
        { variantId: "v1", quantity: "3", unitPrice: "250" },
      ],
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.lines, [{ variantId: "v1", quantity: 5, unitPriceCents: 26000 }]);
});

test("totals add the delivery fee to the lines", () => {
  assert.deepEqual(orderTotals([{ quantity: 2, unitPriceCents: 26000 }, { quantity: 1, unitPriceCents: 9800 }], 3500), {
    subtotalCents: 61800,
    deliveryFeeCents: 3500,
    totalCents: 65300,
  });
});

test("a storefront item key sorts its choices", () => {
  assert.equal(flvsItemKey("flvs-kino", { Size: "XS", Colour: "Jouvert" }), "flvs-kino|Colour=Jouvert|Size=XS");
  assert.equal(flvsItemKey("pink-camo", {}), "pink-camo");
});

const flvs = {
  ref: "FLVS-6X3HR12B",
  items: [{ id: "flvs-kino", qty: 1, name: "flvs kino", choices: { Size: "XS", Colour: "Jouvert" }, unitPrice: 600 }],
  contact: { name: "Test Buyer", phone: "8685550100", city: "Arima", email: "x@example.com" },
  method: "pickup",
  area: "",
  payment: "cash",
  payment_status: "awaiting_proof",
  fulfilment_status: "new",
  delivery_fee: 0,
  created_at: "2026-09-25T16:51:25.334Z",
};

test("a FLVS order maps into bran's terms: TT$ to cents, cash to cash on delivery", () => {
  const order = mapFlvsOrder(flvs);
  assert.equal(order.payment, "cod");
  assert.equal(order.status, "new");
  assert.equal(order.delivery, "pickup");
  assert.equal(order.area, "Arima");
  assert.equal(order.customerName, "Test Buyer");
  assert.deepEqual(order.lines, [
    { key: "flvs-kino|Colour=Jouvert|Size=XS", name: "flvs kino", choices: "XS · Jouvert", quantity: 1, unitPriceCents: 60000 },
  ]);
});

test("paid is paid; online and unpaid is unpaid; unknown fulfilment reads as new", () => {
  assert.equal(mapFlvsOrder({ ...flvs, payment_status: "paid" }).payment, "paid");
  assert.equal(mapFlvsOrder({ ...flvs, payment: "online" }).payment, "unpaid");
  assert.equal(mapFlvsOrder({ ...flvs, fulfilment_status: "on_hold" }).status, "new");
  assert.equal(mapFlvsOrder({ ...flvs, fulfilment_status: "delivered" }).status, "delivered");
});

test("malformed storefront items are skipped, not trusted", () => {
  const order = mapFlvsOrder({ ...flvs, items: [null, { id: "x", qty: -1 }, { qty: 2 }, "junk"], contact: null });
  assert.deepEqual(order.lines, []);
  assert.equal(order.customerName, "Storefront customer");
});

test("only storefront orders still waiting to go out take stock on import", () => {
  assert.deepEqual(
    (["new", "packed", "shipped", "delivered", "cancelled"] as const).map(importTakesStock),
    [true, true, false, false, false],
  );
});

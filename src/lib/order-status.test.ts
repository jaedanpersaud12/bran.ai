import { test } from "node:test";
import assert from "node:assert/strict";
import {
  awaitingPayment,
  canCancel,
  canMarkPaid,
  isOpen,
  nextStep,
  orderReference,
  queueOrder,
  saleSource,
  stepFrom,
} from "./order-status.ts";

test("fulfilment runs one way, new to delivered", () => {
  assert.equal(nextStep("new"), "packed");
  assert.equal(nextStep("packed"), "shipped");
  assert.equal(nextStep("shipped"), "delivered");
  assert.equal(nextStep("delivered"), null);
  assert.equal(nextStep("cancelled"), null);
});

test("each step starts from the status before it", () => {
  assert.equal(stepFrom("packed"), "new");
  assert.equal(stepFrom("shipped"), "packed");
  assert.equal(stepFrom("delivered"), "shipped");
});

test("an order can be cancelled until it's delivered", () => {
  assert.deepEqual(
    (["new", "packed", "shipped", "delivered", "cancelled"] as const).map(canCancel),
    [true, true, true, false, false],
  );
});

test("payment is separate: a delivered cash-on-delivery order can still be marked paid", () => {
  assert.equal(canMarkPaid("delivered", "cod"), true);
  assert.equal(canMarkPaid("new", "unpaid"), true);
  assert.equal(canMarkPaid("shipped", "paid"), false);
  assert.equal(canMarkPaid("cancelled", "unpaid"), false);
  assert.equal(awaitingPayment("delivered", "cod"), true);
  assert.equal(awaitingPayment("cancelled", "cod"), false);
});

test("open means not delivered and not cancelled", () => {
  assert.deepEqual(
    (["new", "packed", "shipped", "delivered", "cancelled"] as const).map(isOpen),
    [true, true, true, false, false],
  );
});

test("the queue puts open orders first, oldest first, then finished ones newest first", () => {
  const orders = [
    { ref: "done-old", status: "delivered" as const, placedAt: "2026-09-01" },
    { ref: "open-new", status: "new" as const, placedAt: "2026-09-20" },
    { ref: "done-new", status: "cancelled" as const, placedAt: "2026-09-19" },
    { ref: "open-old", status: "packed" as const, placedAt: "2026-09-10" },
  ];
  assert.deepEqual(
    [...orders].sort(queueOrder).map((o) => o.ref),
    ["open-old", "open-new", "done-new", "done-old"],
  );
});

test("DM channels count as DM sales", () => {
  assert.equal(saleSource("instagram"), "dm");
  assert.equal(saleSource("whatsapp"), "dm");
  assert.equal(saleSource("tiktok"), "dm");
  assert.equal(saleSource("storefront"), "storefront");
  assert.equal(saleSource("in_person"), "manual");
});

test("references are ORD- and four digits", () => {
  assert.equal(orderReference(4), "ORD-0004");
  assert.equal(orderReference(12345), "ORD-12345");
});

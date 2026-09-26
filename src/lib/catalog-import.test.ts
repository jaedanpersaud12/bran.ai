import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canImport,
  checkDraft,
  normaliseName,
  suggestSku,
  toDraftRows,
  type DraftRow,
  type ExistingCatalog,
  type ExtractedRow,
} from "./catalog-import.ts";

const item = (over: Partial<ExtractedRow> = {}): ExtractedRow => ({
  product: "Linen button shirt",
  variant: "White · M",
  sku: "IT-LS01-M",
  unitCost: "85.00",
  price: "240",
  minOrderQty: 12,
  onHand: null,
  ...over,
});

const supplier = { leadTimeDays: "21", supplierEmail: "orders@islandthread.tt" };
const empty: ExistingCatalog = { products: [], skus: [] };

function rows(items: ExtractedRow[], existing: ExistingCatalog = empty): DraftRow[] {
  return toDraftRows(items, existing.skus);
}

test("nulls become empty inputs, apart from on-hand 0 and minimum order 1", () => {
  const [row] = rows([item({ unitCost: null, price: null, minOrderQty: null, onHand: null })]);
  assert.equal(row.unitCost, "");
  assert.equal(row.price, "");
  assert.equal(row.onHand, "0");
  assert.equal(row.minOrderQty, "1");
  assert.equal(row.keep, true);
});

test("a missing SKU is suggested from the product and variant", () => {
  const [row] = rows([item({ product: "Crochet beach cover-up", variant: "Cream", sku: null })]);
  assert.equal(row.sku, "CROCHET-BEACH-CREAM");
  assert.equal(row.skuSuggested, true);
});

test("a suggested SKU steps round ones the workspace and the draft already use", () => {
  const taken = new Set(["LINEN-BUTTON-WHITE-M", "LINEN-BUTTON-WHITE-M-2"]);
  assert.equal(suggestSku("Linen button shirt", "White · M", taken), "LINEN-BUTTON-WHITE-M-3");

  const draft = rows(
    [item({ sku: null }), item({ sku: null })],
    { products: [], skus: ["linen-button-white-m"] },
  );
  assert.deepEqual(draft.map((r) => r.sku), ["LINEN-BUTTON-WHITE-M-2", "LINEN-BUTTON-WHITE-M-3"]);
});

test("a suggested SKU is never longer than 40 characters", () => {
  const long = "Extraordinarily elaborate hand-embroidered ceremonial kaftan";
  const sku = suggestSku(long, "Midnight blue with gold thread · XXL", new Set());
  assert.ok(sku.length <= 40, sku);
  assert.match(sku, /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/);
});

test("one supplier code for several variants gets the variant appended", () => {
  const draft = rows([
    item({ sku: "IT-LS01", variant: "White · S" }),
    item({ sku: "IT-LS01", variant: "White · M" }),
    item({ sku: "IT-DR07", variant: "Hibiscus red" }),
  ]);
  assert.deepEqual(draft.map((r) => r.sku), ["IT-LS01-S", "IT-LS01-M", "IT-DR07"]);
  assert.deepEqual(draft.map((r) => r.skuSuggested), [true, true, false]);
});

test("the appended part is what differs, not what the variants share", () => {
  const draft = rows([
    item({ sku: "IT-DR07", variant: "Hibiscus red · One size" }),
    item({ sku: "IT-DR07", variant: "Sea blue · One size" }),
  ]);
  assert.deepEqual(draft.map((r) => r.sku), ["IT-DR07-HIBISCUS-RED", "IT-DR07-SEA-BLUE"]);
});

test("names match ignoring case and extra spaces", () => {
  assert.equal(normaliseName("  Linen   Button shirt "), normaliseName("linen button SHIRT"));
});

test("a row naming an existing product joins it", () => {
  const existing = { products: [{ id: "p1", name: "Linen Button Shirt" }], skus: [] };
  const draft = rows([item()], existing);
  const check = checkDraft(draft, supplier, existing);
  assert.deepEqual(check.rows.get("r0")?.joins, { id: "p1", name: "Linen Button Shirt" });
  assert.equal(canImport(check), true);
});

test("02's rules apply to every kept row, with 02's messages", () => {
  const draft = rows([item({ price: null, unitCost: "-4", product: "" })]);
  const errors = checkDraft(draft, supplier, empty).rows.get("r0")?.errors ?? {};
  assert.equal(errors.price, "Enter a price in TT$, like 240 or 239.99.");
  assert.equal(errors.unitCost, "Enter a cost in TT$, like 68 or 68.50.");
  assert.equal(errors.product, "Give the product a name.");
});

test("a SKU the workspace has, archived or not, blocks the row", () => {
  const existing = { products: [], skus: ["it-ls01-m"] };
  const draft: DraftRow[] = [{ ...rows([item()])[0], sku: "IT-LS01-M" }];
  const check = checkDraft(draft, supplier, existing);
  assert.equal(check.rows.get("r0")?.errors.sku, "Your catalog already has this SKU.");
  assert.equal(canImport(check), false);
});

test("a SKU repeated in the draft blocks both rows, until one is discarded", () => {
  const draft = rows([item(), item({ variant: "White · L" })]).map((r) => ({ ...r, sku: "DUP-1" }));
  const check = checkDraft(draft, supplier, empty);
  assert.equal(check.rows.get("r0")?.errors.sku, "Another row here uses this SKU.");
  assert.equal(check.rows.get("r1")?.errors.sku, "Another row here uses this SKU.");

  draft[1] = { ...draft[1], keep: false };
  const after = checkDraft(draft, supplier, empty);
  assert.equal(after.rows.has("r1"), false);
  assert.equal(canImport(after), true);
});

test("supplier fields are checked only when a new product needs them", () => {
  const bad = { leadTimeDays: "0", supplierEmail: "not-an-email" };
  const newProduct = checkDraft(rows([item()]), bad, empty);
  assert.ok(newProduct.supplier.leadTimeDays);
  assert.ok(newProduct.supplier.supplierEmail);
  assert.equal(canImport(newProduct), false);

  const existing = { products: [{ id: "p1", name: "Linen button shirt" }], skus: [] };
  const joining = checkDraft(rows([item()], existing), bad, existing);
  assert.deepEqual(joining.supplier, {});
  assert.equal(canImport(joining), true);
});

test("nothing kept means nothing to import", () => {
  const draft = rows([item()]).map((r) => ({ ...r, keep: false }));
  assert.equal(canImport(checkDraft(draft, supplier, empty)), false);
});

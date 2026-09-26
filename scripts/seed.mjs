/**
 * Seeds the demo workspace.
 *
 *   pnpm db:seed
 *
 * Creates "FLVS Swim" (slug `flvs-swim`) with a small swimwear catalogue,
 * ninety days of sales and one purchase order already sent to the supplier.
 * Running it again deletes that one workspace and builds it fresh — it never
 * touches another workspace, and never writes to `public`.
 *
 * The sales are generated, but from a fixed seed, so every run produces the
 * same history and the same verdicts. The lines are shaped to exercise every
 * branch of the restock formula: out of stock, short, rising, falling, on
 * order, overstocked and dead.
 *
 * Set SEED_OWNER_EMAIL to the FLVS account that should own the workspace. If
 * it's unset or not found, the workspace has no members, and is only visible
 * in development through DEMO_WORKSPACE_SLUG.
 */
import pg from "pg";

const SLUG = "flvs-swim";
const DAYS = 90;
const DAY = 86_400_000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with `pnpm db:seed`, which loads .env.local.");
  process.exit(1);
}

/**
 * rate: units a day before the last week. lastWeek: multiplier on the last
 * seven days, for a trend. outFor: days it has been out of stock (no sales).
 */
const CATALOGUE = [
  {
    name: "Tobago triangle top",
    leadTimeDays: 21,
    supplierEmail: "orders@portofspainsewing.tt",
    variants: [
      { sku: "FLV-TRI-BLK-S", label: "Black · S", onHand: 5, cost: 68, price: 240, rate: 1.6 },
      { sku: "FLV-TRI-BLK-M", label: "Black · M", onHand: 0, cost: 68, price: 240, rate: 1.9, outFor: 3 },
      { sku: "FLV-TRI-BLK-L", label: "Black · L", onHand: 30, cost: 68, price: 240, rate: 0.9 },
      { sku: "FLV-TRI-WHT-L", label: "Coconut · L", onHand: 52, cost: 68, price: 240, rate: 0.6 },
    ],
  },
  {
    name: "Maracas bandeau",
    leadTimeDays: 21,
    supplierEmail: "orders@portofspainsewing.tt",
    variants: [
      { sku: "FLV-BND-RED-M", label: "Flame · M", onHand: 12, cost: 74, price: 260, rate: 1.1, lastWeek: 1.6 },
      { sku: "FLV-BND-RED-S", label: "Flame · S", onHand: 19, cost: 74, price: 260, rate: 0.7 },
    ],
  },
  {
    name: "Store Bay high-waist",
    leadTimeDays: 28,
    supplierEmail: null,
    variants: [
      { sku: "FLV-HIP-SND-L", label: "Sand · L", onHand: 40, cost: 82, price: 280, rate: 0.8 },
      { sku: "FLV-HIP-SND-M", label: "Sand · M", onHand: 32, cost: 82, price: 280, rate: 1.0, lastWeek: 0.4 },
    ],
  },
  {
    name: "Pigeon Point one-piece",
    leadTimeDays: 35,
    supplierEmail: "hello@medellinswim.co",
    variants: [
      { sku: "FLV-ONE-NVY-S", label: "Navy · S", onHand: 18, cost: 96, price: 380, rate: 1.0, minOrder: 12 },
      { sku: "FLV-ONE-NVY-M", label: "Navy · M", onHand: 45, cost: 96, price: 380, rate: 0.8, minOrder: 12 },
    ],
  },
  {
    name: "Buccoo wrap skirt",
    leadTimeDays: 14,
    supplierEmail: "orders@portofspainsewing.tt",
    variants: [
      { sku: "FLV-WRP-GRN-U", label: "Palm · One size", onHand: 6, cost: 76, price: 220, rate: 1.4 },
    ],
  },
  {
    name: "Las Cuevas rash guard",
    leadTimeDays: 21,
    supplierEmail: null,
    variants: [
      { sku: "FLV-RSH-BLU-M", label: "Ocean · M", onHand: 15, cost: 90, price: 300, rate: 0 },
    ],
  },
];

/** Already sent to the supplier and not yet received: 80 of the Coconut L. */
const SENT_ORDER = { sku: "FLV-TRI-WHT-L", quantity: 80, daysAgo: 9 };

/** mulberry32 — small, fast, and the same numbers every run. */
function random(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Units sold on one day: the rate, give or take, never negative. */
function unitsFor(rate, next) {
  if (rate === 0) return 0;
  const wobble = 0.6 + next() * 0.8;
  const expected = rate * wobble;
  const whole = Math.floor(expected);
  return whole + (next() < expected - whole ? 1 : 0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin");

  // Purchase-order lines restrict variant deletes, so clear orders first.
  await client.query(
    `delete from bran.purchase_orders
      where workspace_id in (select id from bran.workspaces where slug = $1)`,
    [SLUG],
  );
  await client.query(`delete from bran.workspaces where slug = $1`, [SLUG]);

  const {
    rows: [workspace],
  } = await client.query(
    `insert into bran.workspaces (slug, name) values ($1, 'FLVS Swim') returning id`,
    [SLUG],
  );

  let owner = null;
  if (process.env.SEED_OWNER_EMAIL) {
    const { rows } = await client.query(`select id from public."user" where lower(email) = lower($1)`, [
      process.env.SEED_OWNER_EMAIL,
    ]);
    owner = rows[0]?.id ?? null;
    if (owner) {
      await client.query(
        `insert into bran.workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')`,
        [workspace.id, owner],
      );
    } else {
      console.warn(`No FLVS account for SEED_OWNER_EMAIL; the workspace has no members.`);
    }
  }

  const next = random(20260926);
  const now = Date.now();
  const variantIds = new Map();
  const sales = { variant: [], quantity: [], soldAt: [] };

  for (const product of CATALOGUE) {
    const {
      rows: [row],
    } = await client.query(
      `insert into bran.products (workspace_id, name, lead_time_days, supplier_email)
       values ($1, $2, $3, $4) returning id`,
      [workspace.id, product.name, product.leadTimeDays, product.supplierEmail],
    );

    for (const variant of product.variants) {
      const {
        rows: [inserted],
      } = await client.query(
        `insert into bran.variants
           (workspace_id, product_id, sku, label, on_hand, unit_cost_cents, price_cents, min_order_qty)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [
          workspace.id,
          row.id,
          variant.sku,
          variant.label,
          variant.onHand,
          variant.cost * 100,
          variant.price * 100,
          variant.minOrder ?? 5,
        ],
      );
      variantIds.set(variant.sku, inserted.id);

      for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
        if (variant.outFor && daysAgo <= variant.outFor) continue;
        const rate = daysAgo <= 7 ? variant.rate * (variant.lastWeek ?? 1) : variant.rate;
        const units = unitsFor(rate, next);
        // One sale row per unit or pair, spread through the day.
        let left = units;
        while (left > 0) {
          const quantity = left > 1 && next() < 0.3 ? 2 : 1;
          left -= quantity;
          sales.variant.push(inserted.id);
          sales.quantity.push(quantity);
          sales.soldAt.push(new Date(now - daysAgo * DAY + next() * DAY * 0.9));
        }
      }
    }
  }

  await client.query(
    `insert into bran.sales (workspace_id, variant_id, quantity, sold_at, source)
     select $1, v, q, s, 'seed'
       from unnest($2::uuid[], $3::int[], $4::timestamptz[]) as t(v, q, s)`,
    [workspace.id, sales.variant, sales.quantity, sales.soldAt],
  );

  const sentAt = new Date(now - SENT_ORDER.daysAgo * DAY);
  const {
    rows: [order],
  } = await client.query(
    `insert into bran.purchase_orders (workspace_id, number, status, created_by, created_at, sent_at)
     values ($1, 1, 'sent', $2, $3, $3) returning id`,
    [workspace.id, owner, sentAt],
  );
  await client.query(
    `insert into bran.purchase_order_lines
       (purchase_order_id, variant_id, quantity, suggested_quantity, unit_cost_cents)
     values ($1, $2, $3, 0, 6800)`,
    [order.id, variantIds.get(SENT_ORDER.sku), SENT_ORDER.quantity],
  );

  await client.query("commit");
  console.log(
    `Seeded ${SLUG}: ${variantIds.size} variants, ${sales.quantity.length} sales, 1 sent PO` +
      (owner ? `, owned by ${process.env.SEED_OWNER_EMAIL}.` : "."),
  );
} catch (error) {
  await client.query("rollback");
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

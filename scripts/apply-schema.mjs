/**
 * Applies `db/schema.sql` to DATABASE_URL.
 *
 *   pnpm db:setup
 *
 * The file is idempotent, so running this against a database that already has
 * the `bran` schema is a no-op. It touches nothing in `public` — see the note
 * at the top of the SQL.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "db", "schema.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with `pnpm db:setup`, which loads .env.local.");
  process.exit(1);
}

const sql = await readFile(schemaPath, "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  // One transaction: a half-applied schema is worse than none, because the
  // next run would find `bran.workspaces` present and skip the rest.
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Applied db/schema.sql — the `bran` schema is ready.");
} catch (error) {
  await client.query("rollback");
  console.error("Failed to apply schema:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

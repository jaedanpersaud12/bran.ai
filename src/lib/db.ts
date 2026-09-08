import { neon } from "@neondatabase/serverless";

/**
 * The database handle.
 *
 * One Neon database, shared with the FLVS storefront. Everything bran owns
 * lives in the `bran` schema and every query below names it — see the note in
 * `db/schema.sql` for why a `search_path` would not have held.
 */
const connectionString = process.env.DATABASE_URL;

export const databaseConfigured = Boolean(connectionString);

const sql = connectionString ? neon(connectionString) : null;

export type Workspace = {
  id: string;
  slug: string;
  name: string;
};

/**
 * The workspaces an account can open, in the order they should be offered.
 *
 * Returns nothing rather than throwing when the database is unreachable or the
 * schema has not been installed yet. A dashboard that renders with a fallback
 * workspace name is a better first run than a stack trace, and `db:setup` is
 * one command away.
 */
export async function workspacesForUser(userId: string): Promise<Workspace[]> {
  if (!sql) return [];
  try {
    const rows = await sql`
      select w.id, w.slug, w.name
        from bran.workspaces w
        join bran.workspace_members m on m.workspace_id = w.id
       where m.user_id = ${userId}
       order by w.name
    `;
    return rows as Workspace[];
  } catch {
    return [];
  }
}

/** Whether `db/schema.sql` has been applied to this database. */
export async function schemaInstalled(): Promise<boolean> {
  if (!sql) return false;
  try {
    const rows = await sql`
      select 1
        from information_schema.tables
       where table_schema = 'bran' and table_name = 'workspaces'
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export { sql };

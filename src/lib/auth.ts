// Marks the module server-only so a client component importing it fails at
// build time rather than dragging the Postgres driver into the browser bundle.
import "server-only";

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

/**
 * Better Auth, pointed at the FLVS storefront's tables.
 *
 * This is the deliberate overlap between the two products: same database, same
 * `user` / `session` / `account` / `verification` tables, same signing secret,
 * so one FLVS account opens both and neither has its own sign-up to keep in
 * sync. On localhost that works out of the box — cookies ignore the port, so a
 * session from :3000 is presented to :3001 and validates against the same row.
 *
 * What bran does NOT do here is own the account lifecycle. No welcome email,
 * no role granting, no verification flow: the storefront runs those, and
 * duplicating them would mean two apps racing to send the same message.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SECRET = process.env.BETTER_AUTH_SECRET;

/**
 * Sessions need both a database and a signing secret. Without the secret there
 * is no safe fallback, so the app treats auth as switched off and renders
 * signed-out rather than inventing one.
 */
export const authConfigured = Boolean(DATABASE_URL && SECRET);

// Reused across invocations; a pool per request would exhaust Neon's
// connection limit under any real traffic. `max` is low because the storefront
// is drawing on the same database from its own pool.
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 5 }) : undefined;

const BASE_URL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

/**
 * Every origin a sign-in can legitimately arrive from. Better Auth rejects a
 * request whose Origin does not match, and `baseURL` holds only one value, so
 * anything else — a preview deploy, the apex/www sibling — has to be listed.
 */
function trustedOrigins(): string[] {
  const origins = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value) return;
    const url = value.startsWith("http") ? value : `https://${value}`;
    try {
      const { protocol, host } = new URL(url);
      origins.add(`${protocol}//${host}`);
      if (host.startsWith("www.")) origins.add(`${protocol}//${host.slice(4)}`);
      else origins.add(`${protocol}//www.${host}`);
    } catch {
      // A malformed value is skipped rather than crashing auth at boot.
    }
  };

  add(BASE_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  // Injected by Vercel: the production domain, this deployment, the branch.
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);

  return [...origins];
}

export const auth = betterAuth({
  database: pool,
  secret: SECRET,
  baseURL: BASE_URL,
  trustedOrigins: trustedOrigins(),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Must match the storefront, or a session issued there expires on a
  // different clock than the one that reads it here.
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh at most daily
  },
  // Must be last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});

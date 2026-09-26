import "server-only";

import { cache } from "react";
import { sql, workspacesForUser, type Workspace } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/session";

export type CurrentWorkspace = {
  workspace: Workspace;
  /** Null only for the development demo fallback. */
  user: SessionUser | null;
};

/**
 * The workspace this request acts on, or null.
 *
 * Every page and action resolves it here, on the server, and never takes a
 * workspace id from the client — the id in a form is a claim, the session is
 * a fact.
 *
 * Signed in, it is the first workspace the account belongs to. Signed out, in
 * development only, it is the one named by DEMO_WORKSPACE_SLUG, so the screens
 * can be worked on without a session from the storefront. Production never
 * falls back: signed out there means no data.
 *
 * Cached per request, so the layout and the page share one lookup.
 */
export const currentWorkspace = cache(async (): Promise<CurrentWorkspace | null> => {
  const user = await getSessionUser();
  if (user) {
    const [workspace] = await workspacesForUser(user.id);
    return workspace ? { workspace, user } : null;
  }

  const demo = process.env.DEMO_WORKSPACE_SLUG;
  if (process.env.NODE_ENV !== "development" || !demo || !sql) return null;
  try {
    const rows = await sql`
      select id, slug, name from bran.workspaces where slug = ${demo}
    `;
    const workspace = rows[0] as Workspace | undefined;
    return workspace ? { workspace, user: null } : null;
  } catch {
    return null;
  }
});

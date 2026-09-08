import { AppShell } from "@/components/bran/AppShell";
import { getSessionUser } from "@/lib/session";
import { workspacesForUser } from "@/lib/db";

/**
 * Resolves who is looking and which workspace they are in, then hands both to
 * the chrome.
 *
 * Signed out is a rendered state, not a redirect. bran does not own the
 * account lifecycle — the storefront does — so there is nowhere here to send
 * someone, and a dashboard that draws with a placeholder workspace is a better
 * failure than a loop between two apps.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const workspaces = user ? await workspacesForUser(user.id) : [];
  const workspace = workspaces[0]?.name ?? "FLVS Swim";

  return <AppShell workspace={workspace}>{children}</AppShell>;
}

import { AppShell } from "@/components/bran/AppShell";
import { currentWorkspace } from "@/lib/workspace";

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
  const current = await currentWorkspace();
  const workspace = current?.workspace.name ?? "FLVS Swim";

  return <AppShell workspace={workspace}>{children}</AppShell>;
}

"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/bran/AppSidebar";
import { sectionFor } from "@/components/bran/nav";

/**
 * The chrome every screen sits in: navigation on the left, the work on a
 * raised panel to the right.
 *
 * It is also where the page learns what colour it is in. The section's own
 * colour goes on the wrapper as `--section`, and `globals.css` mixes the
 * neutrals underneath it from there — the ground, the hairlines, the muted
 * fills, the focus rings. Doing it here rather than per page means a screen
 * written next week is already in the right colour without knowing this
 * exists.
 */
export function AppShell({
  workspace,
  children,
}: {
  workspace: string;
  children: React.ReactNode;
}) {
  const section = sectionFor(usePathname());

  return (
    <TooltipProvider>
      <SidebarProvider
        data-section={section?.key}
        style={section ? ({ "--section": section.tint } as React.CSSProperties) : undefined}
      >
        <AppSidebar workspace={workspace} />
        {/* Depth as layered transparency instead of a border, so the panel
            keeps the same weight against the sidebar's off-white ground. The
            corner is a touch softer than the shadcn default, to match the
            radius the cards inside it are cut to. */}
        <SidebarInset className="md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-border">
          {/* The only reason for a header row: on a phone the sidebar is a
              sheet, and something has to open it. On desktop the navigation is
              already on screen, so this would just be an empty band. */}
          <header className="flex h-12 items-center px-3 md:hidden">
            <SidebarTrigger />
          </header>

          <main className="px-4 pb-10 md:px-6 md:pt-6 lg:px-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

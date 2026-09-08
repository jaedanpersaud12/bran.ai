"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ChevronsUpDownIcon } from "@/components/icons/chevrons-up-down";
import { Assistant } from "@/components/bran/Assistant";
import type { AnimatedIconHandle } from "@/components/icons/types";
import { GROW, MANAGE, PLATFORM, SUPPORT, sectionFor, type NavItem } from "@/components/bran/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ workspace }: { workspace: string }) {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const switcher = useRef<AnimatedIconHandle>(null);

  return (
    <Sidebar variant="inset" className="border-none">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 rounded-md px-1 py-1 transition-[background-color] duration-150 hover:bg-sidebar-accent"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-flvs-red">
            <Image
              src="/logo-main-trimmed.png"
              alt=""
              width={1142}
              height={541}
              className="w-4 invert"
            />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">bran</span>
        </Link>

        {/*
         * The tenant switcher. bran is sold to more than one brand owner, and
         * some of them run more than one label, so which workspace you are
         * looking at is a permanent, top-of-screen fact rather than something
         * buried in settings.
         */}
        <button
          type="button"
          onMouseEnter={() => switcher.current?.startAnimation()}
          onMouseLeave={() => switcher.current?.stopAnimation()}
          className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-background p-2 text-left transition-[background-color,scale] duration-150 hover:bg-sidebar-accent active:scale-[0.96] group-data-[collapsible=icon]:hidden"
        >
          <span
            aria-hidden
            className="size-7 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,#8ee39a,#2f8fd6_55%,#1b3f8f)]"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{workspace}</span>
          <ChevronsUpDownIcon
            ref={switcher}
            size={14}
            className="shrink-0 text-muted-foreground"
          />
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {/* Grouped by when you open them: the day's work, the work that grows
            the brand, and the settings you touch once a month. */}
        {[
          { label: "Operate", items: PLATFORM },
          { label: "Grow", items: GROW },
          { label: "Manage", items: MANAGE },
        ].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-[11px] font-medium text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} active={item.key === current?.key} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-3 px-3 pb-4">
        {/* Above the update card, because it is a tool and that is an
            announcement — and the two should not read as the same thing. */}
        <Assistant />

        <section className="rounded-xl border border-sidebar-border bg-background p-3 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Update
          </p>
          <p className="mt-1.5 text-[13px] font-semibold">What&apos;s new</p>
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            Latest fixes and new features.
          </p>
          <Link
            href="/changelog"
            className="mt-2.5 inline-block text-[12px] font-medium underline decoration-border underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-foreground"
          >
            Learn more
          </Link>
        </section>

        <SidebarMenu className="gap-0.5">
          {SUPPORT.map((item) => (
            <NavRow key={item.href} item={item} active={item.key === current?.key} muted />
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * One row of the nav, in its destination's colour.
 *
 * The row does not paint its own background. It re-points the two sidebar
 * tokens the menu button already reaches for, so the hover and active states
 * shadcn ships come out in this row's hue with no override to fight — and if
 * those states ever change, this follows them.
 *
 * The ref is the other half: an icon left to itself animates when the pointer
 * is over the glyph, which is 16px inside a 200px row. Owning the handle moves
 * the trigger out to the whole row, and leaving plays it back to rest, so a
 * pointer sweeping down the nav leaves it as it found it.
 */
function NavRow({
  item,
  active = false,
  muted = false,
}: {
  item: NavItem;
  active?: boolean;
  muted?: boolean;
}) {
  const icon = useRef<AnimatedIconHandle>(null);

  return (
    <SidebarMenuItem
      style={
        {
          "--row": item.tint,
          "--sidebar-accent": "color-mix(in oklab, var(--row) 12%, var(--sidebar-neutral))",
          "--sidebar-accent-foreground": "color-mix(in oklab, var(--row) 42%, var(--foreground))",
        } as React.CSSProperties
      }
    >
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={`h-9 gap-3 rounded-lg px-3 text-[13.5px] font-medium ${
          muted ? "text-muted-foreground" : "data-[active=true]:font-semibold"
        }`}
      >
        <Link
          href={item.href}
          onMouseEnter={() => icon.current?.startAnimation()}
          onMouseLeave={() => icon.current?.stopAnimation()}
        >
          {/* An icon carries the optical weight of the text beside it: 2px
              against the active item's semibold, 1.5px against the rest. */}
          <item.icon
            ref={icon}
            size={16}
            strokeWidth={active ? 2 : 1.5}
            className="shrink-0 text-[var(--row)]"
          />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

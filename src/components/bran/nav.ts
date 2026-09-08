import { BlocksIcon } from "@/components/icons/blocks";
import { CreditCardIcon } from "@/components/icons/credit-card";
import { PackageIcon } from "@/components/icons/package";
import { StoreIcon } from "@/components/icons/store";
import { TruckIcon } from "@/components/icons/truck";
import { BookTextIcon } from "@/components/icons/book-text";
import { CalendarDaysIcon } from "@/components/icons/calendar-days";
import { ChartNoAxesColumnIncreasingIcon } from "@/components/icons/chart-no-axes-column-increasing";
import { CircleHelpIcon } from "@/components/icons/circle-help";
import { LayoutGridIcon } from "@/components/icons/layout-grid";
import { RocketIcon } from "@/components/icons/rocket";
import { UsersIcon } from "@/components/icons/users";
import type { AnimatedIcon } from "@/components/icons/types";

/**
 * The nav, as data.
 *
 * It lives outside the sidebar because two components need it now: the
 * sidebar draws it, and the shell reads the current entry to decide what
 * colour the whole page is in. Keeping one list means a section can never be
 * lit one colour in the nav and another everywhere else.
 */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: AnimatedIcon;
  /** The destination's colour, as declared in `globals.css`. */
  tint: string;
};

/**
 * Three groups, because eleven flat rows is a list you read rather than a
 * nav you use. They split by when you open them: the day's work, the work
 * that grows the brand, and the settings you touch once a month.
 */
export const PLATFORM: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: LayoutGridIcon,
    tint: "var(--nav-dashboard)",
  },
  {
    key: "inventory",
    label: "Inventory",
    href: "/inventory",
    icon: PackageIcon,
    tint: "var(--nav-inventory)",
  },
  { key: "orders", label: "Orders", href: "/orders", icon: TruckIcon, tint: "var(--nav-orders)" },
  {
    key: "storefronts",
    label: "Storefronts",
    href: "/storefronts",
    icon: StoreIcon,
    tint: "var(--nav-storefronts)",
  },
];

export const GROW: NavItem[] = [
  {
    key: "calendar",
    label: "Content Calendar",
    href: "/content-calendar",
    icon: CalendarDaysIcon,
    tint: "var(--nav-calendar)",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    href: "/campaigns",
    icon: RocketIcon,
    tint: "var(--nav-campaigns)",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: ChartNoAxesColumnIncreasingIcon,
    tint: "var(--nav-analytics)",
  },
];

export const MANAGE: NavItem[] = [
  { key: "team", label: "Team", href: "/team", icon: UsersIcon, tint: "var(--nav-team)" },
  {
    key: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: BlocksIcon,
    tint: "var(--nav-integrations)",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/billing",
    icon: CreditCardIcon,
    tint: "var(--nav-billing)",
  },
];

export const SUPPORT: NavItem[] = [
  {
    key: "help",
    label: "Help Center",
    href: "/help",
    icon: CircleHelpIcon,
    tint: "var(--nav-help)",
  },
  {
    key: "docs",
    label: "Documentation",
    href: "/docs",
    icon: BookTextIcon,
    tint: "var(--nav-docs)",
  },
];

/**
 * Which entry a path belongs to.
 *
 * "/" is a prefix of every other section, so the dashboard has to match
 * exactly and the rest match by prefix. A path with no entry — /changelog,
 * say — returns nothing, and the page stays in the neutral palette rather
 * than borrowing a colour that means somewhere else.
 */
export function sectionFor(pathname: string): NavItem | undefined {
  return [...PLATFORM, ...GROW, ...MANAGE, ...SUPPORT].find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}

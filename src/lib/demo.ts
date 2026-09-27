/**
 * The demo's data.
 *
 * Every row below is invented. It is here so the screens can be walked
 * end to end before any of the six systems in the concept exist — restock
 * intelligence, the assistant, scheduling, dispatch, the multi-brand
 * storefront and the subscription tiers each get a screen, and each screen
 * reads from this file.
 *
 * Shaped the way the real queries will return it, so wiring a section up is a
 * change here and at one call site rather than a rewrite of the page. It is
 * one workspace's worth: FLVS Swim, a Trinidad swimwear label, which is the
 * brand the product was designed against.
 */

import { formatMoney, formatMoneyWhole, type Delta } from "@/lib/metrics";

export { formatMoney, formatMoneyWhole };
export type { Delta };

/* -------------------------------------------------------------- Storefronts */

export type Storefront = {
  name: string;
  handle: string;
  /** DM-Commerce: the storefront is the brand's own, hosted by bran. */
  domain: string;
  status: "live" | "draft" | "paused";
  products: number;
  orders30: number;
  revenue30: number;
  /** Share of that brand's orders that started in a DM rather than on site. */
  fromDm: number;
};

export const STOREFRONTS: Storefront[] = [
  { name: "FLVS Swim", handle: "@flvs", domain: "shop.flvs.life", status: "live", products: 34, orders30: 1_842, revenue30: 284_920, fromDm: 0.61 },
  { name: "FLVS Resort", handle: "@flvsresort", domain: "resort.flvs.life", status: "live", products: 12, orders30: 318, revenue30: 61_400, fromDm: 0.44 },
  { name: "Buccoo Basics", handle: "@buccoobasics", domain: "buccoobasics.bran.shop", status: "draft", products: 8, orders30: 0, revenue30: 0, fromDm: 0 },
];

/* ---------------------------------------------------------------- Calendar */

export type PostState = "scheduled" | "drafted" | "published" | "needs approval";

export type ScheduledPost = {
  id: string;
  channel: "Instagram" | "TikTok" | "Facebook";
  kind: "Reel" | "Carousel" | "Story" | "Post";
  caption: string;
  /** Day of the week it goes out, and the local time. */
  day: string;
  time: string;
  state: PostState;
  /** The piece it is selling, when it is selling one. */
  product: string | null;
};

export const POSTS: ScheduledPost[] = [
  { id: "p1", channel: "Instagram", kind: "Reel", caption: "Maracas at 6am — the bandeau in flame", day: "Mon", time: "07:30", state: "scheduled", product: "Maracas bandeau" },
  { id: "p2", channel: "TikTok", kind: "Reel", caption: "3 ways to tie the Buccoo wrap", day: "Mon", time: "18:00", state: "scheduled", product: "Buccoo wrap skirt" },
  { id: "p3", channel: "Instagram", kind: "Carousel", caption: "Restock: Tobago triangle, all sizes", day: "Tue", time: "12:00", state: "needs approval", product: "Tobago triangle top" },
  { id: "p4", channel: "Instagram", kind: "Story", caption: "Behind the Store Bay shoot", day: "Wed", time: "09:00", state: "drafted", product: null },
  { id: "p5", channel: "Facebook", kind: "Post", caption: "Carnival drop — the full line-up", day: "Thu", time: "11:00", state: "scheduled", product: null },
  { id: "p6", channel: "TikTok", kind: "Reel", caption: "Packing your order, start to finish", day: "Fri", time: "17:30", state: "drafted", product: null },
  { id: "p7", channel: "Instagram", kind: "Reel", caption: "Pigeon Point, golden hour", day: "Sat", time: "16:00", state: "published", product: "Pigeon Point one-piece" },
];

export const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* --------------------------------------------------------------- Campaigns */

export type Campaign = {
  name: string;
  channel: string;
  status: "running" | "scheduled" | "finished";
  window: string;
  spend: number;
  revenue: number;
  orders: number;
};

export const CAMPAIGNS: Campaign[] = [
  { name: "Carnival drop", channel: "Instagram · TikTok", status: "running", window: "Aug 24 – Sep 14", spend: 8_400, revenue: 71_200, orders: 412 },
  { name: "Restock: triangle top", channel: "Instagram", status: "running", window: "Sep 1 – Sep 12", spend: 2_100, revenue: 18_900, orders: 108 },
  { name: "Tobago weekender", channel: "TikTok", status: "scheduled", window: "Sep 15 – Sep 30", spend: 0, revenue: 0, orders: 0 },
  { name: "Mid-year clearance", channel: "Email · Instagram", status: "finished", window: "Jun 1 – Jun 21", spend: 5_600, revenue: 42_300, orders: 297 },
];

/* -------------------------------------------------------------------- Team */

export type Member = {
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Fulfilment" | "Content";
  /** What they were last seen doing, so the row says something. */
  lastSeen: string;
  initials: string;
};

export const TEAM: Member[] = [
  { name: "Jaedan Persaud", email: "jaedan@flvs.life", role: "Owner", lastSeen: "Online now", initials: "JP" },
  { name: "Aria Boodram", email: "aria@flvs.life", role: "Manager", lastSeen: "20 min ago", initials: "AB" },
  { name: "Marlon Peters", email: "marlon@flvs.life", role: "Fulfilment", lastSeen: "Packing BRN-4820", initials: "MP" },
  { name: "Shanice Lewis", email: "shanice@flvs.life", role: "Content", lastSeen: "2 h ago", initials: "SL" },
];

export const ROLE_RIGHTS: Record<Member["role"], string> = {
  Owner: "Everything, including billing and closing the account",
  Manager: "Everything except billing",
  Fulfilment: "Orders and inventory only",
  Content: "Calendar and campaigns only",
};

/* ------------------------------------------------------------ Integrations */

export type Integration = {
  name: string;
  category: "Courier" | "Payments" | "Channel" | "Messaging";
  blurb: string;
  connected: boolean;
  /** What it has actually done lately, when it is connected. */
  activity: string | null;
};

export const INTEGRATIONS: Integration[] = [
  { name: "Zoom TT", category: "Courier", blurb: "Same-day dispatch across Trinidad", connected: true, activity: "9 pickups this week" },
  { name: "Moving Solutions", category: "Courier", blurb: "Inter-island to Tobago", connected: true, activity: "2 pickups this week" },
  { name: "bran Delivery", category: "Courier", blurb: "Our own fleet. Rolling out in Port of Spain first", connected: false, activity: null },
  { name: "WiPay", category: "Payments", blurb: "Cards and bank transfer, TTD settlement", connected: true, activity: "TT$284,920 settled in 30 days" },
  { name: "Wam", category: "Payments", blurb: "Wallet checkout", connected: false, activity: null },
  { name: "Instagram", category: "Channel", blurb: "Publish posts and read DMs into the assistant", connected: true, activity: "1,118 DMs read this month" },
  { name: "TikTok", category: "Channel", blurb: "Publish and track reels", connected: true, activity: "31 posts published" },
  { name: "WhatsApp Business", category: "Messaging", blurb: "Orders and replies in one thread", connected: true, activity: "412 conversations" },
];

/* ----------------------------------------------------------------- Billing */

export type Plan = {
  name: string;
  price: number;
  blurb: string;
  includes: string[];
  current: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Starter",
    price: 250,
    blurb: "One storefront, the assistant reading your DMs.",
    includes: ["1 storefront", "Up to 200 orders a month", "Assistant on DMs", "Restock alerts"],
    current: false,
  },
  {
    name: "Studio",
    price: 750,
    blurb: "The whole back office for one brand.",
    includes: [
      "2 storefronts",
      "Unlimited orders",
      "Restock intelligence with reorder drafts",
      "Scheduling across Instagram, TikTok and Facebook",
      "Courier dispatch",
    ],
    current: true,
  },
  {
    name: "House",
    price: 1_800,
    blurb: "For an owner running more than one label.",
    includes: [
      "Unlimited storefronts",
      "Everything in Studio, per brand",
      "Shared inventory across labels",
      "Priority courier slots",
      "Assistant trained on your own conversations",
    ],
    current: false,
  },
];

export const USAGE = {
  ordersThisCycle: 1_842,
  ordersIncluded: null as number | null,
  storefrontsUsed: 2,
  storefrontsIncluded: 2,
  renewsOn: "October 1, 2026",
};


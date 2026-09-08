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

/* ---------------------------------------------------------------- Inventory */

export type StockState = "healthy" | "low" | "out" | "incoming";

export type StockItem = {
  sku: string;
  name: string;
  variant: string;
  onHand: number;
  /** What the restock model thinks the next fourteen days will take. */
  forecast14: number;
  /** Days of cover left at the current rate. `null` once it is already out. */
  daysCover: number | null;
  state: StockState;
  /** What the model wants done, in the brand owner's words. */
  advice: string;
};

export const STOCK: StockItem[] = [
  { sku: "FLV-TRI-BLK-S", name: "Tobago triangle top", variant: "Black · S", onHand: 4, forecast14: 22, daysCover: 3, state: "low", advice: "Reorder 40 — sells out in 3 days at Carnival pace" },
  { sku: "FLV-TRI-BLK-M", name: "Tobago triangle top", variant: "Black · M", onHand: 0, forecast14: 26, daysCover: null, state: "out", advice: "Out since Friday. 11 DMs asking. Reorder 60" },
  { sku: "FLV-BND-RED-M", name: "Maracas bandeau", variant: "Flame · M", onHand: 9, forecast14: 18, daysCover: 7, state: "low", advice: "Reorder 30 before the weekend drop" },
  { sku: "FLV-HIP-SND-L", name: "Store Bay high-waist", variant: "Sand · L", onHand: 31, forecast14: 12, daysCover: 36, state: "healthy", advice: "Holding. No action" },
  { sku: "FLV-ONE-NVY-S", name: "Pigeon Point one-piece", variant: "Navy · S", onHand: 18, forecast14: 15, daysCover: 17, state: "healthy", advice: "Holding. Watch after the shoot goes live" },
  { sku: "FLV-WRP-GRN-U", name: "Buccoo wrap skirt", variant: "Palm · One size", onHand: 6, forecast14: 20, daysCover: 4, state: "low", advice: "Reorder 45 — pairs with the triangle top in 6 of 10 carts" },
  { sku: "FLV-TRI-WHT-L", name: "Tobago triangle top", variant: "Coconut · L", onHand: 52, forecast14: 9, daysCover: 80, state: "incoming", advice: "80 more land Thursday. Consider pausing that PO" },
];

export const RESTOCK_SIGNAL = {
  /** Lines the model would reorder today if it were allowed to. */
  flagged: 4,
  units: 175,
  cost: 12_460,
  /** What walking away from those lines is projected to cost in lost sales. */
  atRisk: 38_900,
};

/* ------------------------------------------------------------------- Orders */

export type FulfilmentState =
  | "unpaid"
  | "packing"
  | "awaiting courier"
  | "in transit"
  | "delivered";

export type Order = {
  ref: string;
  customer: string;
  channel: "Instagram DM" | "WhatsApp" | "Storefront" | "TikTok";
  items: number;
  total: number;
  state: FulfilmentState;
  courier: string | null;
  /** Where it is going, short enough for a table cell. */
  destination: string;
  placed: string;
};

export const ORDERS: Order[] = [
  { ref: "BRN-4821", customer: "Aaliyah Mohammed", channel: "Instagram DM", items: 2, total: 640, state: "awaiting courier", courier: "Zoom TT", destination: "Woodbrook, POS", placed: "12 min ago" },
  { ref: "BRN-4820", customer: "Kerry-Ann Charles", channel: "WhatsApp", items: 1, total: 295, state: "packing", courier: null, destination: "Chaguanas", placed: "38 min ago" },
  { ref: "BRN-4819", customer: "Simone Baptiste", channel: "Storefront", items: 3, total: 985, state: "in transit", courier: "Zoom TT", destination: "San Fernando", placed: "2 h ago" },
  { ref: "BRN-4818", customer: "Renee Ali", channel: "Instagram DM", items: 1, total: 310, state: "unpaid", courier: null, destination: "Arima", placed: "3 h ago" },
  { ref: "BRN-4817", customer: "Deborah Sankar", channel: "TikTok", items: 2, total: 575, state: "in transit", courier: "Moving Solutions", destination: "Scarborough, TOB", placed: "5 h ago" },
  { ref: "BRN-4816", customer: "Jenelle Roberts", channel: "Storefront", items: 4, total: 1_240, state: "delivered", courier: "Zoom TT", destination: "Diego Martin", placed: "Yesterday" },
  { ref: "BRN-4815", customer: "Camille Joseph", channel: "WhatsApp", items: 1, total: 295, state: "delivered", courier: "Pickup", destination: "Collected in store", placed: "Yesterday" },
];

export const DISPATCH = {
  /** Orders the dispatcher would hand to a courier on the next run. */
  readyToDispatch: 6,
  awaitingPayment: 3,
  inTransit: 11,
  /** Median hours from paid to handed over, over the last thirty days. */
  medianHandoverHours: 4.2,
};

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
  assistantReplies: 1_118,
  renewsOn: "October 1, 2026",
};

/* --------------------------------------------------------------- Assistant */

export type Turn = {
  from: "customer" | "assistant";
  body: string;
  at: string;
  /** What the assistant did besides talk. */
  action?: string;
};

/**
 * One thread, as it actually reads.
 *
 * The dialect is the point, not decoration: the concept is an assistant
 * trained on the brand's own conversations, and a Trinidadian customer asking
 * "yuh have dat in a small?" is the sentence it has to answer without being
 * translated into customer-service English first.
 */
export const THREAD: Turn[] = [
  { from: "customer", body: "hey doux doux, yuh have de black triangle top in a small still?", at: "09:12" },
  {
    from: "assistant",
    body: "Morning! Small in black — we down to 4, so I hold one for you for the next 2 hours. The medium finish since Friday but 60 more coming Thursday.",
    at: "09:12",
    action: "Reserved FLV-TRI-BLK-S · 1 unit",
  },
  { from: "customer", body: "perfect. how much wid delivery to chaguanas?", at: "09:14" },
  {
    from: "assistant",
    body: "TT$295 for the top, TT$35 Zoom TT to Chaguanas — TT$330 all in. Want me send the payment link?",
    at: "09:14",
    action: "Quoted courier · Zoom TT",
  },
  { from: "customer", body: "yes pls", at: "09:15" },
  {
    from: "assistant",
    body: "Sent. Once it clear I put it straight in today's dispatch — should reach you tomorrow.",
    at: "09:15",
    action: "Created order BRN-4822 · awaiting payment",
  },
];

export const ASSISTANT = {
  /** Conversations it handled end to end without a person stepping in. */
  handled: 1_118,
  handledShare: 0.83,
  /** Orders that started in a DM and were closed by the assistant. */
  ordersClosed: 604,
  medianReplySeconds: 9,
};

/* ------------------------------------------------- Assistant conversations */

/**
 * Three threads, each showing a different shape of the assistant's work.
 *
 * They are separate conversations rather than one long one on purpose: the
 * assistant does three quite different jobs, and a single transcript would
 * only ever demonstrate whichever one happened last.
 */
export type Conversation = {
  key: string;
  /** The tab label. */
  name: string;
  /** Who or what the thread is with. */
  who: string;
  /** What the person opened with. */
  opener: string;
  /** How the reply reads, one word per token so it can stream. */
  answer: string;
  /** Reasoning shown behind "Thought for Ns". */
  thinking: "Steps" | "Reasoning" | "Search" | "Coding";
  followUps: string[];
};

export const CONVERSATIONS: Conversation[] = [
  {
    key: "dm",
    name: "Aaliyah · DM",
    who: "Instagram DM · Chaguanas",
    opener: "hey doux doux, yuh have de black triangle top in a small still?",
    answer:
      "Small in black — we down to 4, so I hold one for you for the next 2 hours. The medium finish since Friday but 60 more coming Thursday. With Zoom TT to Chaguanas that is TT$330 all in.",
    thinking: "Search",
    followUps: [
      "Send her the payment link",
      "Hold the last small for someone else",
      "What else does she usually buy",
    ],
  },
  {
    key: "restock",
    name: "Restock",
    who: "You · Inventory",
    opener: "what do I need to reorder before the weekend?",
    answer:
      "Four lines. The black triangle top in small and medium are the urgent ones — small has 3 days of cover and medium has been out since Friday with 11 people asking. The Buccoo wrap goes with that top in 6 of every 10 carts, so I would order it in the same run.",
    thinking: "Reasoning",
    followUps: [
      "Draft the purchase order",
      "Why is the wrap skirt moving so fast",
      "What happens if I wait until Monday",
    ],
  },
  {
    key: "dispatch",
    name: "Dispatch",
    who: "You · Orders",
    opener: "is today's run ready to go?",
    answer:
      "Six orders are packed and paid, waiting on Zoom TT. Three are still unpaid and I am holding their stock for another hour. One Tobago order needs Moving Solutions instead — they only collect on Tuesdays.",
    thinking: "Steps",
    followUps: [
      "Release the unpaid holds",
      "Book the Tobago collection",
      "Print the packing slips",
    ],
  },
];

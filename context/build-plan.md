# Build plan

The order bran gets built in. Each line is one feature, opened with `/feature start NN`.
The source of truth for product rules is `flvsbran-pkg/docs/flvs-bran-blueprint.md`;
where this plan departs from it, the reason is written here.

## Where we start from (2026-09-26)

The app is a UI shell. Auth is real (shared FLVS accounts via Better Auth), the `bran`
schema holds only `workspaces` and `workspace_members`, and every screen reads hardcoded
data from `src/lib/demo.ts` / `src/lib/metrics.ts`. Nothing writes.

## Decisions that shape the order

- **Neon + Better Auth + R2, not Supabase.** The blueprint assumes Supabase. bran shares
  FLVS's backend instead (see `AGENTS.md`), so its schema is ported to the `bran`
  Postgres schema and tenancy is enforced by every query filtering on `workspace_id`,
  not by RLS.
- **bran owns the catalog, stock and sales.** The FLVS storefront has no stock tracking
  (`public.products.stock` is null) and a handful of orders, so there is nothing to score
  against there. bran is the system of record — the blueprint's DM-Commerce mode — and
  storefronts, FLVS included, become import sources later.
- **DeepSeek is the model provider for all AI** (chosen 2026-09-26; the blueprint says
  Claude). Every AI call goes through one module so the provider is a one-file change.
- **Formula first, words second.** Restock verdicts come from the blueprint's transparent
  formula; the model only writes the plain-language "why". Scoring never depends on an
  AI call succeeding.
- **AI does work, not decoration** (AI review, 2026-09-26). After 03 the app showed far
  more AI than it had: a scripted assistant with invented stats, a hardcoded "AI Insight",
  a dead "Ask AI" button, template leftovers from an ice-cream demo, and the restock
  formula labelled "the model". Everything AI-shaped must now be real, labelled as a
  sample, or gone — see "How AI is presented" in `ui-rules.md`. 04 does that pass before
  any new AI is added, and the AI features after it replace fakes with working versions
  rather than adding new surfaces.
- **AI SDK + AI Elements for every AI surface.** Model calls use the AI SDK (`ai` 7.x) on
  DeepSeek through `src/lib/ai/`. Chat and agent UI uses AI Elements
  (elements.ai-sdk.dev, installed with `npx ai-elements@latest add <component>`), which
  renders AI SDK message parts directly: `conversation`, `message`, `prompt-input`, `tool`,
  `confirmation`, `suggestion`, `attachments`. They replace the hand-rolled demo
  primitives (`PromptBar`, `ToolChips`, `ThinkingState`, `StreamingText`) as each one is
  made real. Styling is brought onto bran's tokens on install; `no-raw-colors` still
  applies.
- **The model proposes, the owner approves.** Anything an AI step would change — a purchase
  order, a stock count, a catalogue row, a message to a customer — is a draft or a tool
  call with `needsApproval`, shown with AI Elements' `confirmation`. Nothing an agent does
  is sent, saved or spent without a click, until tiers (13) grant specific automations.

## Features

- **01 Restock engine** — `bran` tables for products, variants, stock and sales; a seed
  that creates a demo workspace with ninety days of history; the blueprint §3 scoring
  (days of cover, trend, REORDER/WATCH/HOLD, suggested quantity) as tested pure code; the
  inventory page reading it from the database; "Draft purchase order" saving a real draft.
  *(PR #1)*
- **02 Catalog & stock editing** — add and edit products, variants, costs, lead times and
  stock counts in the dashboard, so a brand with no website can run on bran alone.
  *(PR #2)*
- **03 AI layer on DeepSeek** — the provider module, env config, failure handling and
  logging; first use is the restock "why" for each verdict, cached per line. *(PR #3)*
- **04 Truth pass** — make every AI-shaped surface honest before adding more AI.
  - Remove the ice-cream template leftovers: the "Searched the web" results (Joy Cone,
    WebstaurantStore, The Konery) in `ThinkingState`, the `@` sources "Scoop Data",
    "Flavor records", Figma/Slack/Gmail in `PromptBar`, and the demo copy in
    `StreamingText` / `RecommendationCard` defaults.
  - Stop calling the formula "the model": "The model's call" → "Restock's call", "Model
    said 59" → "Restock said 59", "Filled in with what the model would order" → "…what
    restock would order". The sparkle and "Explained by AI" stay reserved for text a
    language model wrote.
  - The Assistant sheet: remove the invented stats (1,118 handled, 83%, 604 orders, 9s)
    and mark the scripted threads as a preview of 06/11 ("Sample conversation"), with the
    reply box disabled and saying so — until 06 replaces it.
  - Dashboard: replace the hardcoded "AI Insights" line with a real, computed one from
    restock (e.g. "5 lines need reordering; TT$26,260 of sales at risk"), no AI badge; hide
    "Ask AI" until 06 wires it to the assistant.
  - Content calendar, billing and integrations copy that claims a working assistant
    ("Drafted by the assistant", "trained on your own conversations", "1,118 DMs read")
    is marked as sample data or reworded to what exists.
  - Done when: a grep for the leftovers finds nothing; every remaining AI claim on screen
    is either backed by a real call or labelled a sample; screenshots of each touched
    screen in the log.
- **05 Purchase orders & supplier email** — drafted POs currently vanish after "Drafted
  PO-0002". A `/inventory/orders` list (TableCard, paged) and a PO detail dialog: lines,
  quantities vs restock's suggestion, cost; statuses draft → sent → received, where
  *received* adds the quantities to `on_hand` and *sent* makes them count as on order.
  AI: "Draft supplier email" writes the PO as an email to the product's supplier
  (`generateText`, DeepSeek) for the owner to copy or send — shown as an editable draft,
  marked as AI-written, never sent automatically. Gives 06's `draftPurchaseOrder` tool
  somewhere to land.
- **06 Ask bran (the real assistant)** — the Assistant sheet becomes a working agent over
  the workspace's own data, replacing the scripted demo.
  - Server: an AI SDK `ToolLoopAgent` on DeepSeek behind a route handler that streams UI
    messages; conversation state per workspace in `bran.assistant_threads` /
    `bran.assistant_messages`; every step logged through `runAI`'s accounting.
  - Tools wrap existing server code, all scoped by the session's workspace: `getRestock`
    (verdicts, cover, reasons), `findVariants` (catalogue search), `getSalesSummary`,
    `draftPurchaseOrder` and `setStock` (both `needsApproval: true`).
  - UI: AI Elements `conversation`, `message`, `prompt-input` (with `attachments` for
    files), `tool` (shows each call and its result), `confirmation` (approve/deny a
    drafted PO or stock change), `suggestion` (starter questions from restock's state).
    Replaces `PromptBar`, `ToolChips`, `ThinkingState`, `StreamingText` in the sheet.
  - The dashboard's "Ask AI" opens it, pre-filled with a question about the insight.
  - Done when: "what should I reorder before the weekend?" answers from the database with
    the tool calls visible; asking it to draft that order produces a confirmation, and
    approving it creates a PO that shows in 05's list; denying writes nothing; another
    workspace's data is unreachable through any tool; no key → the sheet says AI is off.
- **07 Catalog import** — the blueprint's "snap a photo and let it draft the listing".
  On the catalog, "Import" opens a dialog with AI Elements `attachments` + `prompt-input`:
  paste a supplier price list, an invoice, a WhatsApp message, or drop a photo; DeepSeek
  returns products and variants as structured output (`Output.object`, the same
  `parseProduct` / `parseVariant` rules as 02). The owner reviews them in an editable
  table and imports the ones they keep; nothing is written before that click. Text uses
  `deepseek-v4-flash`; images need DeepSeek's `deepseek-v4-flash-vision-exp` (experimental
  per the provider docs) — if it proves unreliable, ship text-only and say so.
- **08 Orders** — bran-owned orders (manual entry and DM-commerce), the order state
  machine from the prototype, and an importer for FLVS storefront orders. Sales feed
  restock.
- **09 Courier adapter** — the `estimate/createShipment/track/cancel/label` interface;
  manual mode first, oDeliver sandbox second.
- **10 Demand signals** — import FLVS `product_view` / `add_to_bag` events and waitlist
  sign-ups into restock's demand score. Once 11's webhook exists, DM tagging: DeepSeek
  names the products a DM asks about (structured output, validated against the catalogue)
  and each becomes a `dm` signal.
- **11 Instagram DMs + chatbot** — Meta app (start review early — see Open questions),
  webhook, DeepSeek replies in the brand's voice with DM-history retrieval, escalation.
  Reuses 06's agent and tools; replies are drafts the owner approves until the tier
  allows auto-send. The Assistant's sample threads are replaced by real ones.
- **12 Content pool + scheduler** — uploads to R2, AI captions (AI Elements `attachments`
  for the media, captions as editable drafts), scheduled IG publishing.
- **13 Billing & tiers** — plans, the US$50 single-charge cap, weekly billing, tier
  gating by automation level (which AI actions may run without approval). Provider
  undecided: the blueprint says Stripe, FLVS already uses Wam Pay.
- **14 Onboarding & multi-tenant** — sign-up wizard, workspace creation, support-access
  logging surfaced to the owner.

## Open questions

- Billing provider for 13 (Stripe vs Wam Pay).
- Whether the scoring cron runs on Vercel Cron or on-demand when the inventory page
  loads (01 decides for now; revisit when there are real tenants).
- **Meta app review is the long pole** (handover README). It needs the client's Meta
  developer app and an Instagram professional account. Start it now, in parallel — 11 is
  blocked on it, and nothing before 11 is.
- Whether DeepSeek's vision model is dependable enough for 07's photo import, or 07 ships
  text-only first.
- The DeepSeek key pasted into the chat on 2026-09-26 should be rotated.

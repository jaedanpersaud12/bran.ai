# flvs.bran — Developer Handover Package

**flvs.bran** is an AI back-office platform sold to brand owners as a subscription. This package contains working clickable prototypes of every screen, plus a full system blueprint.

Prepared for the developer building the production system.

---

## 1. Start here (5 minutes)

Open `prototypes/flvs-bran-hub.html` in a browser. That's the master hub — every other page links from it. Keep all files in the same folder so links work.

Then click through in this order:

1. **hub** → the master directory (toggle "Admin view" in the header to see staff-only doors + live status)
2. **marketplace** → the shared mall where all subscribed brands sell
3. **landing** → public marketing site / signup entry
4. **prototype** (the backoffice) → **this is the core product.** Click "Start your subscription" to run the signup wizard, then explore every tab
5. **storefront** → what a brand's customers see (use the "⇄ demo" pill to switch between 3 brands)
6. **admin** → platform owner portal
7. **driver** → phase-2 in-house delivery app

---

## 2. What these files ARE and ARE NOT

**They ARE:** functional single-file HTML/CSS/JS prototypes. State persists in `localStorage`. The logic is real — the restock scoring formula, plan-cap enforcement, tier gating, and order state machines all work and should be ported as-is.

**They ARE NOT:** the product. Specifically:

| In the prototype | In production |
|---|---|
| Chatbot = keyword matching | Claude API with retrieval over the brand's real DM history (see blueprint §4) |
| Data = hardcoded demo objects in JS | Supabase Postgres with RLS (schema in blueprint §2) |
| "Send to courier" = a toast message | Real oDeliver REST API calls (blueprint §3b — verified endpoints) |
| Login = a button that flips a flag | Supabase Auth |
| Plans = a variable | Stripe Billing + webhooks |
| Instagram data = static numbers | Meta Graph API (Messaging + Content Publishing + Insights) |

Treat the prototypes as an **executable spec**: the UX, copy, business rules, and visual design are decided. The backend is what needs building.

---

## 3. The documents

- **`docs/flvs-bran-blueprint.pdf`** (14 pages) — read this before writing code. Contains: architecture, Supabase schema, the restock algorithm, chatbot training approach, oDeliver integration with verified API details, multi-platform store adapters, pricing/tier logic, domain architecture, and an 8-week build order.
- **`docs/flvs-bran-blueprint.md`** — same content in Markdown if you prefer to diff/edit it.

---

## 4. Tech stack (already decided)

- **Next.js on Vercel** — the client's existing stack (flvs.life runs on it)
- **Supabase** — Postgres + Auth + Storage, Row Level Security for multi-tenancy
- **Claude API** — chatbot, reorder reasoning, caption generation
- **Meta Graph API** — Instagram DMs, publishing, insights
- **oDeliver REST API** — courier dispatch (Trinidad & Tobago)
- **Stripe Billing** — subscriptions (weekly + monthly intervals)

---

## 5. Domain architecture

```
flvs.life                              → FLVS swimwear brand (existing site)
flvs.life/bran                         → bran landing page
app.flvs.life                          → brand owner backoffice
admin.flvs.life                        → platform admin (staff)
shop.flvs.life/{handle}                → each subscriber's storefront
shop.flvs.life/{handle}/track/{code}   → customer tracking page
market.flvs.life                       → the shared marketplace
```

One codebase. Middleware resolves `{handle}` against the `brands` table and loads that brand's catalog, colors, and bot config.

---

## 6. Suggested build order

1. **Weeks 1–2** — Supabase schema + auth + store instrumentation + Restock AI cron + backoffice restock tab. Test against real FLVS data.
2. **Weeks 2–3** — oDeliver sandbox integration → order dispatch pipeline. (Their API is straightforward; sandbox tokens available immediately.)
3. **Weeks 3–4** — Meta app + webhooks + Claude-powered chatbot with dialect training. **Start Meta app review early — it's the long pole.**
4. **Weeks 5–6** — content pool + AI scheduler + IG publishing.
5. **Weeks 7–8** — Stripe billing, multi-tenant onboarding, storefronts + marketplace, weekly report.

---

## 7. Critical business rules (do not change without asking)

1. **No single charge may exceed US$50.** Most TT debit cards cap daily international spend at ~US$50. Hustle bills $50/month; Pro ($25) and Empire ($50) bill **weekly** for this reason. Enable Stripe smart retries — most failed charges here are daily-limit collisions, not cancellations.
2. **Tier gating is by automation level, not feature access.** Every tier has every feature; what changes is how much runs without the owner. Caps: Hustle = 300 bot replies/mo, 10 scheduled posts/mo, manual POs, manual courier booking.
3. **Automations gate as: alerts (Hustle) → actions (Pro) → campaigns (Empire).** See blueprint §6 for the table. Downgrades must auto-disable automations above the new tier.
4. **DM-Commerce is a first-class mode**, not a fallback. Brands with no website run their entire catalog and checkout through the platform.
5. **Courier must be built behind an adapter interface** (`estimate/createShipment/track/cancel/label`). oDeliver is adapter #1; an in-house fleet is planned as adapter #2; international brands use "manual mode" where the owner advances order status.
6. **Support access to brand data must be logged** and surfaced to the brand owner in their settings — this is a commitment in the platform terms of service.

---

## 8. Accounts/credentials the client needs to provide

- Supabase project + Vercel access
- Anthropic API key (Claude)
- Meta developer app (Instagram professional account connected) — **needs app review**
- oDeliver merchant account → sandbox + production tokens
- Stripe account

---

## 9. Questions

Direct all product/scope questions to the client (Ikenna, FLVS). Where the prototypes and the blueprint disagree, **the blueprint wins** — the prototypes were built iteratively and some earlier screens may lag behind later decisions.

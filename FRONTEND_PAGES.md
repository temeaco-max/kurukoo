# Kurukoo Frontend Page Registry — Complete Architecture

**Version:** 1.0  
**Date:** 2026-08-01  
**Status:** Developer-ready spec  
**Blueprint reference:** §32.6 (updated v5.55)

---

## Overview

This document is the **implementation reference** for every page and surface in the Kurukoo ecosystem. It covers the public marketing site (`kurukoo.ai.studio`), the Web Chat application, and the admin console. The route registry in `src/routes/publicRoutes.ts` and the runtime contract tests are authoritative when this document and an older blueprint section differ.

**Design principle — shared styles:** All pages MUST use semantic CSS classes from the shared stylesheets (`/css/site.css`, `/css/kurukoo-home.css`, `/css/kurukoo-chat.css`, and the admin stylesheets). Inline `style="..."` attributes and inline event handlers are prohibited in production templates; the audited navigation style block has been moved into `site.css`.

---

## Responsive Design Mandate

> **Developer note (v5.55):** A responsiveness, UI, and UX audit must be conducted across the entire ecosystem. The following rules apply to ALL pages — public, PWA, and admin:

1. **No inline styles.** Every visual property must come from a CSS class. Inline `style="..."` attributes and inline event handlers are prohibited. The current production audit reports no inline style attributes or inline handlers in server-rendered templates.
2. **Mobile-first.** Every page is designed for a 360px viewport first, then enhanced for tablet (768px) and desktop (1024px+). Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.
3. **Touch targets.** Minimum 44×44px tap targets (WCAG 2.1 AA). No hover-dependent functionality on mobile.
4. **Images.** Use `<img>` with `loading="lazy"`, `width`/`height` attributes (prevent CLS), `srcset` for responsive sizes, and WebP/AVIF formats. All `alt` text must be present (auto-generated via §53.2.3 if missing).
5. **No horizontal scroll.** All content must fit within the viewport without horizontal scrolling at any breakpoint.
6. **Consistent header/footer.** Shared via `views/_partials/nav.ejs` and `views/_partials/footer.ejs`. No page may override the header or footer layout.
7. **CSS variables.** Use the design system variables from §31.1.1 (`--terracotta`, `--electric-blue`, `--cream`, `--charcoal`, etc.). No hardcoded hex colors in page-level CSS.
8. **Font loading.** Space Grotesk (headings) and Inter (body) loaded via `font-display: swap` to prevent FOIT.

---

## A. Public Marketing Pages

### A1. Homepage
| Field | Value |
|---|---|
| **Route** | `/` (with optional country prefix `/:country(ng|gh|gb)`) |
| **Template** | `views/index.ejs` |
| **Purpose** | Hero, role priming (3 cards), Living Profile (3 cards), Nearby Pulse map preview, "What can you do on Kurukoo?" scrollable cards, "Your Day with Kurukoo" timeline, How It Works (3 steps), social proof, final CTA |
| **Status** | ✅ Exists (needs section additions — see homepage_copy.md v2.0) |
| **Responsive** | Mobile-first. Hero stacks vertically on mobile. Cards become horizontal scroll on mobile, grid on desktop. Timeline becomes vertical on mobile. |

### A2. Pricing
| Field | Value |
|---|---|
| **Route** | `/pricing` |
| **Template** | `views/pricing.ejs` |
| **Purpose** | 3-tier subscription (Base/Plus/Business), Points explanation, feature comparison table, FAQ |

---

## B. Discovery Pages

### B1. Explore Hub
| Field | Value |
|---|---|
| **Route** | `/explore` |
| **Template** | `views/explore/index.ejs` |
| **Purpose** | 45-category card grid. Every 6th card is a sponsored placement. Trending strip, Nearby (Pulse-active providers), Daily Picks card. |
| **Status** | ✅ Exists |
| **Responsive** | Cards: 1-column on mobile, 2-column on tablet, 3-4 column on desktop. Sponsored cards maintain consistent sizing. |

### B2. Category Page
| Field | Value |
|---|---|
| **Route** | `/explore/:slug` |
| **Template** | `views/explore/category.ejs` |
| **Purpose** | Category detail with embedded live hybrid chat (phone mockup hero), dynamically calculated trust metrics (verified provider count, completed jobs, avg ratings), ad slots, sub-category navigation |
| **Status** | ✅ Exists |

### B3. Discover (Nearby Map) — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/discover` |
| **Template** | `views/discover.ejs` |
| **Purpose** | Live interactive map showing nearby providers, AI agents, deals, emergency services. The visual counterpart to the conversational discovery engine. |
| **Status** | ✅ Done — template, backend route, and `/api/discover/map` API all implemented |
| **Map layers** | Toggleable filters: 🟢 Mobile providers (live via Pulse), 📍 Stationary providers (shops/workshops), 🤖 AI agents (assigned to LGAs/categories), 🔴 Emergency services (always visible), 🟡 Kurukoo physical agents (cash-in/out), 🔵 Active deals/requests (open marketplace), 🟣 Events/trending |
| **API** | `GET /api/discover/map?lat={lat}&lng={lng}&radius={m}&layers={csv}` → GeoJSON FeatureCollection. Cached via `cacheGet()` with 30s TTL. |
| **Additional elements** | Search bar with geolocation auto-detect, category quick-filter chips, "Happening now" activity feed, distance/sort controls, privacy notice ("Locations fuzzed to ~100m") |
| **Responsive** | Full-screen map on mobile with overlay panels (bottom sheet for pin details, top bar for filters). On desktop, sidebar with filters + list view alongside map. Leaflet.js + OpenStreetMap. |
| **Blueprint ref** | §9 (Nearby Pulse), §38 (Live Map) |

### B4. For You (User Type Chooser) — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/:country/for-you` |
| **Template** | `views/for-you.ejs` |
| **Purpose** | Shows the 5 user types in the Kurukoo ecosystem with explanations of what each type gets and what they can do. Acts as a "who are you?" entry point that routes users to the right onboarding path. |
| **Status** | ✅ Done — template and backend route implemented |
| **User types** | 1. **Consumer** — Request any service, get matched with trusted providers, escrow protection, Daily Picks. 2. **Provider** — List skills, Work Toggle, Nearby Pulse (Go Live), Boost listings, earn. 3. **Business** — Verified storefront (chat-managed product inventory), catalogue import, analytics, team accounts, advertising. 4. **Physical Agent** — Cash-in/out, onboarding, walk-in assistance, earn commissions. 5. **Contributor** — Micro-tasks (update prices, confirm locations, incident alerts, security updates), earn airtime from Growth Fund, badge progression. |
| **Design** | This legacy role chooser is not registered in the current public router. Role and intent entry now remain conversation-first through `/chat` and are not represented as WhatsApp or PWA deep-link claims. |
| **Responsive** | Cards: 1-column on mobile (stacked), 2-column on tablet, 3-column on desktop. |
| **Blueprint ref** | §40 (Pick a Role), §C Contributor model below |

### B5. Provider Dynamic Display — **NEW (no dedicated page)**
| Field | Value |
|---|---|
| **Route** | No fixed route. Providers are surfaced dynamically through: (a) sponsored Explore cards, (b) Daily Picks cards, (c) Discover map pins, (d) chat-suggested provider cards, (e) boosted listing cards. |
| **Purpose** | Show provider information when the provider has taken an action that benefits Kurukoo (boosted a listing, created an advert, performed a task). NOT a public profile page — Kurukoo is not a business listing directory. |
| **Display mechanism** | Inline cards within the chat thread, Explore grid, Daily Picks, and Discover map. Each card shows: provider name, skill, rating, badge(s), proximity, and a CTA ("Chat with this provider"). Boosted/advertised cards have a "Sponsored" label. |
| **Storefront info** | When a provider has a storefront (Business tier), product cards from their `skills.business_products` appear in Daily Picks or in response to user requests. Products are NOT browseable in a directory — they surface conversationally. |
| **Why no dedicated page** | Many providers already have profiles on Jiji, Instagram, WhatsApp Business, etc. Kurukoo's value is conversation-first discovery, not being another directory. |
| **Blueprint ref** | §32.6 storefront clarification, §9 catalog scraper, §33.1.6 Daily Picks |
| **Status** | ✅ Exists |

### A3. About
| Field | Value |
|---|---|
| **Route** | `/about` |
| **Template** | `views/about.ejs` |
| **Purpose** | Company story, mission, team, and public contact context |
| **Status** | ✅ Exists |

### A4. Contact
| Field | Value |
|---|---|
| **Route** | `/contact` |
| **Template** | `views/contact.ejs` |
| **Purpose** | Public contact information and the supported contact form/channel boundary |
| **Status** | ✅ Exists |

### A5. Careers
| Field | Value |
|---|---|
| **Route** | `/careers` |
| **Template** | `views/careers.ejs` |
| **Purpose** | Open roles, culture, application form |
| **Status** | ✅ Exists |

---

## C. Content & Resources

### C1. Resources Hub — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/resources` |
| **Template** | `views/resources/index.ejs` |
| **Purpose** | Educational content library (the "library"). Evergreen, searchable, SEO-optimized content that feeds into §53 programmatic SEO. |
| **Status** | ✅ Done — template, backend route, and `/api/resources` API all implemented |
| **Content sections** | User Guides, Provider Guides, Business Guides (storefront setup, catalogue import, analytics, team accounts), Diaspora & Relocation Guide (UK life-admin), API Documentation, Legal & Compliance, Blog & Insights |
| **Relationship to Help** | Resources = educational content library (learn how things work). Help = transactional support desk (something went wrong, fix it now). Clear split. |
| **API** | `GET /api/resources?category={slug}&page={n}` → paginated list (max 20/page). `GET /api/resources/:slug` → individual article. |
| **Responsive** | Article cards: 1-column mobile, 2-column tablet, 3-column desktop. Sidebar with category nav on desktop, collapsible on mobile. |

### C2. Resource Article — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/resources/:slug` |
| **Template** | `views/resources/article.ejs` |
| **Purpose** | Individual guide/article with TOC, reading progress, related articles |
| **Status** | ✅ Done — template, backend route, and `/api/resources/:slug` API all implemented |

### C3. Blog
| Field | Value |
|---|---|
| **Route** | `/blog` |
| **Template** | `views/blog/index.ejs` |
| **Purpose** | Market intel, news, updates, provider stories |
| **Status** | ✅ Exists |

### C4. Blog Post
| Field | Value |
|---|---|
| **Route** | `/blog/:slug` |
| **Template** | `views/blog/post.ejs` |
| **Purpose** | Individual blog article |
| **Status** | ✅ Exists |

### C5. API Docs
| Field | Value |
|---|---|
| **Route** | `/api-docs` |
| **Purpose** | Developer integration guides, endpoint reference, authentication |
| **Status** | ✅ Exists |

### C6. Legal
| Field | Value |
|---|---|
| **Route** | `/legal/:section?` |
| **Purpose** | Terms of Service, Privacy Policy, Cookie Policy, NDPA compliance |
| **Status** | ✅ Exists |

---

## D. Support

### D1. Help Centre
| Field | Value |
|---|---|
| **Route** | `/help` |
| **Template** | `views/help.ejs` |
| **Purpose** | Transactional support desk with FAQ, request support, report-a-problem guidance, and an explicit Web Chat boundary. |
| **Status** | ✅ Exists (needs refinement — educational content moves to Resources) |
| **Content to KEEP** | FAQ, support guidance, report-a-problem guidance, contact support, and links into the canonical Web Chat/request lifecycle where available. |
| **Content to MOVE to Resources** | Getting Started, How-To Guides, Privacy & Trust explainer, Earning Money guides |
| **SEO** | `noindex` for support-specific pages (not SEO targets). |

---

## E. Partnership & Advertising

### E1. Partners — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/partners` |
| **Template** | `views/partners.ejs` |
| **Purpose** | Public entry point for all partnership types. Partner type cards, commission structure, application form. |
| **Status** | ✅ Done — template and backend route implemented (admin `partnerships.html` + `/api/admin/partnerships` + `partnerships` table exist) |
| **Partner types** | 1. Kurukoo Agents (physical, cash-in/out, onboarding). 2. Agent Networks (organizations managing multiple agents). 3. Service Partners (businesses on Kurukoo). 4. Technology Partners (API, telco, payment providers). 5. Brand/Corporate Partners (advertising, city takeovers). 6. Community Partners (NGOs, community orgs). 7. Government Partners (LGA, NIN, government services). 8. Developer Partners (API/MCP builders). |
| **Application form** | POST to `/api/partner/apply` → creates row in `partnerships` table → admin review |
| **Blueprint ref** | §11 (Agent Network), §38 (Physical Agent Management) |

### E2. Advertise — ✅ Done
| Field | Value |
|---|---|
| **Route** | `/advertise` |
| **Template** | `views/advertise.ejs` |
| **Purpose** | Public page for businesses/brands to advertise. Ad placement inventory, targeting, pricing, self-serve portal, enterprise contact. |
| **Status** | ✅ Done — template and backend route implemented (`/api/ads` endpoint + admin `marketing.html` + `revenue.html` exist) |
| **Ad placements** | Sponsored Explore cards, Sponsored Daily Picks, Nearby Pulse sponsorships (branded pins), Category takeovers, City takeovers, Provider spotlights, Blog sponsored content |
| **Targeting** | By location (LGA/city), category, user intent, language, user segment |
| **Pricing** | CPM, CPV, flat-rate takeovers |
| **Admin module** | Dedicated Ads Management module (see §H14) — separate from Content/CMS |
| **Blueprint ref** | §7, §33.1.6, §38 (Ads Management — to add) |

---

## F. Country/Locale Variants

| Country | Route | Currency | Status | Notes |
|---|---|---|---|---|
| Nigeria (default) | `/ng` | NGN (₦) | ✅ | Country-aware homepage rendering. Web Chat is the supported conversational channel in this deployment. |
| Ghana | `/gh` | GHS (₵) | ✅ Route | Country-aware homepage rendering; channel adapters remain subject to deployment configuration. |
| UK | `/gb` | GBP (£) | ✅ Route | Country-aware homepage rendering; no unsupported payment or messaging integration is implied by the route. |

**Locale files:** `en`, `ha`, `yo`, `ig`, `pcm` (Nigerian Pidgin), `en-GB`.

---

## G. PWA Application

### G1. Web Chat
| Field | Value |
|---|---|
| **Route** | `/chat` |
| **Template** | `public/chat/index.html` |
| **Purpose** | Canonical conversation-first interface for requests, Web Chat fulfilment, reminders, personal safety check-ins, and context inspection. |
| **Status** | ✅ Exists and covered by runtime/chat contracts |

### G1a. Request Hub shell
| Field | Value |
|---|---|
| **Route** | `/web` |
| **Template** | `public/dashboard.html` |
| **Purpose** | Authenticated shell linking to canonical chat, discovery, resources, profile, and logout surfaces. It is not a second chat architecture. |
| **Status** | ✅ Exists as a shell; do not treat placeholder copy as live economic data. |
| **Layout** | Lightweight authenticated navigation shell. The canonical conversation thread remains `/chat`; this shell must not be documented as a second chat, storefront, or dashboard architecture. |
| **Linked discovery** | Links to the registered `/discover` and `/explore` surfaces. Any provider, activity, distance, availability, or sponsored content must be data-backed at runtime. |
| **Product truthfulness** | The shell does not claim live monetization, sponsored inventory, or activity unless the corresponding backend data is present and labelled. |
| **Inline cards** | Canonical chat response cards and request-state evidence only; card content must remain provider-neutral and tied to the supported Economic Request lifecycle. |
| **Responsive** | Mobile: the sidebar becomes a drawer and the context inspector opens as a keyboard-accessible overlay. Desktop: chat and context inspector remain visible in the shared shell. No emergency-services capability is claimed. |
| **Blueprint ref** | §32.3, §32.9, §33 |

### G2. Login
| Field | Value |
|---|---|
| **Route** | `/login` |
| **Purpose** | Phone number and one-time verification code authentication with conversation and guest-continuity handoff. |
| **Status** | ✅ Exists |

### G3. Conversation-first identity continuation
| Field | Value |
|---|---|
| **Route** | `/login` with optional return, conversation, and guest-continuity query parameters |
| **Template** | `views/login.ejs` |
| **Purpose** | Phone verification that preserves continuity into Web Chat and protected actions through the existing HttpOnly-cookie/JWT boundary. |
| **Status** | ✅ Exists; no separate multi-channel onboarding subsystem is documented or implied. |
| **Responsive** | Mobile-first form with keyboard-visible focus states and touch-safe controls. |

---

## H. Admin Console

All admin pages use separate JWT-based auth (roles: admin, moderator, finance, viewer). Served from `/admin/`.

### Existing Admin Pages
| Page | Route | Purpose | Status |
|---|---|---|---|
| Dashboard | `/admin/dashboard.html` | Real-time MAU, GTV, active providers, revenue | ✅ |
| Users | `/admin/users.html` | User management, search by phone | ✅ |
| Content | `/admin/content.html` | Blog, help, legal, resources CMS | ✅ (needs Resources type) |
| Partnerships | `/admin/partnerships.html` | Partner CRM | ✅ |
| Revenue | `/admin/revenue.html` | Monetisation dashboard | ✅ |
| Marketing | `/admin/marketing.html` | Marketing campaigns | ✅ |
| Pricing | `/admin/pricing.html` | Subscription tier management | ✅ |
| Commissions | `/admin/commissions.html` | Commission configuration | ✅ |
| Referrals | `/admin/referrals.html` | Referral stats, tracking | ✅ |
| Analytics | `/admin/analytics.html` | Demand heatmap, trends | ✅ |
| AI Agents | `/admin/ai-agents.html` | AI agent management | ✅ |
| Artists | `/admin/artists.html` | Verified artist booking | ✅ |
| Social | `/admin/social.html` | Social media scheduling | ✅ |
| Scam Reports | `/admin/scam.html` | Scam/complaint handling | ✅ |
| Celebrity | `/admin/celebrity.html` | Celebrity booking management | ✅ |
| Future Plans | `/admin/future.html` | Roadmap planning | ✅ |

### New Admin Pages
| Page | Route | Purpose | Status | Ref |
|---|---|---|---|---|
| **Ads** | `/admin/ads.html` | Ad campaign management (create, target, schedule, report). Separate from Content/CMS. | ❌ New | §38, §E2 |
| **SEO** | `/admin/seo.html` | SEO control plane (metadata, schema, sitemap, redirects, keywords, AI content, CWV dashboard) | ✅ Done | §53, PA-18/19/20 |
| **Providers** | `/admin/providers.html` | Provider approval/reject/suspend, rating review | ❌ New | §38, §32.1.4 |
| **Compliance** | `/admin/compliance.html` | Dispute/compliance review queue, flagged content | ❌ New | §32.1.4 |
| **Settings** | `/admin/settings.html` | Platform configuration, feature flags (§35), locale settings | ❌ New | §32.1.4 |

**Admin Ads module features:** Campaign creation wizard (placement → targeting → creative → budget → schedule), creative management (upload, AI-assisted copy via Groq through router), targeting engine (location, category, language, segment), scheduling & flight management, performance reporting (impressions, clicks, CTR, conversions, spend), billing & invoicing, approval workflow (§17 blocklist compliance), A/B testing. API: `GET/POST/PUT/DELETE /api/admin/ads` + `GET /api/admin/ads/:id/performance`.

---

## I. Programmatic SEO Pages

### I1. Category × City/LGA Landing Pages — ✅ Done
| Field | Value |
|---|---|
| **Route** | Not registered in the current public router; treat programmatic SEO landing pages as deferred until a verified route is added. |
| **Template** | `views/programmatic.ejs` |
| **Purpose** | Deferred SEO concept. Do not render provider counts, trust metrics, availability, or embedded chat from an unverified route. |
| **Status** | ⏸ Deferred — not part of the current public route contract. |

### I2. Public Provider Profile Pages — ✅ Done (conditional)
| Field | Value |
|---|---|
| **Route** | `/p/:providerSlug` |
| **Template** | `views/provider-profile.ejs` |
| **Purpose** | Auto-generated provider profile pages for SEO (LocalBusiness schema). ONLY generated for providers who have boosted a listing, created an advert, or explicitly opted in. NOT a public directory. |
| **Status** | ✅ Done (PA-20, §53.1) — Route, template, LocalBusiness schema, opt-in gate (verified_provider / public_profile_opt_in / paid subscription), auto-generated SEO meta |
| **Note** | This is the ONLY case where a provider gets a page — and only for SEO, generated automatically, with explicit opt-in or action-triggered creation. Users cannot browse a directory of providers. |

---

## J. Feature Visibility Matrix

Where key features appear in the public-facing ecosystem:

| Feature | Homepage | Explore | Discover | For You | PWA | Resources | Nav |
|---|---|---|---|---|---|---|---|
| Nearby Pulse (Go Live) | ✅ Section | — | ✅ Map layer | ✅ Provider card | ✅ Toggle + map | ✅ Guide | Platform dropdown |
| Daily Picks | — | ✅ Card | — | ✅ Business card | ✅ Sidebar panel | ✅ Guide | Platform dropdown |
| Price Checker | ✅ Scrollable card | ✅ Category | — | ✅ Consumer card | ✅ Inline card | ✅ Guide | — |
| Universal Remote | ✅ Scrollable card | ✅ Category | — | ✅ Consumer card | ✅ Smart Devices | ✅ Guide | — |
| Storefront | ✅ Business card | — | ✅ Map pin | ✅ Business card | ✅ Product cards | ✅ Guide | Platform dropdown |
| Money Circle (Ajo) | ✅ Scrollable card | ✅ Category | — | ✅ Consumer card | ✅ Inline card | ✅ Guide | Platform dropdown |
| Emergency SOS | ✅ Scrollable card | ✅ Category | ✅ Map layer | ✅ Consumer card | ✅ Red button | ✅ Guide | — |
| Contributors/Tasks | — | — | — | ✅ Contributor card | ✅ Tasks panel | ✅ Guide | — |
| National Events | ✅ Timeline | — | ✅ Events layer | — | ✅ Sidebar reminders | ✅ Guide | — |
| Advertising | ✅ Scrollable card | ✅ Sponsored | ✅ Branded pins | ✅ Business card | ✅ Sponsored cards | ✅ Guide | — |

---

## K. "What Can You Do on Kurukoo?" — Scrollable Cards

This section appears on the homepage and feeds into the Explore hub. Each card links to the corresponding Explore category page, which contains a chat UI that can onboard or assist the user.

| # | Card title | Icon | Links to | Group |
|---|---|---|---|---|---|
| 1 | Order Food | 🍜 | `/explore/food` (§55.4) | Everyday Food |
| 2 | Get Groceries | 🛒 | `/explore/groceries` (§55.4) | Everyday Food |
| 3 | Get Errands Done | 🏃 | `/explore/errands` | Everyday Home |
| 4 | Logistics & Delivery | 📦 | `/explore/logistics` | Everyday Home |
| 5 | Send Parcels | 📮 | `/explore/logistics` | Everyday Home |
| 6 | Fuel Delivered | ⛽ | `/explore/errands` | Everyday Home |
| 7 | Get a Ride / Mobility | 🛵 | `/discover` (mobility layer) | Everyday Home |
| 8 | Home Services | 🏠 | `/explore/repairs-maintenance` | Home & Repairs |
| 9 | Generator / Appliance Repairs | 🔧 | `/explore/repairs-maintenance` | Home & Repairs |
| 10 | Solar Installation | ☀️ | `/explore/solar-energy` | Home & Repairs |
| 11 | Auto Repair & Car Parts | 🚗 | `/explore/automotive-mechanics` | Home & Repairs |
| 12 | Access Health & Care | 🏥 | `/explore/health-medical` | Health, Money & Safety |
| 13 | Money Circle (Ajo/Esusu) | 💰 | `/explore/finance-tax` | Health, Money & Safety |
| 14 | Emergency Services / SOS | 🚨 | `/explore/emergency-dispatch` | Health, Money & Safety |
| 15 | Security & Close Protection | 🛡️ | `/explore/emergency-dispatch` (security) | Health, Money & Safety |
| 16 | Neighborhood Safety Alerts | 🚔 | `/explore/community` | Health, Money & Safety |
| 17 | Find Work / Gigs | 💼 | `/explore/gigs` | Earning, Building & Community |
| 18 | Sell Locally | 🏪 | `/explore/classifieds` (§55.4) | Earning, Building & Community |
| 19 | Reach Customers / Advertise | 📢 | `/explore/reach-reference` | Earning, Building & Community |
| 20 | Cover Events / Get Paid | 🎥 | `/for-you` (Contributor) | Earning, Building & Community |
| 21 | Sports, Matches & Clubs | ⚽ | `/explore/sports-recreation` | Earning, Building & Community |
| 22 | Community / Groups (Kuru Circles) | 👥 | `/explore/events-entertainment` | Earning, Building & Community |
| 23 | Get Price Alerts | 💲 | `/explore/price-check` | Info, Alerts & Entertainment |
| 24 | Check Key Services (NIN, CAC) | 📋 | `/explore/government` | Info, Alerts & Entertainment |
| 25 | Check Exam Results (JAMB/WAEC/NECO) | 🎓 | `/explore/education-learning` | Info, Alerts & Entertainment |
| 26 | Reload Airtime & Data | 📱 | `/explore/communication` | Info, Alerts & Entertainment |
| 27 | Universal Remote (TV/Devices) | 📺 | Resources guide | Info, Alerts & Entertainment |
| 28 | Know What's Happening / Events | 📅 | `/discover` (events layer) | Info, Alerts & Entertainment |
| 29 | Hawkers Near You | 🥭 | `/explore/cravings` | Info, Alerts & Entertainment |
| 30 | Prayers & Spiritual | 🤲 | `/explore/spiritual` | Info, Alerts & Entertainment |

> **Grouping note:** Cards are grouped into 5 visual bandings — **Everyday Food**, **Everyday Home**, **Home & Repairs**, **Health, Money & Safety**, **Earning, Building & Community**, **Info, Alerts & Entertainment** — rendered as one continuous scroll, label chips optional. The **new cards responding to recent verticals** are: **Auto Repair & Car Parts** (§55.1), **Security & Close Protection** (§55.2), **Sports, Matches & Clubs** (§55.3), **Get a Ride / Mobility** (Discover), and **Cover Events / Get Paid** (§36.1.3 Contributor).

> **Developer note (Universal Vendor Ordering):** The "Order Food", "Get Groceries", "Sell Locally", and sport/parts/equipment cards all terminate in the **shared Universal Vendor Product Ordering Flow** (§55.4, BLUEPRINT). Each links to an Explore category whose chat UI routes the request through: extract (item+quantity+location) → `find_worker` match against `skills.business_products` → product card → escrow hold → optional `dispatch_rider` second leg → completion → escrow release → reorder signal. These cards must **never** be wired to a per-skill stub — the same flow serves suya vendors, bakeries, grocers, car-parts sellers, and storefronts.

**Design:** Horizontal scroll on mobile (swipeable, snap-scroll), grid on desktop (4-6 columns). Each card: icon, title, subtle border, hover/tap effect. Algorithmically ordered per user if logged in (based on `memory_profiles.inferred_roles` and `behavior_patterns`).

---

## L. Navigation Structure (Live)

The current `nav.ejs` header is:

```
[Logo: Kurukoo] [Discover] [How it works] [Network] [Channels] [Resources] [About] [Start chatting] [Account]
```

All destinations are extensionless and registered in `src/routes/publicRoutes.ts`. The navigation does not claim a mega-dropdown, WhatsApp, USSD, SMS, app-store distribution, or an unconfigured external adapter.

---

## M. Storefront Clarification (Per User Direction)

> **Developer note:** The storefront feature is NOT a public business listing directory. External provider profiles or catalogues may exist independently, but Kurukoo does not claim a WhatsApp, Jiji, or other external-platform integration in this deployment.

**Current storefront boundary:**
1. Product and offer information may surface only through the canonical conversation and provider-neutral response cards when backend data is present.
2. Products stored in `skills.business_products` remain capability data, not a public directory.
3. Marketplace browse, external catalogue import, provider boosting, and external-channel synchronization are deferred capabilities and must not be presented as live.
4. Payment, escrow, fulfilment, and release language remains conditional on the documented Economic Request lifecycle and configured payment boundary.

**What the storefront IS NOT:** NOT a public provider directory, NOT a browseable global product catalogue, and NOT an external messaging-platform integration.

---

## N. National Events & Cultural Calendar — **NEW**

> **Developer note (v5.55):** New system (§54 in blueprint) handling all national days, festivals, and key events across Nigeria, Ghana, and the UK. Includes a dedicated AI agent for reminders.

**Scope:**
- **Nigeria:** Independence Day (Oct 1), Democracy Day (June 12), Eid al-Fitr, Eid al-Adha, Christmas, Easter, New Yam Festival, Lagos Carnival, Calabar Carnival, Ojude Oba, Argungu Fishing Festival, Workers' Day (May 1)
- **Ghana:** Independence Day (March 6), Republic Day, Homowo, Aboakyir Festival, Panafest, Christmas, Easter
- **UK:** New Year, Good Friday, Easter Monday, May Day, Spring/Summer Bank Holidays, Christmas, Boxing Day, Bonfire Night, St George's Day, Diwali, Eid, Notting Hill Carnival

**System architecture:**
- `national_events` table: `id`, `country`, `name`, `type` (public_holiday/religious/cultural/festival/sporting), `date` or `date_rule` (lunar/variable), `description`, `image_url`, `is_recurring`, `locale_relevance` (JSON)
- **Cultural Calendar AI Agent** — dedicated AI agent (§38) that: (a) maintains events calendar, (b) generates contextual reminders ("Tomorrow is Eid al-Fitr — need help finding a butcher?"), (c) personalizes based on inferred religion/culture from `memory_profiles.behavior_patterns`, (d) suggests relevant services (Independence Day → event planners, caterers), (e) creates Daily Picks themed around events (Valentine's → flowers, gifts, restaurants)
- **Reminder delivery:** Native reminder state and the authenticated internal notification inbox are implemented. External FCM, SMS, and messaging-platform delivery remain unconfigured and must not be claimed.
- **Intent creation from frontend:** Website surfaces event-themed content ("Valentine's Day is coming — get ready with Kurukoo" → relevant categories). Creates latent intent without exposing other users' requests.

---

## O. Price Checker Visibility

The price checker (`price_check` category, `price_checker` skill) is currently invisible on the public site. It should be surfaced:

1. **Homepage scrollable cards** — "Get Price Alerts" card → `/explore/price-check`
2. **Explore Hub** — as a category card
3. **PWA** — inline price check cards when user asks "How much is rice?" → returns market prices from nearby providers' `skills.business_products`
4. **Daily Picks** — price alert cards ("Rice price dropped in your area — ₦3,200 at Mama Nkechi's")
5. **For You page** — Consumer card ("Get price alerts on essentials")
6. **Discover map** — price comparison pins (future)

**How it works:** User asks "How much is rice?" → intent router classifies as `price_check` → system queries `skills.business_products` for matching products from nearby providers → returns price comparison cards. Future: market price intelligence (aggregated trends).

---

## P. Universal Remote and autonomous hardware boundary

Universal Remote, IoT, drone, robot, and autonomous hardware control are **not implemented capabilities** in the current application. They must not be listed as live features, device panels, or fulfilment promises. A future implementation would require an explicit provider integration, authorization boundary, safety review, and runtime evidence before any frontend claim is added.

---

## Current Implementation and Deferred Work

| Surface | Route | Status | Truthfulness boundary |
|---|---|---|---|
| Homepage | `/` and `/:country(ng|gh|gb)` | Implemented | Illustrative previews must remain labelled; no live provider, distance, activity, or channel claims without data. |
| Explore | `/explore`, `/explore/:slug` | Implemented | Category aliases resolve through the canonical explore registry. |
| Discovery | `/discover` | Implemented | Map data and provider visibility remain conditional on verified backend data and privacy controls. |
| Web Chat | `/chat` | Implemented | Canonical conversation-first request surface with reminders and personal safety check-ins. |
| Request Hub shell | `/web` | Implemented | Authenticated navigation shell; not a second chat or economic architecture. |
| Login | `/login` | Implemented | Phone OTP and continuity handoff; no unsupported SSO, USSD, SMS, or external-channel claim. |
| Resources, legal, support, partners, advertising | `/resources`, `/legal/:section?`, `/help`, `/partners`, `/advertise` | Implemented | Public pages must link only to registered destinations and configured capabilities. |
| Provider profile | `/p/:providerSlug` | Conditional | Only rendered when provider data and profile eligibility exist; not a browseable directory. |
| Programmatic SEO category/city pages | No current route | Deferred | Do not add route or claim generated metrics until the runtime contract is implemented. |
| Universal Remote / IoT / autonomous hardware | No current route | Not implemented | Do not present as a live feature without a dedicated authorized integration and safety review. |

---

*Last updated: 2026-08-12 | Reconciled with the current public route registry, Web Chat shell, CSS audit, and product-truthfulness boundary.*

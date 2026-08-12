# Kurukoo --- Final Consolidated Blueprint v5.62

**Tagline:** Wake up. Get going.  
*(Note: The tagline is 'Wake up. Get going.' The hero rotator includes marketing descriptors like 'A modern utility platform for everyday hustle.' These are not the tagline and should not replace it.)*
**Shortcode:** `*7000#`
**Voice/WhatsApp:** `7000`
**Previous working names:** Xentrix -> **Kurukoo** (final)

---

## Version History (Consolidated & Deduplicated)

| Version | Date | Summary |
| **v5.63** | 2026-08-12 | **Bounded Autonomous Agent Runtime (§21b).** Implemented one persistent goal runtime that orchestrates existing conversation, bounded Living Memory, canonical Economic Requests, deferred intentions, reminders, notifications, and the established background-service lifecycle. It uses a restricted, ownership-checked tool registry; explicit autonomy levels; concise operational evidence; idempotent goal events; retries, cooldowns, concurrency/action limits; a user-controlled inspector timeline; and deployment flags. It does not create a second AI, memory, task, request, provider, workflow, voice, QR, referral, payment, or dispatch engine. High-risk actions remain outside autonomous execution and continue through their existing confirmation/authorization boundaries. |
| :--- | :--- | :--- |
| **v5.62** | 2026-08-05 | **Agentic Storefront & Interactive UI/UX Transformation (§55.6).** Benchmarked against next-gen agentic commerce platforms (e.g. Swap Commerce agentic storefront model). Added §55.6 codifying the "Show, Don't Tell" interactive agentic UI/UX paradigm across the entire public web surface (Homepage, Explore Categories, For You, Discover). Details interactive Agent Action Simulators, step-by-step agentic execution teardowns (Intent Extraction → Living Memory Lookup → Catalog & Worker Match → Escrow Lock → Multi-Leg Dispatch), interactive traditional vs. agentic comparison matrices, domain-specific category simulators, and live anonymized agentic pulse tickers. Fully compliant with single memory profile, multi-channel mirrors (WhatsApp 7000, USSD *7000#, PWA), and Points economy. Created `AGENTIC_STOREFRONT_TRANSFORMATION_PLAN.md`. |
| **v5.61** | 2026-08-02 | **Deferred Request Protocol — Handling Unavailable Requests (§4.1.3).** Added §4.1.3 — a 5-state protocol (`requested` → `awaiting_match` → `partially_matched` → `fulfilled`/`abandoned`) that keeps users engaged when no provider is immediately available. States table, lifecycle transition table (trigger → from→to → action), and technical implementation (Open Intentions storage in `memory_profiles.open_intentions` with 7-day TTL, 2-hour re-evaluation cron, nightly expiration cron, proactive FCM+WA nudges, user controls: "Check again in X", "Expand to nearby LGAs", "Cancel", "Find alternative skill", fallback pathways after 3 days). Integrates with memory profile (readable by AI, feeds behavior_patterns, surfaces to Opportunity Engine §33, increments `deferred_attempts` for trust-score adjustment). Mandate-compliant (Rules 1, 3, 4, 5). |
| **v5.60** | 2026-08-01 | **How-To Video Content & Channel Growth Engine (§55.5).** Added automated explainer-script generation from How-To Guides/Resources (§32.6) and SEO content (§53.2.6); low-cost TTS (Kokoro-Engine promoted to buildable) + text-on-screen render path; multi-channel distribution (YouTube, Shorts, Reels/TikTok, PWA feed); YouTube Partner Program monetisation thresholds (1,000 subs + 4,000 watch-hours; YPP Shorts 1,000 subs + 10M Shorts views/90d; fan-funding 500 subs + 3 uploads/90d + 3,000 watch-hours); Proactive Engine (§33) driving subscriptions via WhatsApp chat, Daily Picks, push/PWA with optional closed-loop Points reward; new `how_to_scripts` + `video_subscription_events` tables (masked phone-hash analytics, no PII). Mandate-compliant. |
| **v5.59** | 2026-08-01 | **Universal Vendor Product Ordering Flow + Sports Competitor Note (§55.4, §55.3.8).** Added §55.4 Universal Vendor Product Ordering Flow — a single shared build that every catalog-bearing skill uses (roadside food [suya/akara], groceries, bread, car parts §55.1, clothing, equipment storefronts) instead of per-skill special-casing. It fixes the existing `order_food` / `order_food`* intent stub that currently responds with a generic prompt and dead-ends instead of completing a transaction. Flow: extract (item+quantity+location) → `find_worker` match against `skills.business_products` → product card → escrow hold (vendor + platform split) → optional delivery second leg via `dispatch_rider` → completion → escrow release + reorder signal. Reuses existing `business_products`, `find_worker`, `escrow`, `dispatch_rider` — no new vendor-specific fields. Verifies that roadside vendor ordering now has the full path in place and documents that the car-parts vertical (v5.56) did NOT add vendor-specific schema, only skill tags. Added §55.3.8 Competitor Note — Nigerian football/community-sports space is informal & WhatsApp-led; no verified dedicated app holds the market; positioning is chat-first/no-download. Updated FRONTEND_PAGES.md and homepage_copy.md scrollable cards to route "Order Food"/"Get Groceries" through the shared flow. |
| **v5.58** | 2026-08-01 | **Event Coverage Micro-Task & Contributor Content Rights (§36.1.3).** Added §36.1.3 Event Coverage Micro-Task — a field-content acquisition slot in the Contributor System that dispatches Contributors to physically capture video/photo/report at events (sports §55.3, National Events §54, tournaments, venues). Defines assignment flow (proactive offer → accept → check-in via presence → capture via WebRTC/PWA → human moderation gate → approve+pay → distribute to Daily Picks/Discover map/Kuru Media). Payment model extended beyond the airtime cap: Contributors paid **airtime OR OPay/Moniepoint wallet** at their choice, with separate per-task rates (₦500 clip → ₦5,000 full-day) treated as production cost. Added the **UGC Content Licence Agreement** — perpetual, worldwide, royalty-free, sub-licensable licence, with payment conditioned on rights ("no payment → no licensed use"), non-exclusive, moral-rights credit, third-party warranty, and NDPA 2023 / UK GDPR alignment. Added venue/organizer partnership (§36.1.3.2), moderation & safety guardrails, and `event_coverage` API payload integration. |
| **v5.57** | 2026-08-01 | **Sports & Recreation Vertical + Football Club / Community Formation (§55.3).** Added §55.3 Sports, Recreation & Community Engagement — Category 46 with 24+ skill tags (`football_player`, `basketball_player`, `tennis_partner`, `sports_coach`, `football_club_founder`, `match_organizer`, `team_captain`, `league_admin`, `pitch_manager`, `sports_event_host`, etc.); 3 implementation tiers (casual matchmaking, league management, fan communities); integration with §54 National Events & Cultural Calendar; football club formation (formal club registration via chat, captain/player management, club identity), local meetup coordination (spontaneous games, recurring meetup groups, pitch booking), community ecosystem (fan clubs, watch parties, sports alerts, equipment storefronts, tournaments), sports-specific AI agents (match scheduler, fixture generator, standings tracker, results reporter); `leagues`/`teams`/`league_members`/`matches` table specs; revenue model (match fees, lead charges, league registration, club/tournament fees, sponsorship, merchandise); mandate compliance checklist. ECOSYSTEM.md updated: category 46 now has 24+ skill tags. |
| **v5.56** | 2026-08-01 | **Car Parts Ecosystem, Security Personnel Booking, Sports Vertical & SEO Expansion.** Added §55 Specialized Verticals — §55.1 Car Parts & Auto Upgrade Ecosystem (multi-leg matching: parts seller catalog match → delivery orchestration → optional installation; 13 new skill tags; key-market sourcing; storefront integration; per-leg escrow) and §55.2 Security Personnel & Close Protection Booking (duration-based staffing: day/week/month/permanent; standard vs enhanced vetting; police escort via licensed firms not direct booking; per-period escrow release with check-in/check-out; 10 security skill tags; `bookings` + `skill_flows` table extensions) and §55.3 Sports, Recreation & Community Engagement (casual matchmaking, local league management, fan communities, football club formation; category 46 with 18+ skill tags; revenue via match fees, lead charges, league registration, sponsored Daily Picks). Expanded §53 SEO Management System — added §53.2.2.1 FAQ Content System (visible FAQ text + FAQPage schema as dual ranking lever; auto-generation via Groq; per-page FAQ management; FAQ templates; long-tail keyword targeting); expanded heading-structure audit with heading length guidelines (H1 ≤60, H2 ≤70, H3 ≤60); added §53.2.6 Content & Blog Engine (topical authority pillar+cluster model; content calendar; AI-assisted drafting with human review; content briefs; content freshness/relaunch; content gap analysis; content scoring 0-100); added §53.2.7 The 30-Point SEO Audit Checklist (consolidated from Backlinko/Ahrefs/Search Atlas — 10 technical + 12 on-page + 8 content points, scored into A-F Health Grade); added 4 new DB tables (`seo_faq_entries`, `seo_content_calendar`, `seo_content_briefs`, `seo_internal_links`); expanded §53.5 Admin Console with FAQ Manager, Content Calendar, Topical Map tools; expanded §53.4 audit cron with 30-point checklist + stale content + orphan detection. Expanded ECOSYSTEM.md category 5 (emergency-dispatch → Emergency & Security Services) with 10 security skill tags and category 32 (automotive-mechanics) with 13 car parts skill tags and category 46 (sports-recreation) with 18 sports skill tags. Updated TOC to include §55. |
| **v5.55** | 2026-08-01 | **Frontend Page Architecture, Contributor System, Storefront Clarification, National Events & Responsive Mandate.** Major expansion of §32.6 (Public Website & Page Architecture) — added specs for 5 new public pages: Discover (nearby Leaflet.js/OSM map with 7 toggleable layers), For You (5-card user type chooser: Consumer/Provider/Business/Physical Agent/Contributor), Resources Hub (educational content library, split from Help), Partners (8 partner types + application form), Advertise (ad placement inventory + self-serve). Added storefront clarification (chat-managed product inventory, NOT a public directory — products surface conversationally via Daily Picks and user requests). Added provider dynamic display policy (no dedicated provider pages — info surfaces via sponsored cards, Daily Picks, map pins, chat cards — only exception: auto-generated SEO pages for providers who boosted/advertised/opted-in). Added PWA Discover panel spec (sidebar with Daily Picks, activity feed, intent-based suggestions — monetization surface). Added "What Can You Do on Kurukoo?" scrollable cards section (20+ cards linking to Explore categories). Added price checker and universal remote visibility specs. Added responsive design & no-inline-styles mandate (all pages must use CSS classes, mobile-first 360px, 44px touch targets, auto-generated alt text, no horizontal scroll). Expanded §36 Badges with §36.1 Contributor System — defined 6 task types (price updates, incident alerts, neighborhood security, confirm stationary locations, onboarding assistance, content verification), badge grading (Bronze/Silver/Gold), airtime rewards from Growth Fund, sub-teammate model, PWA Tasks panel spec, API endpoints. Expanded §32.3 Tasks panel with task type details. Added §54 National Events & Cultural Calendar — `national_events` table, Cultural Calendar AI Agent (maintains calendar, generates personalized reminders, suggests relevant services, creates themed Daily Picks), reminder delivery via Daily Picks/push/WhatsApp/PWA sidebar, intent creation from frontend. Expanded §38 Admin Console with Ads Management module (campaign wizard, targeting, scheduling, reporting, approval workflow, A/B testing, `/admin/ads.html`). Expanded §53.2.3 with auto-generation of image alt text, filenames, titles, descriptions, keywords via Groq through router. Created `FRONTEND_PAGES.md` (complete page registry — 477 lines covering all public, PWA, admin, and programmatic SEO pages). Updated `homepage_copy.md` to v2.0 (new nav, Living Profile section, Nearby Pulse map preview, scrollable cards, "Your Day with Kurukoo" timeline replacing pricing, updated footer with Partners/Advertise/Resources links, no-inline-styles and responsive copy guidelines). Updated title and end tag to v5.55. |
| **v5.54** | 2026-08-01 | **SEO Management System (§53).** Added a full developer-ready technical specification for an admin-side SEO management system covering the entire discoverable surface (marketing site, Explore hub, 45 category pages, programmatic category×city/LGA×country pages, provider profile pages, blog/help/legal). Five-layer model: (1) Technical SEO infrastructure — env-aware `robots.txt`, multi-sitemap index pipeline, canonical/hreflang management, 301/302 redirect + 404 manager, `llms.txt` (Jeremy Howard 2024 standard); (2) On-page SEO — per-page title/description/slug/canonical/robots from `seo_pages` table; (3) Structured data — schema.org/JSON-LD with per-page injection; (4) Programmatic SEO — template-driven landing pages + provider profile pages with AI-assisted unique copy; (5) Generative Engine Optimization (GEO) for 2026/2027. Added 3 action items (PA-18, PA-19, PA-20). All AI generation through router with hard quotas. 8 new DB tables (`seo_pages`, `seo_redirects`, `seo_keywords`, `seo_rankings`, `seo_backlinks`, `seo_schema_templates`, `seo_audit_runs`, `seo_settings`). |

| **v5.53** | 2026-08-01 | **Priority Action Items — Consolidated Build Roadmap (§52).** Added §52 as a single, trackable build backlog consolidating all 17 priority action items from the Technical Spec Audit (`TECHNICAL_SPEC_AUDIT.md`) into the blueprint. Items are organised in 4 priority tiers: Immediate (PA-1 to PA-4, CRITICAL — blocks development: `tradeEngine.ts` rewrite to escrow, `memory_profiles` schema columns, feature flag system, `escrow` table columns), Near-Term (PA-5 to PA-8, needed for UK launch: cross-border diaspora payments, UK external API integrations, UK Points contradiction resolution, dev→prod stack migration), Medium-Term (PA-9 to PA-13, needed for scale: Living Memory Engine, trust score formula, WebRTC, IoT bridge, blocklist file), Low Priority (PA-14 to PA-17, future work: MCP server spec, Kokoro-Engine spec, notification delivery confirmation, catalog scraper). Added §52.5 Consistency Fixes (5 items: package version mismatch, `types.ts` interface, `addCredits` naming, table formatting, GIST spatial index). Added §52.6 Definition of Done criteria. Each item includes finding ID, severity, problem statement, fix instructions, spec cross-reference, and affected files. Updated title and end tag to v5.53. |
| **v5.52** | 2026-08-01 | **Technical Spec Audit Integration — Developer Notes Added Throughout.** Conducted a comprehensive technical spec audit of all 25 major features in the blueprint against the actual codebase. Integrated all findings as inline `> **Developer note**` blocks throughout the document so a developer reading any section knows exactly what to build, what's already built, and what's missing. Key additions: §2.1 (SQLite vs PostgreSQL migration guide + missing schema columns list), §4.3.2 (explicit MMR algorithm with pseudocode, embedding spec, cosine similarity, lambda/budget parameters, storage mapping table), §4.3.3 (decay formula with exponential decay math, crystallize trigger definition, merge similarity threshold), §4.3.5 (`ai_audit_log` table schema), §5 (SQLite bounding-box query to replace PostgreSQL GIST index), §7.1 (UK Points contradiction resolved — Points disabled for UK, value is forward-compat only), §8 (table formatting fix), §15.1 (trust score calculation formula with weights, range, recalculation schedule), §17 (blocklist storage guidance), §26 (development vs production stack table with migration triggers), §32.11 (WebRTC technical implementation — signalling, SDP/ICE, STUN/TURN, data channel format, connection lifecycle), §32.12 (IoT bridge technical implementation — MQTT broker, discovery protocol, command flow, security, state sync), §33.1.3 (explicit `tradeEngine.ts` rewrite instructions — remove arbitrage, implement escrow), §35 (feature flag system implementation guide — 4-step plan with code examples, locale JSON templates, `featureFlags.ts` service, `available_locales` column), §35.2.2.1 (external API spec cards for UK skills — bin_day, mot_reminder, council_tax, doctor_appointment, train_check with endpoints, auth, cache TTL, fallbacks), §35.2.6.1 (cross-border payment architecture — Stripe→OPay rail, FX conversion, 3% coordination fee, regulatory compliance, dispute resolution), §43 (escrow table migration SQL), §47 (development cache guidance), §50 (accurate implementation status — ✅/⚠️/❌ for every feature), §51 (expanded not-built-yet list with section references). |

| **v5.51** | 2026-08-01 | **Email & SSO Authentication (Optional, Secondary).** Clarified §1.5.2: email and SSO are optional profile attributes and authentication methods, NOT separate identities. Updated §4.3: added `email`, `full_name`, `sso_provider`, `sso_provider_id`, `email_verified_at` to memory_profiles schema. SSO resolves to existing phone number; never creates a new identity or profile. PWA login includes SSO (Google/Apple) and email/password. Email is optional for NG/GH users, required only for UK market (GDPR + formal transactions). USSD/WhatsApp users never need email. Added `email_required` locale flag to §35.2. |
| **v5.50** | 2026-07-31 | **Diaspora Focus Codified + Engineering vs User-Facing Differentiation.** Added §35.2.6 (Diaspora Focus — "Send Support Home" with cross-border escrow), §35.2.7 (Engineering Advantages vs User-Facing Features — internal-only distinction table), §35.2.8 (No New Tables Required — confirms all life-admin skills use existing infrastructure). Updated §35.2.4 to reference §35.2.6 diaspora flows. Updated §31.2.7 to replace "Principal Trade Engine" with "Transaction Orchestration Engine (Kurukoo Guarantee)". Added §1.5.2 (Email & SSO Authentication — optional, resolves to phone number, never creates new identity). Updated §2.1 schema with optional email columns. Added §4.3 (Living Memory Engine — memory tiers, MMR context selection, lifecycle ops, open intentions, Working Context inspector for admin console). Updated §33.1 with full Transaction Orchestration Engine specification (5-step escrow flow, no inventory, no working capital). Renamed §33.1.2 to Transaction Orchestration Engine, §33.1.1 to Transaction Orchestration Engine — Intended Behaviour. Updated §33.1.3 with complete subsections (no hard-coded skills, config-driven eligibility, provider constraints, separation of concerns, auditability, cost/safety controls). |
| **v5.49** | 2026-07-31 | **Channel Strategy Expanded — Full Taxonomy + Contingency Plan.** Added 10-channel taxonomy (Primary/Secondary/Tertiary/Emerging tiers) to §6. Added §6.2 Channel Contingency Plan with graduated-restriction and complete-offboarding scenarios. Added channel-specific feature flags to §35. Channel strategy codified as "Land on WhatsApp, Own the Relationship" with explicit targets: launch (WhatsApp 70%, USSD 20%, PWA 10%) → maturity (WhatsApp 40%, PWA 35%, USSD 15%, SMS 10%). **Note:** The old "Principal Trade Engine" was renamed "Transaction Orchestration Engine" in v5.46 because the actual business model is escrow-based coordination without inventory holding — the old name described capital-intensive retail arbitrage, which was incorrect. |
| **v5.48** | 2026-07-31 | **Living Memory Engine Alignment — Memory Architecture Upgrade Specified.** Added §4.3 (Memory Lifecycle & Context Selection) defining four memory tiers (stable self-knowledge, episodic memories, open intentions, recent tail), MMR-based working context selection with token budgets (1,024 FastText / 2,048 Groq), memory lifecycle operations (decay, reinforcement, pruning, merge, crystallize), open intentions (prospective memory with TTLs), and explainability/auditability logging. Added Living Memory Engine alignment notes to §4 (adopt now — bounded working context & memory lifecycle), §31 (adopt now — prospective memory/open intentions), §38 (adopt now — Working Context inspector for admin console), and §41 (watch — multi-person attributed memory for group features). |
| **v5.46** | 2026-07-31 | **Architecture Clarification — Vertical + Horizontal Hybrid Positioning, Transaction Orchestration Engine Renamed, Engineering Advantages Differentiated from User-Facing Features.** Clarified that Kurukoo is vertically focused (informal-economy Africa) but horizontally architected (smart-city/MVNO infrastructure) with feature flags controlling layer activation per market. Renamed "Principal Trade Engine" to "Transaction Orchestration Engine" throughout §33.1 to reflect the correct model: buyer pays first into escrow (OPay/Moniepoint), platform takes coordination cut, seller's portion held in escrow, delivery confirmed → release payment. No inventory holding, no working capital required. Added "Pick a Role" conversation priming UX pattern to §40. Added §1.5 note distinguishing engineering advantages (AI-first routing, single memory profile, 300+ skill engine) as defensible moats from user-facing features (Points, multi-role identity, Kurukoo Guarantee). |
| **v5.45** | 2026-07-31 | **Kokoro-Engine Workflow Pattern — Alignment Notes Added.** Analyzed Kokoro-Engine (workflow automation/business process orchestration MCP server) against Kurukoo architecture. Added alignment notes to §4 (workflow abstraction + named/versioned process definitions adoption), §6 (multi-channel workflow handoff watch), §21a (workflow abstraction + human-in-the-loop pause points adoption), and §33 (conditional branching + skill-flow-as-process adoption + workflow observability watch). Kurukoo should adopt Kokoro-Engine's pattern of composing discrete tool calls into named, versioned, observable workflows with retry/compensation semantics. |
| **v5.44** | 2026-07-31 | **MCP (Model Context Protocol) Reference Analysis — Alignment Notes Added.** Analyzed the MCP server ecosystem against Kurukoo architecture. Added alignment notes to §4 (MCP server pattern adoption — exposing Kurukoo's core capabilities as MCP tools), §21a (AI agents discovering and using external MCP tools), §6 (MCP as a new programmatic channel watch), and §41 (MCP security patterns watch). Kurukoo should position itself as both an MCP consumer (using external tools) and an MCP provider (exposing its own capabilities). |
| **v5.43** | 2026-07-31 | **GenUI Reference Analysis — Alignment Notes Added.** Analyzed GenUI (conversation intelligence platform with declarative UI generation) against Kurukoo architecture. Added alignment notes to §4 (declarative UI schema), §40 (read-only AI-generated UI), §33.1.4 (multi-participant conversation watch), §33.1.5 (timeline/analytics watch), §33.1.6 (action-item extraction watch), and §41.1 (consent-first data capture adoption) documenting recommended adoptions, monitoring items, and already-aligned patterns. |
| **v5.42** | 2026-07-31 | **Trade Engine Behaviour Clarified — Configuration-Driven Eligibility.** Replaced implicit hard-coded skill selection in `tradeEngine.ts` with a configuration-driven eligibility model. Skills must be explicitly marked as principal-trade-eligible in `skill_flows` metadata. Audit logging, cost/safety controls (exposure limits, concurrent-job caps, auto-pause on loss thresholds), and separation-of-concerns rules are now specified. Normal user requests continue to use the standard matching path; the Trade Engine is reserved for platform-orchestrated fulfilment only. |
| **v5.41** | 2026-07-31 | **First-Class AI Agents System & Points Naming Consistency.** Implemented full backend management for First-Class AI Agents (§21a) with `ai_agents` SQLite table, `aiAgentService.ts`, `/api/admin/ai-agents` REST endpoints, and `/public/admin/ai-agents.html` visual command center. Refactored `creditEngine.ts` to `pointsEngine.ts` and renamed `CREDIT_COMPLIANCE.md` to `POINTS_COMPLIANCE.md` to guarantee 100% naming consistency across code and documentation. AI Agents are now fully plumbed into Points Economy, Ratings, Trust Score, and Proactive Engine by being mirrored into `memory_profiles` and `skills`. |
| **v5.40** | 2026-07-31 | **Comprehensive Mobile Roadmap & Store Wrappers Explicitly Detailed.** Expanded §14 (Mobile Strategy) and §32.8 (Mobile App) to fully articulate Phase 2 Trusted Web Activity (TWA) Android Play Store wrapper, iOS WKWebView Store Wrapper, Digital Asset Links (`/.well-known/assetlinks.json`), Apple Universal Links (`/.well-known/apple-app-site-association`), and Phase 3 Cross-Platform Native Apps (Flutter & React Native) for deep OS capabilities, offline SQLite state sync, biometrics, background location, and native notifications. All platforms interface with the exact same unified backend, single `memory_profiles` database, and `messages` conversation thread. |
| **v5.39** | 2026-07-30 | **Explore Category Template Refinement (Musk & Ma Lenses).** Embedded the live hybrid chat component directly inside the top responsive hero grid of each `/explore/[slug]` page (`category.ejs`), enabling direct onboarding from category mock conversations. Replaced static trust metrics with real-time, area-scoped data queried dynamically from the `skills` and `memory_profiles` database tables (live verified provider count, completed job counts, and average star ratings aggregated by category keywords). |
| **v5.38** | 2026-07-30 | **Full UK Life-Admin Integration as Universal Skills.** Expanded §35.2 from 8 to 60+ UK life-admin skills, all with clean universal IDs (no country prefix). Each skill documented with category, required data, legal disclaimer, payment model, and fulfilment type. Added skill_flows configuration guidance, locale & feature flag control section, and Points economy note. Every skill obeys the Tight Integration Mandate — reads/writes the single memory profile, lives inside the unified conversation, uses the shared Points balance, and uses the shared presence/reminder infrastructure. No new tables, no voting system, no country-prefixed skill IDs. Enabled via `memory_profiles.country` and feature flags scoped to `/gb/`. Same skills ready for other countries without renaming. |
| **v5.36** | 2026-07-30 | Added §1.5 Agreed Operating & Growth Principles (Internal Only): presence & location operating model, channel priority, business & provider seeding strategy (soft-claim via existing tables + Catalog Scraper), cost & intensity controls, on-demand vs delayed services, free UX indicators, and backend systems required for frontend alignment. Internal-only section; no public-facing language changed. No features removed. |
| **v5.35** | 2026-07-30 | Added Tight Integration Mandate, revised memory-profile schema with presence and behaviour signals, Presence Trick-Bridge, hybrid FCM + short-lived WebRTC rules, complete AI-agent first-class user system with full backend management, strengthened Redis role, separated Delivery vs Errands, expanded Universal Remote, free UX indicators, on-demand vs delayed services, and cost-effective operating principles. No features removed. |
| **v5.33** | 2026-07-29 | **Definitive Consolidated Blueprint.** Merged v5.16 and v5.30.1 branches. Added WhatsApp typing indicator, appointment skill‑flow audit, data retention purge verification, Kuru sub‑brand architecture, unified message history, hybrid chat two‑phase flow, Explore hub with 45 categories, design system references, and all legacy feature descriptions. No feature from any prior version has been removed. |
| v5.32.1 | 2026-07-28 | WhatsApp typing indicator, appointment skill‑flow audit, data retention purge verified. |
| v5.32 | 2026-07-28 | Trust, Growth & Brand Systems: Implemented brand asset integration, referral system (code generation, tracking, 200‑Point rewards, Web Contact Picker sharing), rating & badges (post‑job star rating, verified/top‑rated/contributor badges), and verified artist booking system (escrow hold, cooling‑off period, manager verification). |
| v5.31 | 2026-07-28 | Point system refactored for CBN compliance. Removed airtime redemption, decoupled Credits (now Points) from fiat in the UI. Created `CREDIT_COMPLIANCE.md`. |
| v5.30.1 | 2026-07-28 | Hybrid Chat UX Refined: Strict 2‑phase chat flow, removed “Hybrid Chat” labels, added CSS phone mockups. |
| v5.30 | 2026-07-28 | Contingency plans (Credit Economy fallback, WhatsApp contingency plan), data retention & purging policies, `exportUserData`/`deleteUserData` in PWA settings. |
| v5.29 | 2026-07-28 | Explore Hub, Homepage Live Chat & Brand Integration: Reusable chat component, geometric rooster comb icon, favicon assets. |
| v5.28 | 2026-07-28 | Hybrid Chat Architecture: Anonymous mode (FastText, temporary sessions, contextual phone prompts), authenticated mode (OTP transition, session merging). Location data policy documented. |
| v5.27 | 2026-07-28 | Reusable Chat Component & Memory Profile Hardening: `kurukoo-chat.js`, `profile_access_log`, AES‑256 encryption, device‑bound FCM token validation. |
| v5.26 | 2026-07-28 | Explore Hub & 45 Category Pages: Dynamic `/explore` hub, 45 `/explore/[slug]` pages with mock conversations, sponsored ad placements, trust signals, onboarding entry. |
| v5.25 | 2026-07-28 | Conversational Architecture Locked: Single‑thread layout, deprecated public grids/gig boards, CONFIRM‑based OTP, progressive 6‑step onboarding. |
| v5.24.1 | 2026-07-28 | Tagline & Hero Finalised: “Wake up. Get going.” across all locales. UK sub‑tagline added. Meta description updated. |
| v5.23.1 | 2026-07-28 | Ecosystem‑Wide Caching: Service Worker with Cache‑First, Stale‑While‑Revalidate, and Network‑Only strategies. Offline fallback page. |
| v5.23 | 2026-07-28 | Phase 3 Deep Internal Rebrand: Env vars, database file, FastText model, zip builder renamed. |
| v5.22.1 | 2026-07-28 | Phase 2 Internal Rebrand: Code strings, logs, PWA cache updated to Kurukoo. |
| v5.22 | 2026-07-28 | Systematic rebrand to Kurukoo. Tagline: “Wake up. Get going.” |
| v5.21.3 | 2026-07-27 | WhatsApp mockup, API Docs, mobile responsiveness. |
| v5.21.2 | 2026-07-27 | Design system refined, Blog/Help sections built. |
| v5.21.1 | 2026-07-27 | Public website redesigned to world‑class standard (v2). |
| v5.20.1 | 2026-07-27 | PWA rebuilt to world‑class standard. |
| v5.19 | 2026-07-27 | Offline capability, packaging, final verification. |
| v5.18.1 | 2026-07-27 | Auto‑generated success stories, Badges, Boost habit‑loop, WebRTC calls, Wake‑word voice activation. |
| v5.18 | 2026-07-27 | Universal Remote/IoT (Discovery, MQTT/HTTP bridge, PWA controls), Admin SEO/Content tools. |
| v5.17 | 2026-07-25 | Dynamic pricing and commission configuration tables. |
| v5.16 | 2026-07-20 | Foundation consolidated. |

---

## Table of Contents

*This document is organised into logical groups. Section numbers are preserved from the original blueprint to maintain cross-reference stability.*

### GROUP 1 — FOUNDATION
§1. What Kurukoo Is · §1.1 Vision · §1.2 Mission · §1.3 Values · §1.4 Tight Integration Mandate · §1.5 Operating & Growth Principles · §1.6 Founder-Inspired Principles · §2. Core Identity Architecture
### GROUP 2 — ENGINE
§3. Intelligent Onboarding · §4. Skills-Based Request Matching · §5. Kuru Pulse & Presence · §42. Kuru Pulse (detailed mechanics)
### GROUP 3 — CHANNELS
§6. Channel-Agnostic Access · §13. Notification Architecture · §14. Mobile Strategy · §40. Hybrid Chat UI
### GROUP 4 — ECONOMY
§7. Point Economy · §8. Subscription Tiers · §9. Agent Network · §10. Revenue Model · §11. Payment Models · §12. Unified Dashboard
### GROUP 5 — TRUST & SAFETY
§15. KuruTrust · §17. Content Moderation · §18. Anti-Bias · §41. Privacy & Security
### GROUP 6 — SKILLS TAXONOMY
§16. Service Verticals · §45. Provider Operation Modes & Skill Dimensions · §55. Specialized Verticals & Agentic Storefront Showcase (§55.6)
### GROUP 7 — INTELLIGENCE
§19. Competitive Precedent · §20. Diaspora Positioning · §21. AI & Intelligence Layer · §21b. Autonomous Agent Runtime · AI Agents as First-Class Users
### GROUP 8 — GROWTH
§22. Referral Programme · §36. Badges & Reputation · §39. Explore Hub · §43. Verified Artist Booking
### GROUP 9 — PLATFORM FEATURES
§32. PWA Navigation & Quick Replies · §33. Progressive Onboarding · §38. Admin Console · §31. Brand Architecture
### GROUP 10 — INTERNATIONALISATION
§34. Language Services · §35. i18n Architecture & UK Life-Admin Skills
### GROUP 11 — OPERATIONS & RISK
§23. WhatsApp Channel Deep-Dive · §24. Celebrity Opportunities · §25. Negative Review Handling · §26. Technology Stack · §27. Government Policy Landscape · §28. Implementation Roadmap · §37. Contingency Plans · §44. Risks & Mitigations · §46. Data Retention Policy · §47. Caching Strategy · §48. Unit Economics · §49. Cost-Effective Operating Principles

### APPENDICES
§29. Current Implementation Status · §30. What Is NOT Built Yet · Nigerian Market Success Patterns · Full Version History · Cost-Effectiveness Note

---

## 1. What Kurukoo Is

Kurukoo is a multi-sided utility product that uses conversational AI to deliver on-demand SaaS tools straight to the informal economy. It gives every user a single, private connection to **request anything**, **offer any skill**, and **earn from it**, securely and privately — all inside one conversation.

From a user-facing brand perspective, Kurukoo is positioned as the **"trusted neighbor who knows everyone in the area and is always ready to assist."** It is a reliable, deeply connected local friend who understands you: learning who you are, finding trusted helpers, listing your skills, holding escrow payments safely, and serving up proactive local earning opportunities.

It works wherever the user is: inside a WhatsApp chat, on a basic feature phone via USSD, or through a lightweight Progressive Web App. Underneath, a powerful conversational SaaS architecture bundles digital storefront auto-generation, smart escrow, live location broadcasting (Nearby Pulse), and proactive opportunity matchmaking into a single chat thread.

**Kurukoo is vertically focused on the informal economy in Africa (Nigeria, Ghana, and adjacent markets) but horizontally architected as reusable economic infrastructure — conversation, identity, payments, logistics, and trust layers that can later be deployed as smart-city operating systems, MVNO bundles, and utilities.** Feature flags control which layers activate per market. The public marketing and tone emphasize the trusted-neighbor persona; the MVNO/smart-city future is internal architecture.

**Kurukoo is not a chatbot. It is a multi-sided conversational SaaS utility that happens to use the world’s most popular chat app as one of its interfaces.**

## 1.1. Vision

Kurukoo is a unified digital ecosystem where;
- Every user is a potential provider.
- The system learns who you are as you use it.
- No rigid categories. No separate apps. No complex registration.
- Profitable through subscriptions, leads, advertising, data insights, token sales and transaction fees.
- The platform is open source and decentralized, with a community of contributors and a governance model that ensures sustainability and fairness.


## 1.2. Mission

Kurukoo’s mission is to empower every participant in the informal economy with the tools and resources they need to thrive — starting in Nigeria and Ghana, then expanding across Africa and into other markets. We believe that everyone deserves access to the same opportunities, regardless of their background or circumstances. That’s why we’re building a platform that is easy to use, accessible to everyone, and designed to help users achieve their goals.

**Vertical focus (current):** The informal economy in Africa — 45 service verticals, Points economy, Kuru Pulse, escrow-based coordination, USSD-first access, agent referral networks. This is where we win first.

**Horizontal architecture (future via feature flags):** The same conversation + identity + payments + logistics + trust infrastructure can be repurposed for smart-city services, MVNO bundles, utilities, UK life-admin, and other markets. The /gb/ locale and the long-term aspirations (§28.2) are early horizontal extensions. Feature flags (`memory_profiles.country`, locale-specific `feature_flags` in `locales/*.json`, `available_locales` on `skill_flows`) control which vertical or horizontal layer is active for a given user or market. No code rewrite is required to add a new market or vertical.

## 1.3. Values

Kurukoo is guided by the following values:
- **Accessibility**: We believe that everyone should have access to the same opportunities, regardless of their background or circumstances. That’s why we’re building a platform that is easy to use, accessible to everyone, and designed to help users achieve their goals.
- **Privacy**: We believe that users should have control over their data and privacy. That’s why we’re building a platform that is designed to keep your data and identity private.
- **Security**: We believe that security is paramount. That’s why we’re building a platform that is designed to keep your data and identity private.
- **Inclusivity**: We believe that everyone should have the opportunity to contribute to the platform. That’s why we’re building a platform that is open source and decentralized, with a community of contributors and a governance model that ensures sustainability and fairness.
- **Transparency**: We believe that transparency is important. That’s why we’re building a platform that is designed to be transparent and understandable.
- **Respect**: We believe that respect is important. That’s why we’re building a platform that is designed to respect the privacy and autonomy of users.

## 1.4 Tight Integration Mandate (Non-Negotiable)

Kurukoo is not a collection of features. It is a single living system whose only purpose is to make every Nigerian's economic life flow through one conversation and one memory.

The five irreversible rules of the platform are:

1. Memory Profile is the single source of truth
   Every phone number has exactly one memory_profiles row. Every interaction (request, acceptance, Pulse session, rating, location pattern, Daily Pick engagement, token spend) must update this profile in real time. Matching, Pulse, Daily Picks, quick replies, and proactive nudges may only read from this profile (plus the skills and messages tables). No subsystem may maintain its own separate user state.

2. Real-time Presence is shared and adaptive

   There is one presence / location service. When a provider toggles "Go Live" or becomes available, the same presence record is used by both the Nearby Pulse nudge system and the skills-matching engine. There are never two independent location systems.

3. The Conversation is the only primary interface
   WhatsApp, PWA, and USSD are simply different doors into the same persistent conversation thread stored in the messages table. All major actions must be possible inside the chat. The PWA is a rich mirror of that thread, never a separate product.

4. Tokens / Points are the continuous economic layer
   Lead charges, Go Live costs, boosts, and rewards all move the same Points balance. The balance is visible and actionable in every channel.

5. Proactive intelligence is driven by the same memory
   Daily Picks, skill-demand alerts, re-order suggestions, and opportunity nudges are generated only from the living memory profile and are delivered into the same conversation thread.

Any feature that violates one of these five rules is considered incomplete.

Success is defined by this observable user experience:
A user can open WhatsApp or the PWA, have a continuous conversation, ask for anything, receive a real-time Pulse nudge from a nearby mobile provider, accept or request something, move tokens, leave a rating, and the next day the system already knows more about them — all without ever leaving the conversation or feeling they switched products.

### 1.4.1 Builder & AI Agent Rules

When implementing any feature:

- Ask first: "Does this read from and write to the single memory profile?"

- Ask second: "Does this appear inside the unified conversation?"

- Ask third: "Does this use the shared real-time presence layer if it involves location or availability?"

- If the answer to any of the above is no, the feature is not yet correctly integrated.

## 1.5 Agreed Operating & Growth Principles (Internal Only)

This section is strictly internal. Public-facing copy must never expose the internal names or mechanisms described here.

### Presence & Location Operating Model
- Default Pulse = discoverable + last-known / last-confirmed location + schedule.
- Stationary providers appear live via schedule + last chat confirmation.
- Mobile providers use smart-interval updates with path interpolation so the map feels continuous.
- Precise GPS or short-lived WebRTC data channel is used only after clear user intent or during an active job.
- Presence records have aggressive TTLs and automatic cleanup.
- Public language never mentions internal transport details. Users only see the benefit: "Real-time nearby discovery that just works."

### Channel Priority
- **Top 3 Channels for Smart Device & Web Visitors:**
  1. **Kurukoo Web App (PWA)** (`web.kurukoo.com`) — Rich browser and installed app experience with live radar, voice transcription, map matching, and wallet dashboards.
  2. **WhatsApp Cloud API** — Everyday conversational interface with rich media, interactive buttons, catalog sync, and secure escrow notices.
  3. **Telegram Bot** — Fast, lightweight bot interaction with secure deep-links and instant notifications for tech-savvy users and agent networks.
- **USSD (`*7000#`)** — Offline fallback channel dedicated to feature phones (zero data required). Feature phone use is not heavily presented to web visitors, as visitors arriving on the website are using smart devices.
- **Native iOS & Android apps** — Phase 2/3 secondary channels.

### Channel Strategy — "Kurukoo Omnichannel Ecosystem"
- **Web App (PWA) & WhatsApp & Telegram are primary.** Every web visitor lands on our top 3 smart device channels.
- **USSD is for resilience.** If data networks fail or feature phones are used, Kurukoo survives on USSD + SMS.
- **SMS is for notifications.** OTPs, delivery confirmations, payment receipts — universal reach, works when data fails.
- **Email is for formal communications.** UK market primarily — receipts, contracts, formal disputes.

### 1.5.2 Email & SSO Authentication (Optional, Secondary)
**Rule:** Email and SSO are optional profile attributes and authentication methods, NOT separate identities.

- Email/SSO resolves to an existing phone number; never creates a new identity or profile.
- SSO pre-fills: email, full_name, country from Google/Apple — but phone number remains the source of truth.
- PWA login options include SSO (Google/Apple) and email/password — both resolve to phone number.
- Email is optional for NG/GH users; **required only for UK market** (GDPR + formal transactions) via `email_required` locale flag.
- USSD/WhatsApp users never need email — phone number alone is sufficient for all core functionality.
- **The golden rule:** By the time any channel crisis hits, users must already have direct access via PWA (browser bookmark) + phone number. WhatsApp is a notification layer, not the relationship owner. The relationship is with Kurukoo, not WhatsApp.
- **Channel mix targets:** Launch (Nigeria) — WhatsApp 70%, USSD 20%, PWA 10%. Maturity (18 months) — WhatsApp 40%, PWA 35%, USSD 15%, SMS 10%.

### Business & Provider Seeding Strategy
- Use the existing memory_profiles + skills + provider_presence tables only.
- Seeded records are marked source = "seeded" with a soft-verified flag.
- Stationary businesses can be seeded conservatively from public data.
- Product information is enriched using the existing Catalog Scraper / WhatsApp Business catalogue import — do not build a new system.
- When a seeded business claims the profile, data is merged into a live memory profile.
- Full control of seeding (import, enable/disable, review, claim status) lives in the Admin Console.

### Cost & Intensity Controls
- FCM is the always-on trigger.
- Precise location / WebRTC only on high-value confirmed moments.
- FastText handles ≥ 95 % of intent classification.
- Free / open models preferred; paid models under hard quotas.
- Aggressive Redis TTLs for presence, points balance, recent messages and profile snapshots.
- AI agents have hard concurrency, token and cost quotas and can be paused automatically.

### On-Demand vs Delayed Services
Users (or the system) can choose "I need it now" or a delayed window. Matching, notification and fulfilment must support both modes.

### Free UX Indicators
"Kurukoo is typing…", "Analysing your request…", "Checking nearby providers…", "Looking for the best match…" are zero-cost trust indicators.

### Backend Systems Required for Frontend Alignment
The following must stay consistent with any public frontend:
- Unified conversation + memory profile + presence API
- Soft-claim flow for seeded providers
- Catalog / product enrichment via existing scraper
- Points balance and lead-charge endpoints
- Admin controls for seeding, AI agents, presence TTLs and live map filters
- On-demand vs delayed matching flags

### Vertical + Horizontal Hybrid Positioning (Feature-Flagged Deployment)
Kurukoo is **vertically focused** (informal-economy Africa — Nigeria, Ghana, and adjacent markets) but **horizontally architected** for future deployment as smart-city infrastructure and MVNO bundles.

- **Vertical layer (active now):** 45 service verticals, Points economy, Kuru Pulse, Nearby Pulse, agent referral network, USSD-first chat, escrow-based payments — all designed for the informal economy in Africa.
- **Horizontal layer (future via feature flags):** Conversation + identity + payments + logistics + trust infrastructure reusable across smart-city services, utilities, MVNO, and other markets (UK life admin is an early horizontal extension, scoped to `/gb/`).
- **Feature flags control layer activation per market.** Nigeria launch activates vertical layer + basic payment infrastructure. UK launch activates vertical layer (life-admin skills, GBP pricing) without Points. Smart-city deployment activates horizontal layer (MVNO, utilities, city services) plus vertical layer (local services).
- **Public positioning:** Kurukoo is an economic coordination layer for the informal economy. The smart-city/MVNO future is an internal architecture advantage, not a public messaging topic until those layers are live.

### Engineering Advantages vs User-Facing Features (Internal Only)
The following distinction must be maintained in all documentation, investor materials, and frontend copy:

**Engineering advantages (defensible moats — NOT user-facing copy):**
- AI-first intent routing (FastText + Groq, 98% zero marginal cost)
- Single memory profile as unified identity
- 300+ skill tags handled by one generic matching engine (`find_worker`)
- Transaction Orchestration Engine (escrow-based coordination, no inventory holding)
- Conversation-as-OS architecture (WhatsApp + USSD + PWA from one thread)

**User-facing features (what users experience):**
- Points (closed-loop economic layer with real value)
- Multi-role identity (one phone number = consumer + provider + business)
- Kurukoo Guarantee (buyer pays into escrow, delivery confirmed before seller is paid)
- Nearby Pulse (real-time discovery without battery drain)
- Daily Picks and proactive opportunity engine

**Rule:** Users experience outcomes (speed, trust, convenience, earnings), not architecture. Engineering advantages are discussed in the blueprint, investor decks, and technical documentation — never on the homepage, in marketing copy, or in user onboarding flows.

## 1.6 Founder-Inspired Operating Principles (Internal Only)

This subsection is strictly internal. It records the strongest practical ideas borrowed from established founders and how they map onto Kurukoo. Public-facing copy never references these inspirations.

### Jack Ma — Informal-Economy Density & Trust
- Extreme focus on informal-economy density: maximise the number of active, multi-skilled providers per neighbourhood so supply always feels abundant.
- Physical agent networks ("Kuru Agents") are a first-class growth and onboarding channel, not an afterthought.
- Soft-claim of offline businesses: seed stationary businesses conservatively from public data and let the real owner claim and enrich the profile later.
- Trust is built through completed local jobs, not marketing claims. Every completed transaction strengthens the profile and the network effect.

### Elon Musk — Ruthless Cost Discipline & Infrastructure Mindset
- Ruthless cost discipline on presence/location and AI: precise GPS and WebRTC only on confirmed high-value moments; everything else uses the Presence Trick-Bridge and FCM.
- Hard quotas on every paid model and AI agent; money-burning features are automatically paused when quotas are hit.
- Treat the platform as long-term infrastructure, not a short-term campaign. Build the memory profile, skills schema and conversation engine to last decades, not quarters.

### Brian Chesky — Personal, Delightful Profile & Post-Job Experience
- The living memory profile should feel personal and delightful: it remembers preferences, past jobs, preferred providers and routines so every return feels like a continuation, not a restart.
- The post-job experience is a signature moment: a clean summary, easy rating, optional rebook and a warm confirmation reinforce trust and retention.
- Quiet, continuous improvement of the profile: enrichment happens in the background (catalogue import, behaviour signals, progressive onboarding) without nagging the user.

### Mark Zuckerberg — Conversation Graph & Social Loops as Growth Engines
- The conversation graph (who talks to whom, which providers get rebooked, which skills cluster together) is a first-class growth engine for matching and proactive opportunity surfacing.
- Referral and group-coordination loops must be extremely easy: one-tap referral sharing, group bookings, Buying Circles and community coordination should feel frictionless.
- Sharing is a feature, not a screen: make re-sharing a completed job, a trusted provider or a community event a single action from the chat interface.

---

## 2. Core Identity Architecture


### 2.1. One Phone = One Memory Profile

There are no separate `users`, `riders`, `providers`, `freelancers` tables. Every person is a single row in `memory_profiles`. A single person can have many skills, preferences, and roles.

Core table (hot path – always loaded):

```sql
memory_profiles (
  phone                TEXT PRIMARY KEY,
  name                 TEXT,
  display_name         TEXT,
  email                TEXT,               -- optional, secondary attribute (SSO resolution)
  full_name            TEXT,               -- populated from SSO if available
  sso_provider         TEXT,               -- 'google' | 'apple' | null
  sso_provider_id      TEXT,               -- provider-specific user ID, for audit
  email_verified_at    TIMESTAMPTZ,        -- for UK market compliance
  primary_lga          TEXT,
  primary_state        TEXT,
  country              TEXT DEFAULT 'NG',
  subscription_tier    TEXT,               -- base | plus | business
  subscription_expiry  TIMESTAMPTZ,
  points_balance       INTEGER DEFAULT 0,
  livecast_signals_remaining INTEGER DEFAULT 0,
  available_for_work   BOOLEAN DEFAULT false,
  last_active_at       TIMESTAMPTZ,
  trust_score          NUMERIC(3,2) DEFAULT 0.0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
)
```

Preferences (disciplined JSONB):

```sql
preferences JSONB DEFAULT '{}'::jsonb

-- Recommended shape:
{
  "communication_channel": "whatsapp",
  "language": "pcm",
  "audio_dialect": null,
  "primary_intent": "both",
  "marketing_opt_out": false,
  "usual_bakery": null,
  "usual_routes": [],
  "preferred_payment": ["opay", "cash"],
  "referral_code": null,
  "badges": [],
  "is_contributor": false
}
```

Behaviour signals (queryable, incremental):

```sql
user_behavior_signals (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT REFERENCES memory_profiles(phone) ON DELETE CASCADE,
  signal_type TEXT,          -- order_frequency | route | active_hour | skill_demand | price_confirm
  key         TEXT,
  value       JSONB,
  strength    NUMERIC(3,2) DEFAULT 0.5,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

CREATE INDEX idx_behavior_phone_type ON user_behavior_signals(phone, signal_type);
CREATE INDEX idx_behavior_key ON user_behavior_signals(key);
```

Real-time presence (shared by Pulse and matching):

```sql
provider_presence (
  phone           TEXT PRIMARY KEY REFERENCES memory_profiles(phone) ON DELETE CASCADE,
  is_live         BOOLEAN DEFAULT false,
  operation_mode  TEXT,               -- mobile | stationary | delivery | hybrid
  last_lat        NUMERIC(9,6),
  last_lng        NUMERIC(9,6),
  fuzzed_radius_m INTEGER DEFAULT 100,
  live_until      TIMESTAMPTZ,
  last_confirmed  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
)

CREATE INDEX idx_presence_live ON provider_presence(is_live) WHERE is_live = true;
CREATE INDEX idx_presence_location ON provider_presence USING GIST (
  ll_to_earth(last_lat, last_lng)
);
```

> **Developer note — SQLite spatial index:** The `GIST` spatial index and `ll_to_earth()` function are PostgreSQL-specific. For SQLite (current development stack), use bounding-box lat/lng range queries instead:
> ```sql
> -- SQLite proximity query (replace GIST-based query)
> SELECT phone, last_lat, last_lng FROM provider_presence
> WHERE is_live = 1
>   AND last_lat BETWEEN ? - ? AND ? + ?   -- (centre_lat - radius_deg, centre_lat + radius_deg)
>   AND last_lng BETWEEN ? - ? AND ? + ?   -- (centre_lng - radius_deg, centre_lng + radius_deg)
> ```
> The migration to PostgreSQL will enable the GIST index for efficient spatial queries. The bounding-box approach is sufficient for SQLite development and small-scale pilots.

> **Developer note — SQLite vs. PostgreSQL:** The schema above uses PostgreSQL types (`TIMESTAMPTZ`, `JSONB`, `BOOLEAN`, `BIGSERIAL`). The current codebase runs on SQLite (`sql.js`) for development. SQLite equivalents: `TIMESTAMPTZ` → `TEXT` (ISO 8601), `JSONB` → `TEXT` (JSON string), `BOOLEAN` → `INTEGER` (0/1), `BIGSERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`. The migration to PostgreSQL is a Phase 2 task; the schema is designed to be portable.
>
> **Developer note — Schema migration required:** The current `memory_profiles` table in `src/database.ts` is missing several columns defined above. When building features that depend on these columns (SSO, email, subscription auto-renewal), add them via `ALTER TABLE` migrations in `initTables()`:
> - `email TEXT` — for UK market (GDPR + formal transactions)
> - `full_name TEXT` — populated from SSO
> - `sso_provider TEXT` — 'google' | 'apple' | null
> - `sso_provider_id TEXT` — provider-specific user ID
> - `email_verified_at TEXT` — UK compliance (ISO 8601 timestamp)
> - `display_name TEXT` — separate from `name`
> - `subscription_expiry TEXT` — for auto-renewal logic
> - `available_for_work INTEGER DEFAULT 0` — boolean (code currently uses `is_available`; `available_for_work` is the canonical name)
>
> The `types.ts` `MemoryProfile` interface must also be updated to include these fields.

This table is the absolute single source of truth. The matching engine, Pulse service, Daily Picks generator, quick-reply system and AI router are forbidden from maintaining any parallel user state. All writes and all reads must go through memory_profiles + skills + messages + provider_presence + user_behavior_signals.

Recommended indexes on memory_profiles:

- CREATE INDEX idx_profiles_lga ON memory_profiles(primary_lga);
- CREATE INDEX idx_profiles_available ON memory_profiles(available_for_work) WHERE available_for_work = true;
- CREATE INDEX idx_profiles_updated ON memory_profiles(updated_at);

### 2.2. Skills Table

```
skills
  id PK
  phone -> memory_profiles.phone FK
  skill (text)
  source ("explicit" or "inferred")
  confidence (0.0-1.0)
  is_available
  operation_mode (mobile/stationary/delivery/hybrid)
  hourly_rate / price_range
  rating / jobs_completed
  equipment (JSON)
  availability_schedule
  service_radius_km
  pricing_model / payment_method
  booking_mode (on_demand/appointment)
  products (JSON array)
  business_links / business_products (JSON)
  verified_artist (boolean)
```
```
skill_flows
  skill (text), question_set (JSON)
  post_match_action (lead/appointment/trade/affiliate/escrow/emergency/bill_payment/airtime_purchase)
  payment_model (lead_fee/commission/principal_margin/peer_to_peer)
  fulfillment_instructions (chat_only/livecast_tracking/privacy_bridge_call/delivery_gig)
```

> **GenUI Alignment Note:** The `skill_flows` schema is the correct place to extend declarative UI definitions. GenUI demonstrates that conversation-aware UI generation is most effective when the card/ask structure is encoded declaratively in configuration (e.g., a `ui_schema` field on skill_flows) rather than assembled in backend code per-skill. Kurukoo should consider adding a `ui_schema` JSON column to `skill_flows` describing card types (`string`, `currency`, `select`, `timer`, `list`), data bindings, and allowed actions — enabling any configured skill to produce its own chat cards without backend code changes.
>
> **Living Memory Engine Alignment Note (Adopt Now — Bounded Working Context & Memory Lifecycle):** Kurukoo's current memory architecture stores full conversation transcripts in `messages` and derived patterns in `memory_profiles`, but sends unbounded or truncated context to the LLM. The Living Memory Engine demonstrates that **selective retrieval** — using MMR (Maximal Marginal Relevance) search across episodic memories, stable self-knowledge, open intentions, and a recent tail — produces better responses at lower token cost. Kurukoo should adopt this pattern: instead of sending full transcripts, the AI router should retrieve a bounded, diverse working context from `memory_profiles.behavior_patterns`, `inferred_roles`, and `messages`. Additionally, Kurukoo should implement the Living Memory Engine's **memory lifecycle**: decay (weak memories fade over time), reinforcement (frequently accessed patterns strengthen), pruning (irrelevant data removed), and merge (duplicate facts consolidated). This keeps profiles lean and relevant without manual cleanup. See §4.3 for the detailed architecture.

### 4.3. Memory Lifecycle & Context Selection

The memory system is not a log. It is a **selective retrieval + consolidation lifecycle** that decides what to remember, what to forget, and what to surface to the AI for each request.

#### 4.3.1. Memory Tiers

Kurukoo's memory is divided into four tiers, mirroring the Living Memory Engine architecture:

| Tier | Content | Storage | Lifetime | Example |
|------|---------|---------|----------|---------|
| **Stable Self-Knowledge** | Persistent facts about the user | `memory_profiles.inferred_roles`, `preferences`, `skills` | Permanent until explicitly changed | "User is a phone repairer", "User prefers English + Pidgin" |
| **Episodic Memories** | Past interactions and events | `messages` + derived `behavior_patterns` | 90 days (configurable per event type) | "User asked for a plumber last Tuesday", "User ordered suya every Friday for 3 weeks" |
| **Open Intentions** | Pending actions and half-expressed needs | `memory_profiles.open_intentions` (new JSON array) | TTL-based (default 7 days, max 30 days) | "User wanted to book a mechanic but didn't confirm", "User abandoned a Points top-up" |
| **Recent Tail** | Last N messages of current conversation | `messages` (last 10 messages) | Session-scoped | Current conversation context for immediate response |

#### 4.3.2. Working Context Selection (MMR Retrieval)

When the AI router needs to generate a response, it **must not** send the full conversation history or a simple truncation. Instead, it uses **Maximal Marginal Relevance (MMR)** search to build a bounded working context:

1. **Query formulation:** The current user message + inferred intent from FastText/Groq forms the query vector.
2. **Retrieve candidates:** Search across all four memory tiers for relevant items (vector similarity or keyword match, depending on tier).
3. **MMR re-ranking:** Re-rank candidates to balance relevance + diversity. This prevents the working context from being dominated by a single topic (e.g., 10 messages about plumbers) at the expense of other relevant context (e.g., the user also mentioned needing a ride).
4. **Bounded selection:** Select the top K items (configurable, default K=8) across all tiers, with a maximum of 3 items from any single tier.
5. **Assemble working context:** Combine selected items into a structured prompt for the LLM, with explicit labels for each tier.

**Token budget:** The assembled working context must not exceed 1,024 tokens for FastText-routed requests and 2,048 tokens for Groq-routed requests. This keeps AI costs bounded regardless of conversation length.

**MMR algorithm specification:**

The MMR re-ranking step (step 3 above) uses the following algorithm:
```
MMR(query_embedding, candidate_documents, lambda=0.7, budget=8):
  selected = []
  remaining = candidate_documents
  
  while len(selected) < budget and remaining is not empty:
    best_score = -infinity
    best_doc = null
    
    for doc in remaining:
      relevance = cosine_similarity(query_embedding, doc.embedding)
      
      if selected is empty:
        diversity = 0
      else:
        diversity = max(cosine_similarity(doc.embedding, sel.embedding) for sel in selected)
      
      mmr_score = (lambda * relevance) - ((1 - lambda) * diversity)
      
      if mmr_score > best_score:
        best_score = mmr_score
        best_doc = doc
    
    selected.append(best_doc)
    remaining.remove(best_doc)
  
  return selected
```

**Embeddings:** Use FastText 300-dimensional vectors (the same model as the intent classifier in §21.1). The query embedding is generated from the current user message + inferred intent. Document embeddings are generated from message text, skill descriptions, and preference keys.

**Similarity function:** Cosine similarity between FastText embeddings: `cos_sim(a, b) = dot(a, b) / (||a|| * ||b||)`

**Parameters:**
- `lambda = 0.7`: Weight relevance (70%) over diversity (30%). Higher lambda = more relevant but potentially redundant. Lower lambda = more diverse but potentially less relevant.
- `budget = 8`: Maximum items in working context. Adjust per token budget constraint.
- `max_per_tier = 3`: No more than 3 items from any single memory tier (prevents one tier dominating).

**Storage mapping (explicit):**
| Tier | Source Table/Column | Embedding Source |
|------|---------------------|------------------|
| Stable Self-Knowledge | `memory_profiles.inferred_roles`, `preferences`, `skills` (skill tags) | FastText embedding of skill name + role description |
| Episodic Memories | `messages` (last 90 days, non-system messages) | FastText embedding of message text |
| Open Intentions | `memory_profiles.open_intentions` (JSON array) | FastText embedding of `intent` + `context` fields |
| Recent Tail | `messages` (last 10 messages, all types) | FastText embedding of message text (always included, bypasses MMR) |

#### 4.3.3. Memory Lifecycle Operations

Memories are not static. They undergo continuous lifecycle management:

| Operation | Trigger | Action | Storage Impact |
|-----------|---------|--------|----------------|
| **Decay** | Cron job, daily | Reduce `access_count` and `relevance_score` for memories not accessed in 30+ days | Memories with score < threshold are marked `dormant` |
| **Reinforcement** | Every access | Increment `access_count`, boost `relevance_score` | Frequently accessed memories stay in active pool |
| **Pruning** | Cron job, weekly | Delete `dormant` memories older than 90 days (or configured TTL) | Reduces `messages` table size; keeps `behavior_patterns` lean |
| **Merge** | On new memory creation | If new memory is >90% similar to existing memory, merge instead of create | Prevents duplicate entries for the same fact |
| **Crystallize** | On pattern detection | If a behavior pattern is observed 5+ times, promote from episodic to stable self-knowledge | Moves fact from `messages`/`behavior_patterns` to `inferred_roles` or `preferences` |

**Implementation:** All lifecycle operations run as background cron jobs with zero user-facing latency. They operate on `memory_profiles` and `messages` tables directly.

**Decay formula (explicit):**
```
relevance_score = relevance_score * decay_factor

where decay_factor = exp(-lambda * days_since_last_access)

and lambda = 0.01 (configurable, stored in trade_config or commission_config)
```
- `days_since_last_access`: Days since the memory was last retrieved by the working context selector.
- At 30 days: `decay_factor = exp(-0.01 * 30) = 0.74` (26% reduction)
- At 60 days: `decay_factor = exp(-0.01 * 60) = 0.55` (45% reduction)
- At 90 days: `decay_factor = exp(-0.01 * 90) = 0.41` (59% reduction)
- Memories with `relevance_score < 0.2` (configurable threshold) are marked `dormant`.
- Decay runs daily at 3:00 AM via cron. Only processes memories not accessed in 30+ days.

**Crystallize trigger definition (explicit):**
A "behavior pattern observation" is a record in `user_behavior_signals` with `signal_type = 'skill_demand' | 'order_frequency' | 'route'` that has been recorded 5 or more times within a 30-day window. When this threshold is met:
1. The pattern is promoted from `user_behavior_signals` to `memory_profiles.inferred_roles` (if it represents a new role/skill) or `memory_profiles.preferences` (if it represents a preference like "usual_bakery").
2. The original `user_behavior_signals` entries are marked `crystallized = true` (new column) to prevent re-promotion.
3. The promotion is logged to `ai_audit_log` for auditability.

**Merge similarity threshold:** Two memories are considered duplicates if their FastText embedding cosine similarity > 0.90. The older memory's `access_count` is added to the newer one, and the older memory is deleted.

#### 4.3.4. Open Intentions (Prospective Memory)

Open intentions are Kurukoo's implementation of prospective memory — the ability to remember to do something in the future.

**Schema addition to `memory_profiles`:**
```json
{
  "open_intentions": [
    {
      "id": "uuid",
      "intent": "book_plumber",
      "context": "User asked for a plumber but didn't confirm a time",
      "created_at": "2026-07-31T10:00:00Z",
      "expires_at": "2026-08-07T10:00:00Z",
      "ttl_days": 7,
      "resolution": "pending|resolved|abandoned|expired",
      "resolution_note": "User booked on 2026-08-01",
      "reminder_count": 0,
      "max_reminders": 3
    }
  ]
}
```

**Lifecycle:**
1. **Creation:** When the AI detects an incomplete request, abandoned cart, or half-expressed need, it creates an open intention with a TTL (default 7 days, max 30 days).
2. **Reminders:** The Opportunity Engine (§33) checks open intentions daily. If `resolution = pending` and `expires_at > now()`, it sends a contextual nudge: "Last week you asked about a plumber. Still need one?"
3. **Resolution:** When the user completes the action, the intention is marked `resolved` with a note. If the user explicitly declines or the TTL expires, it is marked `abandoned` or `expired`.
4. **Cleanup:** Expired/abandoned intentions older than 30 days are pruned by the memory lifecycle cron.

**Rules:**
- Maximum 5 open intentions per user at any time (prevents notification spam).
- Open intentions are included in the working context selection (§4.3.2) so the AI can reference them naturally: "I see you were looking for a plumber last week. Want me to find one now?"
- Open intentions are never shown to the user as a task list. They are only surfaced as contextual nudges within the conversation.

#### 4.3.5. Explainability & Auditability

Every AI response that uses memory retrieval must log:
- Which memory tiers were queried
- Which items were selected for the working context (with relevance scores)
- Which items were available but not selected (and why)
- The assembled working context (stored in `ai_audit_log` table)

This log feeds the "Working Context" inspector in the Admin Console (§38) and satisfies §41 auditability requirements.

**`ai_audit_log` table schema (SQLite-compatible):**
```sql
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  request_text TEXT,
  tiers_queried TEXT,          -- JSON array: ["stable","episodic","open_intentions","recent_tail"]
  context_selected TEXT,       -- JSON array of selected items with relevance scores
  context_available TEXT,      -- JSON array of available-but-not-selected items with reasons
  working_context TEXT,        -- assembled context string sent to LLM
  response_text TEXT,
  model_used TEXT,             -- 'fasttext' | 'groq' | 'template' | 'regex'
  token_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_phone ON ai_audit_log(phone);
CREATE INDEX idx_audit_created ON ai_audit_log(created_at);
```

#### 4.3.6. Implementation Priority

| Phase | Component | Description |
|-------|-----------|-------------|
| **Phase 1** | Bounded working context | Replace full-context sends with MMR retrieval from `memory_profiles` and `messages`. Token budgets: 1,024 (FastText) / 2,048 (Groq). |
| **Phase 2** | Memory lifecycle | Implement decay, reinforcement, pruning, merge, and crystallize as background cron jobs. |
| **Phase 3** | Open intentions | Add `open_intentions` array to `memory_profiles`. Integrate with Opportunity Engine (§33) for contextual nudges. |
| **Phase 4** | Working Context inspector | Build admin console debug panel showing per-request context selection with relevance scores. |

### 2.2.1. Unified Memory Profile
The real intelligence is in the memory: it learns who you are, what you do, and what you need, then proactively creates opportunities, connects you to trusted providers, and keeps your data and identity private.

### 2.3. Multi‑Skilled Identity – Every Nigerian Has Many Hustles
### 2.3.1 The Reality
A single Nigerian might be:
- A rider (okada) in the morning
- A phone repairer in the afternoon
- A suya seller at night
- A landlord with a room to rent
- A bricklayer on weekends

Kurukoo's skills table already supports unlimited skills per user. Now we make this the core identity.

### 2.3.2 WhatsApp Profile = Business Profile
When a user onboards via WhatsApp, Kurukoo can:
- Read their WhatsApp Business profile (category, description, catalogue) with permission.
- Infer initial skills: "Salon" → hairdresser; "Repairs" → phone_repairer.
- Ask: "We see you're a hairdresser. Want to appear when someone nearby needs braiding? Reply YES."
- Store these inferred skills with source = "whatsapp_profile" and medium confidence.

### 2.3.3 Opportunity Matching Across All Skills
Because one user has multiple skills, they appear in multiple matching pools:
- The same person could be offered a ride job, a phone repair gig, and a suya order – all in one day.
- The memory profile's dashboard shows all active opportunities across all their skills.
- The system prioritizes showing the highest‑earning opportunities first.

### 2.3.4. Mobile Skills Identification
All skills that can benefit from Kuru Pulse because the provider moves through public space. We’ll maintain this as a living taxonomy in the blueprint, grouped by category.

Category	Skills / Job Titles (Nigeria)
Food & Produce Hawkers	Orange hawker, banana hawker, groundnut hawker, tiger nut seller, suya man (mobile), akara seller, puff‑puff seller, bread hawker, sachet water hawker, zobo seller, kunu seller, roasted corn seller, boiled egg seller, coconut seller, sugarcane seller
Street Food Vendors	Mobile food cart (noodles, rice), tea/coffee vendor, popcorn seller, ice cream bicycle, snacks hawker
Transport & Mobility	Okada rider, Keke NAPEP (tricycle) rider, bicycle taxi, car taxi (informal), shuttle driver, motor park tout (bus loader), truck pusher, wheelbarrow boy (goods transport), delivery rider (dispatch)
Repair Services (Mobile)	Phone repairer (roadside), shoe repairer (cobbler), watch repairer, bag mender, bicycle repairer, generator repairer, knife/scissor sharpener, umbrella repairer, furniture repairer (roadside carpenter)
Personal & Household Services	Barber (mobile), hairdresser (home service), makeup artist (travelling), manicurist, laundry man (collects/delivers), house cleaner (peripatetic), plumber (on‑call), electrician (on‑call), welder (roadside), mechanic (roadside), vulcaniser (roadside)
Goods & Sundries Hawkers	Clothes seller (bend‑down select), shoe seller, bag seller, sunglass seller, perfume seller, household plastic ware, kitchen utensils, mobile phone accessories, recharge card seller, books/newspapers
Agriculture & Livestock	Egg seller, chicken seller (live), fish hawker, meat seller, vegetable hawker (leafy greens), fruit hawker, seedling seller, manure/fertiliser seller (small scale)
Artisans & Craft Workers	Basket weaver, mat weaver, calabash decorator, bead maker, leather worker, blacksmith (mobile sharpener), gold/silver polisher
Entertainment & Spiritual	Street musician, preacher, traditional healer (mobile), aladura (itinerant prophet), beggar (alms collector)
Specialised Services	Key cutter (mobile), stamp maker, survey plan draftsman (roadside), letter writer, form filler (JAMB, passport), photographer (roaming), video coverage (events)

## 3. Intelligent Onboarding

- First contact (any channel): *“Welcome! What’s your name?”* stored in memory -  No big registration form.
- Usage teaches roles: after 3 food orders, customer inferred.
- Proactive prompts: You order a lot. Want to earn? Nearby people need [skill]. After accepting a few gigs of a certain type → the system prompts: *“You seem to do a lot of bicycle repairs. Add it as a skill so people can find you?”*
- Skill declaration: Users claim/declare skills anytime via USSD, in-app conversation or by toggling “Available for work.
- Inference: System infers skills from repeated behaviour and prompts user to confirm.
- Business users can share links (social media, WhatsApp catalogue) and Kurukoo will scrape product info, populate their storefront, and proactively engage them.

### 3.1. Intelligent Onboarding Trigger Map

The onboarding engine is a lightweight state machine running inside the unified conversation. No form. No multi-screen wizard. Three stages, one question at a time.

**Stage 1 -- Identity capture (first contact, any channel):**
"What's your name?" goes to memory_profiles.name. No email, no structured form. Single question.

**Stage 2 -- Intent detection (second interaction):**
AI router classifies the first real request as Find / Earn / Both. Stored in memory_profiles.inferred_roles. This drives:
- Dashboard panel selection (Section 12)
- Quick-reply set (Section 13.4)
- Default skill suggestions

**Stage 3 -- Skill inference (ongoing, after pattern detected):**

| Trigger | Data Point | Storage | Confidence | Action |
|---------|-----------|---------|------------|--------|
| 3rd food order, same category | preferences.usual_bakery (vendor, food type) | memory_profiles.preferences JSON | N/A | Store silently |
| 5th same route | behavior_patterns.commute (origin, destination, time) | memory_profiles.preferences JSON | N/A | Store silently |
| 3 gigs in same skill | Promote skills[skill] from inferred to explicit | skills.source = explicit | 1.0 after YES | One-tap confirmation prompt |
| 30 days inactive | Schedule re-engagement nudge | sent_questions flag | N/A | Push + WhatsApp |
| Wallet balance < 200 Points | Low-balance warning | wallet_balance_pence | N/A | Dashboard + push |
| Sunday + known bakery | Reorder suggestion | Opportunity Engine | N/A | Chat prompt |
| liveCast signals <= 5 in 7 days | Reminder to Go Live or Boost | Opportunity Engine | N/A | Chat prompt |

**Skill promotion flow:** Kurukoo sends: "You've done 3 bicycle repairs this month. Add it as a skill?" User replies YES -> skills.source flips to explicit, confidence = 1.0. NO or no reply -> stays inferred at 0.6, ranked below explicit skills. Max 1 prompt per skill per 30 days.

**Proactive nudge cadence:** Max 1 nudge per user per day. Ranked by (user_need_match * urgency * recency). Delivered via the unified conversation thread.

**Business user onboarding:** Share WhatsApp Business catalogue URL -> Catalog Scraper (Section 9) imports products into skills.products + skills.business_products -> Kurukoo prompts: "We found 12 items in your catalogue. Show them?" Only automated profile population beyond manual declaration.

### 3.2 Unified Onboarding Gateway Modal and Campaigns
To align with high-growth acquisition cycles, the Kurukoo PWA incorporates a highly optimized **Unified Onboarding Gateway Modal** (`views/_partials/onboarding-modal.ejs`).
- **First 1,000 Users Promo:** Features a real-time campaign banner incentivizing users to complete pre-registration to lock in lifetime 100% free USSD and WhatsApp session coverage.
- **Goal-Adaptive Interface:** The modal dynamically adjusts its inputs and layout depending on the selected user path (Consumer vs Business Seller).
- **Integrated Live Channels:** Users can choose from:
  1. **Web App (PWA):** Zero-friction offline-first experience.
  2. **WhatsApp Assistant:** Direct link with pre-filled message templates. Highlights the FCM Keep-Alive explanation for smartphone users.
  3. **Alternative Free Bots:** Offers one-click routing to Telegram, Facebook Messenger, Instagram DM, or TikTok Chat bots.
  4. **USSD Code (`*7000#`):** Direct USSD flow rendering success panels with OTP codes.
- **Custom Business Configuration:** Business sellers are presented with additional toggles to provision custom self-hosted business lines or purchase assisted contributor activations.

---

## 4. Skills-Based Request Matching (The Unified Skill‑Flow Engine)

There is ONE generic handler: `find_worker`. It works identically across WhatsApp, voice, PWA, and USSD. Every user request is a skill tag. The `skill_flows` table configures the pre‑match questions, post‑match action, payment model, and fulfilment instructions. All old USSD module files are deleted.
Requests are no longer "Category Subcategory Item". They are: I need [skill] near [location].
1. User posts a request via channels.
2. System extracts a skill tag (selected or AI-inferred).
3. Queries skills for available providers nearby.
4. Matched providers get a push/SMS notification.
5. First to accept locks the job.
6. If no match, request becomes an open gig visible to all.
>
> **Kokoro-Engine Alignment Note (Future — Workflow Abstraction):** Kurukoo's discrete tool calls (`find_worker`, `awardPoints`, `dispatch`) should be composed into named, versioned **workflows** stored in `skill_flows` metadata — e.g., `onboarding.confirm_flow_v2`, `dispatch.principal_trade_v1`. A workflow abstraction layer would let complex multi-step user journeys (onboarding trees, USSD sessions, courier dispatch with compensation) be defined declaratively in the database rather than scattered across handler code. Each workflow gets a stable `workflow_id` and `version`, enabling A/B testing and instant rollback without redeployment. The existing `skill_flows.question_set` JSON arrays are the seed of this pattern; they should be generalised into full workflow graphs (sequential, conditional, parallel, pause, compensate nodes). This aligns Kurukoo with the Kokoro-Engine pattern of workflow-driven orchestration and makes the platform more maintainable and auditable. **Status: Future** — no implementation yet. Requires a dedicated workflow engine specification with a workflow graph DSL (JSON format), node types (sequential, conditional, parallel, pause, compensate), execution engine design, and versioning/rollback mechanism before implementation can begin.

> **MCP Alignment Note (Future — MCP Server Pattern):** Kurukoo should expose its core capabilities as MCP (Model Context Protocol) tools — `find_worker`, `activate_pulse`, `check_balance`, `referral_track`, `dispatch_provider`, `get_daily_pick` — as a standardised MCP server. This would allow any MCP-compatible AI assistant (Claude, ChatGPT, etc.) to programmatically access Kurukoo's matching engine, Pulse, Points economy, and provider network. The existing `skill_flows` table and `find_worker` engine (§4) already provide the read-layer; the MCP server would expose them as discoverable, typed tools with JSON schemas. This positions Kurukoo as an MCP *provider* — making its platform accessible to the broader AI ecosystem. **Status: Future** — no implementation yet. Requires a dedicated MCP server specification with tool schemas (JSON Schema for each tool's input/output), transport (stdio, SSE, WebSocket), auth model, and error handling before implementation can begin.

### 4.1 The Discovery Engine: Dual‑Mode, AI‑First

Kurukoo does not make users hunt for things. It combines two discovery modes in a single conversation.

| Mode | Trigger | Flow |
|------|---------|------|
| **Reactive (User‑Initiated)** | User speaks or types a request in natural language. | AI Router processes the request, extracts skill and location, and returns a curated set of options directly in the chat. |
| **Proactive (Kurukoo‑Initiated)** | Memory profile detects an opportunity — a job matching a skill, a hawker nearby, a price drop. | Kurukoo sends a push notification or a chat message: *“A plumber is needed near you. Accept?”* |

All interactions flow through a single, persistent conversation thread that spans channels. The user never fills a search box — they just speak or type, and the system responds.

### 4.2. On-Demand vs Delayed Services

Users can choose — or the system can suggest — between two fulfilment timings:

- **"I need it now" (on-demand):** matching runs immediately, targets live/nearby providers, short TTL on the request, real-time Pulse nudge if a mobile provider is available. Used for rides, urgent repairs, food, errands, emergencies.
- **"Find me someone in the next 2 hours / tomorrow / this week" (delayed):** the request is queued and matched against providers' declared availability schedules, price confirmation and route patterns from the memory profile. Notifications are batched and delivered at the right time. Used for appointments (doctor, tutor, hairdresser), scheduled cleanings, event bookings, pre-orders.

Both modes write to the same memory profile and the same conversation thread. The matching, notification and fulfilment logic branches cleanly on a `timing_mode` field (on_demand | scheduled) stored on the request, so the engine never confuses an urgent job with a planned one.

### 4.1.3. Deferred Request Protocol — Handling Unavailable Requests

When a user makes a request and no suitable provider is available (new geography, niche skill, off-hours, or temporary unavailability), Kurukoo does not simply say "no" or leave the user hanging. The system enters a **Deferred Request Protocol** that keeps the user engaged, sets clear expectations, and actively attempts to fulfill the request over time — all within the same conversation thread.

#### States

| State | Meaning | Behavior |
|-------|---------|----------|
| `requested` | User requested a service | Immediate availability check |
| `awaiting_match` | No provider currently available | System will retry matching periodically |
| `partially_matched` | Some criteria matched (e.g., provider found but schedule conflict) | Options offered; retry on sub-conditions |
| `fulfilled` | Request completed | Resolution summary in conversation |
| `abandoned` | User disengaged / request expired | Conversation archived; profile updated |

#### Lifecycle States & Transitions

| Trigger | From → To | Action |
|---------|-----------|--------|
| No provider found | `requested` → `awaiting_match` | Acknowledge delay; explain why; store request as Open Intention (expires 7 days); notify user with expected resolution window |
| Retry condition met (provider comes online / new provider joins / scheduled slot opens) | `awaiting_match` → `partially_matched` or `matched` | Send proactive nudge via FCM + WhatsApp keep-alive: "A new {skill} provider is now available in your area. Would you like me to connect you?" |
| Provider availability changes | `partially_matched` → `matched` | Confirm new slot with user before committing |
| User accepts | `matched` → (standard escrow flow via §33) | Proceed to Transaction Orchestration Engine |
| User declines / no response | `awaiting_match` → `awaiting_match` | Continue monitoring; next retry in 24h increments |
| Expiration (7 days) | `awaiting_match` → `abandoned` | Final message to user with workaround options; archive conversation; update memory profile with intent decay |

#### Technical Implementation

1. **Open Intentions storage:** Deferred requests are stored as Open Intentions in `memory_profiles.open_intentions` (JSON array), keyed by phone + request_id, with:
   - `expires_at` (7-day TTL)
   - `retry_check_ins` (array of timestamps for next checks)
   - `attempt_count` (for exponential backoff)
   - `original_context` (skill, location, timing, preferences)

2. **Monitoring agents:** Two cron jobs operate in parallel:
   - **Re-evaluation cron** (runs every 2 hours): re-runs `find_worker` for all `awaiting_match` requests within 30km. If a match is found, transitions to `partially_matched` and triggers proactive notification.
   - **Expiration cron** (runs nightly): expires requests past 7 days, sends final outreach message, archives.

3. **Proactive notification:** When a match becomes available, the system sends:
   - **FCM push:** "Kurukoo found a {skill} provider near you — tap to reconnect."
   - **WhatsApp keep-alive:** Bot message with "Yes, connect me" / "Later" / "Expand search radius" quick replies.

4. **User controls:** At any point, the user can say:
   - "Check again in {X} hours/days" → reschedules retry
   - "Expand to nearby LGAs" → widens search radius in the stored Open Intention
   - "Cancel this" → transitions to `abandoned` immediately
   - "Find {alternative skill}" → creates a new `requested` entry

5. **Fallback pathways (after 3 days unfulfilled):**
   - **Community board:** "Post this to Kuru Circle — community members can volunteer"
   - **Price adjustment:** "I can find someone if you're flexible on price/time"
   - **Manual escalation:** "I'll connect you to a Kurukoo agent who can help"

#### Integration with Memory Profile

The Deferred Request Protocol reinforces the single-memory-model mandate. Every deferred request:
- Is readable from the memory profile (so the AI knows "this user has been waiting for a roof welder")
- Updates behavior_patterns when fulfilled/abandoned ("user frequently needs niche welders — prioritize roof welders in Daily Picks")
- Surfaces open intentions to the Proactive Opportunity Engine (§33) for context-aware nudges
- Increments a `deferred_attempts` counter on the profile for trust-score adjustment (too many abandoned requests may indicate unclear expectations or scam risk)

#### Aggregate Social Proof (Time-Bounded, Privacy-Preserving)

To maintain user confidence during deferral, Kurukoo surfaces **aggregate, time-bounded social proof** rather than exposing individual user identities:

- **Display examples (safe, non-gaming-friendly):**
  - *"100+ people searched for plumbers in Ikeja today"*
  - *"500+ users booked rides in Surulere this week"*
  - *"15 hawkers are active near you right now"* (from `provider_presence` real-time layer)
- **Source data:** Aggregated `find_worker` query logs (24h/7d/30d windows) and `provider_presence` counts — written to `memory_profiles` only at aggregate level, never as PII.
- **Privacy:** Counts are computed server-side with **phone-hash masking** (no PII), then cached via `cacheGet()` (§47) with a 30-minute TTL.
- **Refresh cadence:** Daily cron rolls 24h → 7d; weekly cron rolls 7d → 30d (never stale beyond the window).
- **What it replaces:** No raw page-views/users-online meters (high gaming risk); instead contextual *"X people searched for this today"* tied to the **actual demand signal** from the deferred queue.
- **Display surfaces:** Deferred-request acknowledgment message, proactive re-match notification, provider card footers, and Daily Picks context line above each card.

This protocol ensures that even when immediate fulfillment isn't possible, the user receives a **transparent, actively-managed experience** — reinforced by social proof — that aligns with Kurukoo's promise: *"One conversation. Everything you need."*

---

## 5. Kuru Pulse & Presence Trick-Bridge

Kuru Pulse is the real-time discovery layer for mobile and stationary providers. It is powered by a single shared presence service (provider_presence table).

**Presence Trick-Bridge (cost-effective continuous feel)**

- Default Pulse state = discoverable flag + last-known or last-confirmed location + schedule.
- Stationary providers (restaurants, barbers, shops, agents): treated as live according to declared opening hours or the last time they replied to a gentle "Are you open today?" push that arrives as a pre-filled chat message. Map pin stays alive with a soft expiry (30–90 minutes) and visual "last confirmed X mins ago". No continuous GPS or WebRTC required.
- Mobile providers: location updated on a smart interval (every 80–150 metres of movement OR every 3–8 minutes of continuous movement, whichever comes first, with exponential back-off when stationary). The platform interpolates the path on the map so it looks continuous to the user.
- Expensive precise GPS or short-lived WebRTC data channel opens only for high-value windows: user accepted a nudge, active delivery/errand, or explicit "share live location for this job".
- Presence records expire aggressively (TTL 5–15 minutes of inactivity) and are cleaned by background job.

This Trick-Bridge gives the feeling of continuous real-time Pulse while keeping battery impact and TURN/relay costs near zero most of the time. The same mechanism is used for fixed agents, sales consultants and static points of interest.

Hybrid transport rule:

- FCM / push is the always-on trigger for nudges and re-engagement.
- Short-lived WebRTC data channel or GPS fix is used only after user intent is confirmed or during an active job.
- Vibration / sound of a nudge is controlled by the user's existing phone notification settings; the platform cannot force vibration if the user has disabled it.

Kuru Pulse and the skills-matching engine share the exact same real-time presence layer. A provider who is live on Pulse is immediately queryable by find_worker. There is only one presence service.

liveCast is a location broadcast feature (Kuru Pulse), NOT ride-hailing. Subscribers broadcast their need to nearby providers. The user action is described as sending a liveCast signal or broadcasting their location - a signal-like action, not a free ride.

| User Type | liveCast Allowance | Details |
|-----------|-------------------|---------|
| Subscribed riders | 30 signals/month | Included in subscription |
| Unsubscribed users | 3 free signals lifetime | Then must subscribe |
| Drivers/providers | N/A (receive signals) | Pay per-accepted lead after 2-month trial |

- Driver lead charge: 50 Points per accepted liveCast, starting month 3.
- Ride fare: Direct transaction between rider and driver. Kurukoo never handles ride payments.
- Technology: Internal location-broadcast mechanism is called liveCast.

### 5.1 live Cast realistic transcript:

- User: [taps Get Lift] 
kukuroon: shows user options to select ride type
- User: [ selected Bike] →  liveCast signal is broadcasted to all nearby drivers
kukuroo: Searching for a driver near you...
kukuroo: 🛵 Emeka (Bike) is on the way! ETA: 4 mins.
[Location pin of Emeka appears on a map]
User: [taps map] → sees Emeka moving towards pickup (webRTC for live tracking)
kukuroo: Emeka is arriving at your pickup spot.
kukuroo: Ride completed. Please rate Emeka: 1-5 stars.

---

### 5.1. Kuru Pulse Monetisation

- Go Live: 5 Points per 30-minute block. Deducted on activation and every 30 min until offline. Warning if balance too low.
- Nearby mode: Free (passive discovery). No Points deducted.
- pulse_sessions table tracks active sessions. canActivatePulse() checks operation_mode (mobile/delivery/hybrid) and service_radius_km.
- Eligibility: Only mobile/delivery/hybrid providers can Go Live. Stationary providers see option as unavailable.

Cross-references: Skills-Based Matching in Section 4. Seller Onboarding in Section 9. Negative Reviews in Section 25. Content previously under Section 42 specific to those domains now lives there.

---

## 6. Channel-Agnostic Access

### 6.1 Channel Taxonomy

| Channel | Role | Tier | Platform Dependency | Rationale |
|---------|------|------|---------------------|-----------|
| **WhatsApp Cloud API** | Acquisition + daily engagement | **Primary** | HIGH - Meta controls API | 95% of Nigerian smartphone users; lowest friction; highest response rates |
| **USSD *7000#** | Feature-phone fallback + resilience | **Primary** | LOW - telco-controlled | 60-70% of Nigerian adults use feature phones; no data required; works during internet shutdowns |
| **PWA** | Owned digital channel + retention | **Primary** | NONE - Kurukoo-owned | No app download; works on any smartphone browser; Kurukoo controls the infrastructure |
| **SMS** | Notifications + simple commands | **Secondary** | LOW - telco-controlled | Universal (every phone); high delivery rates; works when data fails; expensive but critical for transactional alerts |
| **Telegram** | Secondary chat + developer/agent community | **Secondary** | MEDIUM - Telegram API | Lower cost than WhatsApp; growing in Africa; good for agent network coordination and tech-savvy users |
| **Email** | Formal communications + UK market | **Secondary** | LOW - standard SMTP | UK users expect email; needed for receipts, contracts, formal disputes; low engagement for conversation but high trust for transactions |
| **IVR/Voice** | Low-literacy users + hands-free | **Tertiary** | MEDIUM - telco-controlled | Okada riders cant type while riding; elderly users prefer voice; USSD + voice covers the bottom of the pyramid |
| **iMessage/Apple Business Chat** | UK market | **Tertiary** | MEDIUM - Apple-controlled | Expected by UK consumers; higher trust than SMS. **Cost:** Per-conversation fees (negotiated with Apple). **Enable only for Business tier UK users.** Not a priority for MVP. |
| **Web Widget** | B2B embed for businesses | **Tertiary** | NONE - Kurukoo-owned | Allows businesses to offer Kurukoo on their own websites without leaving their brand. See §32.13 for feature tiers and monetisation. |
| **MCP (Model Context Protocol)** | AI-to-platform programmatic | **Emerging** | LOW - open protocol | Zero marginal cost; allows external AI assistants to interact with Kurukoo programmatically |

> **MCP Alignment Note (Watch - Emerging Channel):** MCP represents an emerging programmatic channel that is not user-facing but rather AI-to-platform. As the MCP ecosystem grows, Kurukoo should monitor whether MCP gains adoption as a standard for AI-driven tool integration. If it does, adding an MCP server would allow any MCP-compatible AI assistant to interact with the platform - effectively making Kurukoo's entire capability set accessible through natural language via external AI. This is not an immediate implementation priority, but the architecture should keep this in mind: the existing REST API surface (§29) is already MCP-compatible in structure and could be wrapped with minimal effort.

> **Kokoro-Engine Alignment Note (Watch - Multi-Channel Workflow Handoff):** Kokoro-Engine supports routing workflow steps across channels - starting a session on USSD, continuing on WhatsApp, completing in PWA. Kurukoo is already channel-agnostic (§6) but does not yet orchestrate cross-channel session continuity at the workflow level. Monitor Kokoro-Engine's channel-routing primitives; when §6 is expanded to cover cross-channel session handoff, Kokoro-Engine's pattern can serve as the reference architecture for stitching a single workflow instance across Africa's Talking USSD, WhatsApp Cloud API, and PWA without losing state.

**Push-first architecture:** FCM push is the primary notification channel (free). User-initiated WhatsApp messages are free (deep-link from push). Paid WhatsApp templates are a last resort, used only when push and user-initiated WhatsApp are unavailable. SMS is only for feature-phone users without push.

All channels feed the same backend: memory profile, skills matching, Points engine, AI router. The unified `messages` table stores all conversations, making the PWA chat a perfect mirror of the WhatsApp thread. WhatsApp messages now include a typing indicator (sent before processing begins, stopped after reply) to improve user experience.

### 6.1 Unified Message History
All channels (WhatsApp, PWA, USSD, SMS, Telegram, Email) write to the `messages` table via `saveMessage()`. The PWA loads the last 50 messages from all channels on startup. Conversation history is preserved for 12 months before automated purging. Temporary anonymous sessions expire after 7 days. Location history is purged after 30 days.

### 6.1.1. Unified history for all channels
The chat shows all messages from all channels (WhatsApp, PWA, USSD, Telegram, Email). This is already in the messages table; the PWA just needs to display it.


### 6.2 Channel Contingency Plan — "If WhatsApp Dies"

**Scenario A: Graduated Restrictions (Most Likely)**
- WhatsApp raises API prices → Kurukoo shifts volume to PWA + USSD
- WhatsApp restricts use cases (e.g., no more classifieds/marketplace) → Kurukoo moves transactional flows to PWA, keeps conversational flows on WhatsApp
- WhatsApp delays/limits message delivery → Kurukoo uses SMS as primary notification, WhatsApp as secondary

**Scenario B: Complete Offboarding (GovChat-style, Unlikely but Possible)**
- **Immediate response:** PWA becomes primary; USSD handles feature phones; SMS handles notifications
- **User communication:** "Kurukoo is now available on your browser and via *7000# — your data and Points are safe"
- **Migration path:** WhatsApp chat history is preserved; users continue where they left off on PWA
- **Acquisition pivot:** Use SMS + USSD to re-engage users on owned channels

**The golden rule:** By the time any channel crisis hits, users must already have direct access via PWA (browser bookmark) + phone number. WhatsApp is a notification layer, not the relationship owner. The relationship is with Kurukoo, not WhatsApp.

**Channel mix targets:**
- **Launch (Nigeria):** WhatsApp 70%, USSD 20%, PWA 10%
- **Maturity (18 months):** WhatsApp 40%, PWA 35%, USSD 15%, SMS 10%

one persistent conversation per user that seamlessly spans WhatsApp and the Kurukoo app, with near‑zero communication costs.

This conversation is not a messaging feature; it is the primary and only interface of the platform. Every other capability (Pulse, matching, tokens, Daily Picks, ratings) is expressed inside this conversation.

### 6.2.1. Core Insight: The Conversation Is the Interface

Every Kurukoo user has a **single, ongoing conversation** with the platform. It starts on WhatsApp (or inside the PWA) and never really ends. The same chat history, the same memory profile, the same intelligent responses — regardless of whether the user is on WhatsApp, our PWA, or even USSD.

This means:

- **No separate “onboarding” then “requests” then “notifications”.** It’s all one thread.
- **The conversation window on WhatsApp stays open** as long as the user keeps engaging, so we pay at most one fee per long‑running interaction.
- **If the user deletes the WhatsApp chat**, they can pick up the conversation inside the Kurukoo app instantly — no new WhatsApp fee triggered.

### 6.2.2. WhatsApp Integration — Technical Blueprint

#### 6.2.2.1 Setup
- Meta Business Account with dedicated phone number.
- Cloud API access (Permanent Access Token, Phone Number ID).
- Webhook endpoint: `POST /api/whatsapp/webhook`.
- Verify token and HMAC signature validation.

#### 6.2.2.2 Inbound Message Flow
1. User sends a message to Kurukoo’s WhatsApp number.
2. Meta forwards it to our webhook.
3. `whatsappService.ts` extracts sender phone, text, and any interactive payload.
4. The message is stored in the unified `messages` table.
5. The text/payload is passed to `aiRouter.classifyIntent()`.
6. The resulting intent is processed by the existing request matching engine.
7. A response is generated (text or interactive template) and sent back via the Cloud API **and** stored in `messages`.

#### 6.2.2.3 Interactive Menus (Replaces complex USSD flows)
We use the Cloud API’s **interactive message templates**:

- **Quick Reply Buttons** – up to 3 options per message.
- **List Messages** – up to 10 selectable items.
- **Call‑to‑Action Buttons** – single action like “Accept Job”, “Track Order”.

Example flow:
> Kurukoo: *What do you need?*
> [Order Food] [Get a Ride] [Find a Worker] [Emergency]
> User taps “Find a Worker”
> Kurukoo: *What type of worker?*
> • Plumber • Electrician • Carpenter • Other

This is a full, dynamic UI, built and controlled entirely by our server.

#### 6.2.2.4 Conversation Window & Cost Management

- A **conversation** is a 24‑hour window that opens when a business message is delivered.
- If the **user replies**, the window resets (another 24 hours) **within the same conversation** — no additional fee.
- We only pay when a window closes and we later start a new one.
- **Free tier:** 1,000 conversations/month — enough for pilot.
- **Paid tier:** ~$0.005–$0.03 per conversation (utility/business rate).
- **Strategy:** Keep windows alive by encouraging user replies (a simple “Reply YES to confirm” every few days). Avoid business‑initiated proactive messages unless absolutely necessary.

**Cost for a user who engages daily for a month:** potentially **one single conversation fee** (if they never let the window close). Realistically, maybe 2–3 fees if they occasionally miss a day. Total: ~₦50–₦150/month — far cheaper than SMS.

#### 6.2.2.5. Interaction Patterns (Voice‑First, Offline‑First)

- **Voice:** The microphone button is always present. Long‑press to speak, release to send. System responds in the same language (Hausa, Yoruba, Igbo, Pidgin, English).
- **Offline:** The PWA caches the core UI and queues actions. When connectivity returns, actions are synced and a subtle “All caught up!” notification appears.
- **Haptic feedback:** Subtle vibrations on key confirmations (Ride accepted, job completed, payment received).

### 6.2.3. In‑App Chat (PWA) — The Free Mirror

Inside the Kurukoo PWA, we build a simple chat UI that displays the **identical conversation** as WhatsApp. It pulls messages from the same `messages` table.

#### 6.2.3.1 In‑App Chat (PWA) -How It Works
- User opens the PWA → chat screen appears.
- `GET /api/conversation?phone=...` returns full message history.
- User types a message → `POST /api/conversation` → backend processes it just like a WhatsApp message.
- If the user’s preferred channel is `pwa`, the reply is delivered directly in‑app (no WhatsApp cost).
- If the user’s preferred channel is `whatsapp`, the reply is also sent via WhatsApp (but if we’re still in the same window, no extra cost).

##### 6.2.3.1.1 In‑App Chat (PWA) Enhancements

Add a hamburger menu in the top-left of the chat window that opens a side drawer with:
   - Conversation history (past sessions)
   - Saved items
   - "New Request" button
   - "Settings" button (communication preferences, language, etc.)
   - Ensure inline interactive cards (Ride, job proposal, product listing) render correctly in the chat.
   - Add a "Send Feedback" button to the side drawer.
   - Add a "Report a Bug" button to the side drawer.
   - Add a "Help" button to the side drawer.
   - Add a "About" button to the side drawer.
   - Add a "Privacy Policy" button to the side drawer.
   - Add a "Terms of Service" button to the side drawer.
   - Add a "Contact Us" button to the side drawer.
   - Add a "Logout" button to the side drawer or top drawer.

##### 6.2.3.1.2 In‑App Chat (PWA) - User Preferences
- `preferences.communication_channel` — `whatsapp`, `pwa`, `both`.
- `preferences.language` — `en`, `ha`, `yo`, `ig`, `pcm`.
- `preferences.notification` — `enabled`, `disabled`.

##### 6.2.3.1.3 In‑App Chat (PWA) - Notifications
- Push notifications are free for PWA users.

#### 6.2.3.2 In‑App Chat (PWA) - Seamless Transition
- User deletes WhatsApp chat → opens PWA → sees the whole history.
- User on PWA → decides to switch to WhatsApp → sends a message there → appears in PWA chat as well.
- The conversation is **always in sync**, because the server is the single source of truth.

#### 6.2.3.3 In‑App Chat (PWA) - Cost Benefit
In‑app messages are **free** (just server processing). We’ll gently encourage users to install the PWA (where push notifications are also free) — further reducing WhatsApp costs over time.

#### 6.2.3.4. Unified Messages Database

A single table stores every interaction, regardless of channel.

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT REFERENCES memory_profiles(phone),
  direction TEXT CHECK(direction IN ('inbound','outbound')),
  channel TEXT CHECK(channel IN ('whatsapp','pwa','ussd','sms')),
  content TEXT,
  content_type TEXT DEFAULT 'text',  -- 'text','interactive','template'
  metadata JSON,                    -- e.g., { "intent": "order_food", "ref": "#F123" }
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### 6.2.3.5 Unified Messages API Endpoints
- `GET /api/conversation?phone=...` — returns recent messages, paginated.
- `POST /api/conversation` — sends a message from the user (in‑app) to the backend, which processes it and replies.

#### 6.2.3.6 Unified Messages Backend Service: `conversationManager.ts`
- Handles routing: determines whether reply goes to WhatsApp, PWA, or both.
- Respects user’s `preferences.communication_channel`.
- Tracks conversation window status (for WhatsApp) and attempts to keep it alive if cost‑effective.

#### 6.2.3.7. Unified Messages Notification Routing (Updated)

The `notificationService.ts` now uses this priority:

1. **Push (FCM)** — if user has PWA installed and push enabled → free, instant.
2. **WhatsApp** — if user has opted in and we have an active conversation window (or it’s cheap to open one) → low cost, rich.
3. **SMS** — absolute last resort, for feature‑phone users with no WhatsApp.

For time‑sensitive alerts (Ride match, emergency response), we may use multiple channels simultaneously to ensure delivery.

#### 6.2.3.8. Onboarding via Conversation on WhatsApp

New user onboarding is just the first few messages of the conversation:

1. User sends “Hi” on WhatsApp (or opens PWA).
2. Kurukoo: *“Welcome! What’s your name?”*
3. User replies. Name stored in `memory_profiles`.
4. Kurukoo: *“Where are you based? (e.g., Ikeja, Lagos)”*
5. User replies. Location stored.
6. Kurukoo: *“You’re all set! What would you like to do?”* → main interactive menu.

No forms, no separate USSD session. The entire onboarding is a chat.

#### 6.2.3.9. Conversation Persistence & Restoration (WhatsApp & PWA)

- The server holds the full history forever.
- If a user deletes the WhatsApp chat, they simply open the PWA and see everything.
- If they message WhatsApp again later, the conversation picks up where it left off (possibly a new conversation window fee, but the history is still available).
- Users can request a history export via USSD or in‑app (GDPR/NDPR compliant).

#### 6.2.3.10. Architecture Summary

```
All Channels (WhatsApp, PWA, USSD, SMS)
        │
        ▼
  Webhook / API Gateway
        │
        ▼
  conversationManager.ts  ──────  aiRouter.ts
        │
        ▼
  requestMatching.ts / subscription.ts / memoryProfile.ts
        │
        ▼
  response generated
        │
        ▼
  notificationService.ts  ──── stores in messages table
        │
        ▼
  delivered via best channel(s)
```

The core backend (skills, matching, subscriptions, memory) remains **unchanged**. The conversation layer is a new input/output module that makes Kurukoo feel like a living, breathing entity.

#### 6.2.3.11. Impact on Blueprint v5.1

| Area | Change |
|------|--------|
| User interface | WhatsApp and PWA chat become primary; USSD slimmed to emergency/fallback |
| Costs | SMS eliminated; USSD reduced; WhatsApp fees minimal; push free |
| Engagement | Persistent conversation increases stickiness and trust |
| Onboarding | Chat‑based, no forms |
| Memory profile | Updated continuously from conversational context |
| New tables | `messages` added |
| New services | `conversationManager.ts`, `whatsappService.ts`, in‑app chat UI |

**No change to the core identity, skills, subscription, or matching architecture.**

### 6.2.4. Free UX & Trust Indicators

Between messages the system may show lightweight status indicators that cost nothing and improve perceived speed and trust:

- "Kurukoo is typing…"
- "Analysing your request…"
- "Checking nearby providers…"
- "Looking for the best match…"
- "Almost there…"

These are pure client-side or lightweight server indicators (the WhatsApp typing indicator is already implemented server-side). They do not trigger paid templates or API calls and have zero marginal cost. They are especially valuable on slow networks where they keep the user engaged while the AI router, FastText classifier and matching engine work.

---

## 13. Notification Architecture

- Push (FCM): Free, real-time liveCast alerts and job matches.
- WhatsApp: For opted-in users, low-cost rich interaction.
- SMS: Final fallback for users without smartphone or WhatsApp.
Asynchronous matching: Push to online providers -> SMS to top offline -> auto-post as open gig if no acceptance in 30 min.

### 13.1. OTP & Push Reliability

### 13.2. CONFIRM-Based Registration

OTP via user‑initiated “CONFIRM” message. No SMS OTP flow. New flow:
1. User provides basic info via WhatsApp or PWA
2. System sends: "To confirm your registration, just reply with the word CONFIRM."
3. User replies "CONFIRM" — free user-initiated message, verifies the channel
4. System responds: "Welcome to Kurukoo! How can I help you?"

Push-based re-authentication for existing, verified devices only.

#### 13.2.1 OTP Flow 

A smarter, zero‑cost flow:

1. User initiates registration via WhatsApp or PWA.
2. Basic info is collected (name, location). A provisional account is created.
3. The system sends a push notification (if PWA is already set up) OR a message in the current chat thread: “To confirm your registration, just reply with the word CONFIRM.”
4. User sends “CONFIRM” in the WhatsApp chat or the PWA unified chat window.
5. This user‑initiated message is free (opens the 24‑hour service window) and simultaneously verifies both the user’s identity and their active communication channel.
6. The system responds: “Welcome to Kurukoo! How can I help you?” — and the subscription choice is then presented.

Result: Zero OTP cost at signup. SMS OTP is removed entirely from the blueprint. The only SMS needed is for the final fallback of the delivery‑confirmation loop (undelivered push to Transsion devices), which will be extremely rare.

### 13.3. Push Delivery Confirmation Loop

Every critical push notification contains a unique `event_id`. The PWA service worker sends `POST /api/push/confirm/{eventId}` on receipt. If no confirmation within 90 seconds, falls back to WhatsApp (free if active window) or SMS (for time-critical alerts). Push delivery confirmation loop for Transsion devices.

note - If no confirmation is received within 90 seconds, the backend automatically falls back to:

WhatsApp user‑initiated deep‑link (if active window exists) — free.
SMS (for truly time‑critical alerts) — cost ~₦4, covered by Plus plan or Growth Fund.

### 13.4. iOS PWA Caveat

iOS push only works when PWA is added to Home Screen (iOS 16.4+). Treated as "best-effort" — confirmation loop automatically falls back.

### 13.5. Transsion Whitelisting Guide

After enabling push, show a one-time illustrated guide on disabling battery optimisation for Kurukoo on Tecno, Infinix, and itel devices.

### 13.6. Push & A2HS Prompts

- Push prompt after first successful request
- Add-to-Home-Screen prompt after second visit
- Both with warm, benefit-focused copy and illustrations

### 13.7. Contact List Access (Assistant)

Uses Web Contact Picker API. User says "Call my brother Emeka" — Kurukoo searches local contacts, shows matches, initiates privacy-bridged call. Contacts never leave the device.

---

## 14. Mobile Strategy

**Guiding principle:** Build the minimum viable deployment surface that covers 95%+ of users. Skip what is not needed initially, but maintain a clear 3-phase progression to native app store presence.

**Phase 1 -- PWA only (Months 1-6):**
- Installable via Chrome "Add to Home Screen" (A2HS) — zero app store fees, zero APK distribution friction.
- Minimum Android 8.0 (API 26) & iOS 14. Covers 95%+ of Nigerian & diaspora mobile devices in active use.
- Offline-first: service worker caches app shell + last 50 messages + Point balance + locale bundles.
- Push-enabled via Firebase Cloud Messaging (FCM) Web Push. No native SDK required.
- Single-screen chat interface (Section 40). No multi-tab navigation competing with the chat input bar.
- Required core features: unified chat, voice input (Web Speech API), Points balance, Go Live toggle, adaptive dashboard drawer.
- Not in Phase 1: native share extensions, background continuous location, native widgets.

**Phase 2 -- PWA + Trusted Web Activity (TWA) & iOS Store Wrappers (Months 7-18):**
- **Android Play Store Wrapper (Trusted Web Activity - TWA):**
  - Uses TWA (Bubblewrap / Android Studio container) to package the PWA as an APK/AAB for Google Play Store listing.
  - Chrome / Android System WebView renders the web app inside a full-screen, native frame without browser URL bars.
  - **Digital Asset Links (`/.well-known/assetlinks.json`):** Hosted on `kurukoo.com` to verify domain ownership and remove the URL address bar in TWA mode.
  - Native launcher icon, splash screen, and FCM push notification channel bridging.
  - Zero code duplication: 100% of web updates deploy instantly without re-submitting to Google Play.
- **iOS App Store Wrapper (WKWebView Native Container):**
  - Custom Swift / WKWebView wrapper to package the PWA for the Apple App Store.
  - **Apple Universal Links (`/.well-known/apple-app-site-association`):** Enables seamless deep linking (`kurukoo.com/chat`, `kurukoo.com/explore`) into the native app wrapper.
  - Native push notification bridge (APNs to FCM payload relay).
  - Gives complete app-store presence and native branding on iOS without requiring a full Flutter/React Native rewrite in Phase 2.

**Phase 3 -- Cross-Platform Native Apps (Flutter / React Native) (Month 19+):**
- **Trigger:** Initiated only after product-market fit is established and web/PWA features are fully stabilized.
- **Technology Stack:** Flutter (or React Native) for single-codebase iOS & Android native deployment (`kurukoo://` deep link protocol).
- **Deep OS Capabilities & Hardware Access:**
  - **Biometric Auth:** TouchID / FaceID / Android Fingerprint authentication for high-value wallet transactions and agent logins.
  - **Background Location & Geofencing:** Continuous high-accuracy background location for active delivery riders and Kuru Pulse hawkers during active jobs.
  - **Native Contact Sync:** Direct contact list integration for privacy-bridged calling and referral blasts without Web Contact Picker constraints.
  - **Offline Local Database:** On-device SQLite / Room database for zero-latency offline message drafting and local encryption.
  - **Home Screen Widgets & Live Activities:** Android home screen widgets and iOS Lock Screen Live Activities for real-time ride tracking and active delivery progress.
- **Unified Backend Alignment:** Shared business logic via standard REST API (`/api/*`) and WebSockets — writes to the exact same `memory_profiles`, `skills`, and `messages` database tables.

**Design: African Modernism** (applies to all phases)
- Bold typography, earth-tone palette (cream `#FFF8F0`, terracotta `#D97A5C`, electric blue `#1E88E5`, charcoal `#2E2E2E`).
- Voice-first, haptic feedback, community-respecting workflows.
- Material Design 3 structural rules overridden with Kurukoo colours (Section 31.4).
- Works across USSD, budget Android PWA, TWA wrappers, and future native apps — one visual language, three surfaces.

**Device targets (cost-driven):**
- Primary: Android 8.0+ Chrome & TWA Play Store package (Tecno, Infinix, itel, Samsung A-series).
- Secondary: iOS 14+ via Safari PWA or iOS App Store WKWebView wrapper.
- Tertiary: Feature phones via USSD `*7000#` — no app, no browser needed.
- No tablet-specific UI. Max-width 480dp always. Phone-first layout.

**Web vs PWA clarification:**
- **Web (kurukoo.com):** Public marketing site, Explore hub, blog, help centre, provider SEO pages. Informational + conversion. No user data stored locally; all interactions redirect to WhatsApp/USSD/PWA.
- **PWA (kurukoo.com via A2HS):** Installed app experience. Full conversation interface, Points balance, dashboard, offline mode. Stores user data in memory profile. This is the "rich mirror" of the WhatsApp conversation.
- **Rule:** The public website never requires login. The PWA requires phone-number authentication. Both use the same backend APIs and conversation engine.

---

## 40. Hybrid Chat UI (Anonymous + Authenticated)

The chat interface works in two modes with a seamless transition. Same UI, different data access.

**Authenticated mode (default):**
- Full memory profile access, personalised suggestions, transaction history, quick replies
- User identified by phone number (WhatsApp) or session token (PWA)
- All interactions written to memory_profiles and messages

**Anonymous mode (single session):**
- No memory profile created. Phone number not captured.
- Can browse available services, see liveCast signals (fuzzed), make a one-time request
- Conversation exists in a temporary session with TTL = 24 hours
- If the session expires -> all data deleted, no trace

**Transition (anonymous -> authenticated):**
Trigger: After completing an anonymous request, Kurukoo sends:
"Need to save this order and earn Points? Reply YES to create your Kurukoo profile."

If user replies YES:
1. Create `memory_profiles` row with phone (WhatsApp) or email (PWA)
2. Migrate session data to the new profile:
   - Anonymous conversation -> messages table (attributed to new phone)
   - Anonymous request -> order history (if applicable)
   - Anonymous order value -> not carried over (no financial trail from unverified session)
3. Session TTL extended to permanent
4. Kurukoo sends: "Welcome! Your profile is ready. [First Point] earned for signing up."

If user replies NO or does not reply within 24 hours:
- Session expires
- Temporary conversation deleted
- No data retained

**Transition rules:**
- Only the conversation history and request details migrate. No inferred skills, no preferences, no Wallet data from the anonymous session (none existed).
- The anonymous request counts as the user's first interaction for onboarding Stage 2 (intent detection)
- If the anonymous request reveals a skill need (e.g., "I need a plumber"), that intent is stored as the first inferred_roles signal

**Typing indicator:** "Kurukoo is typing..." shown in PWA and WhatsApp while AI router processes intent. Fade out on response.

> **Pick-a-Role Conversation Priming (Homepage / Landing UX):**
> The public homepage may offer a lightweight role selector (Consumer / Provider / Business) **before** the chat begins. This is not an identity constraint — the same phone number can be all three simultaneously — but a **conversation priming UX pattern** that channels the first message toward the user's immediate intent. The selected role seeds the first AI prompt and quick-reply options, but the Work Toggle (§33.1.1) handles all subsequent context switching. No profile, subscription, or permission state is bound to the initial selection. This pattern must not be confused with role locking; Kurukoo's multi-role identity is preserved.

---

## How Kurukoo Works — User-Facing Page Brief

*(This section documents the structure and copy requirements for the `/how-it-works` page, which will be linked from the header nav dropdown under "How It Works". The dropdown also contains links to feature-specific sub-pages: Discover, Use Cases, Pricing, Explore, Help.)*

### Page Structure

The page uses a single-page scroll layout with five sections, each explaining a user-facing feature or flow without exposing backend architecture.

### Section 1 — One Number, Every Hustle

**Headline:** One profile. Every hustle. All in one conversation.

**Body:**
Kurukoo is not an app you download. It is a conversation you already have — on WhatsApp, on any phone via USSD, or in your browser. Your phone number is your only ID. You can request a service, offer your own skills, and manage your business — all from the same number, in the same chat thread. No switching apps. No separate logins. No profile to update.

**Visual:** Animated phone mockup showing the same conversation flow switching between consumer request → provider acceptance → Points balance update.

### Section 2 — How Requests Work

**Headline:** Tell Kurukoo what you need. We handle the rest.

**Body:**
1. **You message Kurukoo** on WhatsApp or dial *7000#. Describe what you need in plain language — "I need a plumber" or "Send a bag of rice to Surulere."
2. **Kurukoo finds the right person** using Nearby Pulse — a smart matching system that connects you with available, trusted providers near you, ranked by trust score, not just proximity.
3. **You confirm and pay securely.** Once you agree on a price, payment is held safely in escrow via OPay or Moniepoint. Your money is protected until the job is done.
4. **The provider delivers.** You receive real-time updates. When the job is complete, you confirm delivery.
5. **Payment is released.** The provider gets paid. Kurukoo's coordination fee is deducted automatically. You leave a rating. Your profile learns from every interaction.

**Kurukoo Guarantee badge:** "If the job isn't done right, you're protected. If delivery fails, you get a full refund."

### Section 3 — How Earning Works

**Headline:** Offer any skill. Get paid for your time.

**Body:**
1. **Toggle "Available for work"** in your chat. Kurukoo knows your skills from your profile — no CV or portfolio needed.
2. **Receive job alerts** via push notification or WhatsApp. Kurukoo matches you based on your location, availability, and trust score.
3. **Accept or decline.** No penalties for declining. No algorithm gaming your acceptance rate.
4. **Get paid after delivery.** Payment is released from escrow once the customer confirms. You earn Points on every completed job.
5. **Withdraw anytime.** Use your Points to pay for services on Kurukoo, or convert to cash via your linked OPay or Moniepoint account.

**Earnings transparency:** "Providers on Kurukoo keep 85% of every job. The platform takes a 15% coordination fee. No hidden charges."

### Section 4 — How Kurukoo Guarantee Works

**Headline:** Your money is safe. Your delivery is guaranteed.

**Body:**
Kurukoo Guarantee is built into every transaction:

- **Buyer pays first:** Payment is collected and held in escrow before any work begins. The seller never sees the money until the buyer confirms delivery.
- **Trusted sellers only:** Only providers with verified trust scores and completed local jobs can sell through Kurukoo Guarantee.
- **Trusted delivery network:** Delivery persons are rated, tracked, and paid only after successful delivery. Failed delivery means no payment for the courier and a full refund for the buyer.
- **Dispute resolution:** If something goes wrong, Kurukoo's AI-assisted dispute resolution system investigates and resolves within 24 hours. Human escalation is available.

**No inventory risk:** Kurukoo never buys, holds, or resells products. We simply coordinate the right people and protect both sides of the transaction.

### Section 5 — Points and Subscription

**Headline:** Points are how Kurukoo works. Not loyalty tokens. Points.

**Body:**
Every action on Kurukoo moves your Points balance. Points have real value — 1 Point = N1 — and they power the entire platform:

- **Earn Points:** Daily engagement (+1), complete jobs (+1–5), refer a friend (+200), get a 5-star rating (+1 bonus).
- **Spend Points:** Request a ride (–1), send a Pulse signal (–1), Boost your listing (–10), Go Live for 30 minutes (–5), lead charges (–20 to –50 depending on skill type).
- **No cash-out.** Points cannot be converted to airtime, transferred P2P, or cashed out. They can only be spent on Kurukoo services. This keeps the system fair, compliant, and sustainable.

**Subscription tiers unlock more:**

| | Base | Plus | Business |
|---|---|---|---|
| **Price** | N500/mo | N1,500/mo | N5,000/mo |
| **Free Points** | 30/month | 60/month | 120/month |
| **Pulse signals** | 30/month | 60/month | 120/month |
| **Boost listings** | 1 free/mo | 3 free/mo | 10 free/mo |
| **Best for** | Getting started | Growing hustle | Scaling business |

10% of all subscription revenue goes into the Growth & Community Fund for provider incentives and platform improvement.

### Section 6 — Works on Any Phone

**Headline:** No app download. No data bundle required.

**Body:**
Kurukoo works on every phone, in every network condition:

- **WhatsApp** — The primary interface for smartphone users. Open a chat with 7000.
- **USSD *7000#** — Works on any phone, no internet needed. Menu-driven for feature phones.
- **PWA** — Install Kurukoo to your home screen for a richer experience. Works in any browser, no app store required.

One profile. One conversation. Three doors in.

### Closing CTA

**Headline:** Ready to get going?

**Buttons:**
- "Open WhatsApp" (links to https://wa.me/2347000000000?text=Hello)
- "Try USSD" (shows *7000# with copy prompt)
- "Explore Categories" (links to /explore)

**Subtext:** No registration form. No email required. Just send a message and start.

---

## Homepage Copy Draft (utilityapp.ai.studio)

*(This section documents the recommended copy and layout for the Kurukoo homepage. All copy is aligned with the vertical + horizontal hybrid positioning, the multi-role identity, and the engineering-advantages-vs-user-facing-features distinction defined in §1.5.)*

### Hero Section

**Headline:** One profile. Every hustle. All in one conversation.

**Subhead:**
Request any service, offer any skill, run any business — from the same WhatsApp number. No apps to download. No forms to fill. No profile switching.

**Primary CTA:** Open WhatsApp (deep link to wa.me/2347000000000?text=Hello)
**Secondary CTA:** Try USSD (shows *7000# with copy prompt)
**Tertiary CTA:** Explore Categories (links to /explore)

**Trust indicator:** "Trusted by thousands across Nigeria. Works on any phone."

---

### What Do You Want to Do? (3-Card Role Priming)

**Intro text:** Kurukoo works differently depending on what you need. Pick a starting point — or just send a message and we'll figure it out.

**Card 1 — Request a Service**
> "Need a plumber, a delivery, a ride, or anything else? Tell Kurukoo what you need. Payment is held in escrow until the job is done. Your money is always protected."

**CTA button:** Request a service (opens WhatsApp with pre-filled prompt: "I need help with...")

**Card 2 — Offer Your Skills**
> "Got a skill? Okada riding, phone repairs, suya grilling, errand running — whatever you do, Kurukoo matches you with nearby customers. You keep 85% of every job. No CV needed."

**CTA button:** Start earning (opens WhatsApp with pre-filled prompt: "I want to offer my skills")

**Card 3 — Grow Your Business**
> "Running a shop, restaurant, or studio? Get a verified storefront, list your products, boost your visibility, and accept bookings — all inside the same conversation."

**CTA button:** Grow my business (opens WhatsApp with pre-filled prompt: "I want to grow my business")

**Footer note:** "Same phone number. All three roles. No switching."

---

### Why Kurukoo? (Differentiation Section)

**Headline:** Not another app. Not another directory. An economic layer that just works.

**Body:**
Most platforms force you to choose: download an app for rides, another for deliveries, another for services. Each one takes a cut. None of them know you. None of them guarantee your money is safe.

Kurukoo is different.

- **One conversation, not ten apps.** Everything happens inside WhatsApp, USSD, or your browser. No app store, no downloads, no updates.
- **One profile, not ten accounts.** Your phone number is your only ID. The same profile remembers your preferences, your trusted providers, your past jobs — across every interaction.
- **Kurukoo Guarantee, not just a listing.** Buyer pays first into escrow. Seller gets paid only after delivery is confirmed. If something goes wrong, you're protected.
- **Points that mean something.** Earn Points for every engagement. Spend them on boosts, Pulse signals, and lead charges. 1 Point = N1 real value — closed-loop, compliant, and sustainable.
- **Multi-role by design.** You're a consumer in the morning, a provider in the afternoon, and a business owner at night. No profile switching. No separate apps. One number does it all.

---

### How It Works (Visual Flow)

**Headline:** From message to done in 60 seconds.

**3-step visual:**

1. **Message** — Open WhatsApp, dial *7000#, or open the PWA. Tell Kurukoo what you need.
2. **Match** — Kurukoo finds the right provider using Nearby Pulse and your trust score. You confirm and pay into escrow.
3. **Done** — The provider delivers. You confirm. Payment is released. Your profile learns. Your Points balance updates.

**CTA:** See the full flow → (links to /how-it-works)

---

### Social Proof (Pilot-Appropriate)

**Headline:** Real people. Real hustles. Real results.

**Note:** At pilot stage, use agent referral success stories and Nearby Pulse presence data as social proof — not earnings claims or fabricated testimonials.

**Example format:**

> "Agent Chinedu in Lagos earned ₦45,000 in referral bonuses over 3 months by onboarding 12 new providers. He now runs a small team of 6 delivery persons through Kurukoo."

> "As of today, 23 providers are active within 2km of Ikeja. Nearby Pulse makes it feel like everyone is already here."

**CTA for providers:** "Earn your first ₦5,000 this month. Start offering your skills today."

---

### Nearby Pulse Live Feed (Dynamic Social Proof)

**Component:** Real-time counter showing active providers in the user's area, updated every 60 seconds.

**Copy:** "23 providers active near you right now. 12 are available for immediate pickup."

**Visual:** Small map snippet or pulsing dot grid showing presence density.

**CTA:** "See who's nearby" (opens Pulse view in chat)

---

### Footer CTA

**Headline:** The platform that works as hard as you do.

**Subtext:** No downloads. No forms. Just one conversation.

**Buttons:**
- Open WhatsApp
- Try USSD
- Explore Categories

**Small print:** Kurukoo is currently in pilot in Nigeria. Sign up to join the waitlist for Ghana and UK.

---

**Message grouping:** Messages from the same provider within the same conversation grouped for readability. 500ms delay between groups. Operator messages (system prompts, opportunities) are visually separated from human provider messages.

> **GenUI Alignment Notes:**
> - **Adopt Now — Declarative UI schema:** GenUI's core insight is that AI-generated UI surfaces are safest and most maintainable when rendered from a declarative JSON schema (card_type, binding, actions) rather than hard-coded per card type. While Kurukoo already generates inline cards dynamically via the intent router, the same safety and flexibility benefit can be achieved by extending `skill_flows` with a `ui_schema` field (see §4 note). This would make the UI read-only, data-bound, and locally-renderable on both WhatsApp (list/quick-reply mapping) and PWA (rich cards) from a single configuration payload.
> - **Already Aligned — Read-only, AI-generated content:** Kurukoo's chat cards (ride_picker, survey, product_card, worker_match) are already generated from intent router responses and presented to the user as non-editable — the user responds to the card content rather than authoring it. This mirrors GenUI's principle that limiting UI generation to read-only, data-bound visualizations enables AI-driven rendering without hallucination or safety risks.

---

## 7. Point Economy (Points System)

1 Point = N1 equivalent value. Points are closed-loop loyalty tokens designed to comply with CBN regulations.

| Action | Points |
|--------|--------|
| Daily engagement (WhatsApp/PWA/USSD) | +1 |
| Refer a new subscriber | +200 |
| Complete a job (provider) | +1-5 |
| Request a ride | –1 |
| 5-star rating received | +1 bonus |
| Send a liveCast signal | -1 |
| Boost listing (24 hours) | -10 |
| Active Kuru liveCast "Go Live" session (per 30‑min block) | -5 |
| Kuru Kuru Pulse | +/- 0 |
| Lead charge – okada/keke/car driver | –50 |
| Lead charge – bicycle delivery | –30 |
| Lead charge – hawker / street food vendor | –20 |
| Lead charge – wheelbarrow boy / truck pusher | –20 |
| Lead charge – professional service | –50 |

CBN Compliance: Points are strictly closed-loop, unidirectional. They cannot be cashed out, converted to airtime, or transferred P2P in a way that constitutes stored value.

Points are earned via daily engagement, referrals, and job completion. They are spent ONLY on Kurukoo’s own services: Boost Listing, Kuru Pulse “Go Live,” and subscription discounts.

- **No airtime redemption.** Airtime gifting is a marketing expense from Kurukoo’s own float, not a user‑initiated conversion. We are a customer of the telco, not a reseller. 
- **No P2P transfers.** Points are strictly non‑transferable between users.
- **No fiat symbol in UI.** Balances are displayed as “500 Points,” not “₦500.” Internally, 1 Point = ₦1 for accounting. The mapping is never shown to users.
- **Provider lead fees** are paid via direct Points deduction. Providers buy Point packs (1 Point = ₦1) via OPay, Moniepoint, or agents. Lead charges are deducted from their balance on job acceptance.
- **Provider grace policy:** 3 leads on Points before pause. When a provider's Points balance reaches zero, up to 3 leads are allowed on Points. Each grace lead is followed by a gentle top‑up reminder. After the 3rd unpaid lead, the provider is paused until they top up.
- Agent commissions and lead charges are configurable via the `commission_config` table.
- **Agent reselling:** Agents buy token packs at wholesale and resell to providers at retail, keeping the margin.

Growth and Community Fund: 10% of subscription revenue is allocated to an internal fund for marketing, provider incentives, and - at Kurukoo discretion - purchasing airtime from providers for random goodwill distribution to engaged users. This is a platform expense, not a user right.

### 7.1 UK Point Value

> **Developer note — UK Points contradiction resolved:** Points are **disabled for the UK market** via the `points_enabled` feature flag (§35). The UK uses a subscription + transaction-fee economic model, not Points. The value below is defined for **forward-compatibility only** — if Points are ever enabled for the UK in the future, the conversion rate will be 1 Point = £0.002 (500 Points = £1). **Do not build UK Points functionality until the `points_enabled` flag is explicitly set to `true` for `/gb/`.** Currently, UK revenue comes from subscriptions (§7.2) and Transaction Orchestration Engine coordination fees (§33.1.2).

In the UK, 1 Point = £0.002 (500 Points = £1). Top‑up packs are sold in pounds. *(Forward-compatibility only — Points currently disabled for UK per §35 feature flags.)*

### 7.2 Backend‑Controlled Pricing
Pricing is managed via the `pricing` table and admin dashboard, not hardcoded.

| Tier | NG (₦) | UK (£) | GH (₵) | Points/mo |
|------|--------|--------|--------|------------|
| Base | 500 | 1.00 | 15 | 30 |
| Plus | 1,500 | 3.99 | 45 | 60 |
| Business | 5,000 | 4.99 | 150 | 120 |

10% of all subscription revenue goes into the **Growth & Community Fund** (internal reinvestment).

### 7.3 Spending Points
- Basic ride request: 1
- Kuru Pulse "Go Live" (per 30-min block): 5
- Boost listing (24h): 10
- Extra ride beyond free allowance: 2 each
- Lead charges: 20-50 depending on provider type

Points are the continuous economic glue of the tightly integrated system. Every lead charge, Go Live session, boost, and reward must update the same balance that is visible in the chat interface of every channel.

---

## 8. Subscription Tiers

| Plan | Price/mo | liveCast Signals | Free Points/mo | Channels | Key Benefits |
|------|----------|------------------|----------------|----------|---------------|
| Base | N500 | 30 | 30 (1/day) | WhatsApp + PWA + USSD | Interactive WhatsApp access, Kuru LiveCast (1 free hour/mo), Unlimited Kuru Pulse (Nudge), Boost listing (1 free/mo), reminders, basic support, SMS (10/mo), Free job alerts, free messaging |
| Plus | N1,500 | 60 | 60 (2/day) | WhatsApp + PWA + USSD + SMS | Unlimited interactive WhatsApp access, (5 free hours/mo) Kuru LiveCast (Go Live), Unlimited Kuru Pulse (Nudge), priority support, Boost listing (3 free/mo), Proactive matching, reminders, SMS fallback (30/mo) for feature‑phone users, Free job alerts, free messaging |
| Business | N5,000 | 120 | 120 (4/day) | WhatsApp + PWA + Storefront + USSD + SMS | Unlimited interactive WhatsApp access, (10 free hours/mo) Kuru LiveCast (Go Live), storefront (50 items), priority placement, Boost listing (10 free/mo), Proactive matching, Unlimited Kuru Pulse (Nudge), SMS fallback, bulk job acceptance, personalized nudges, reminders, universal remote access, sales analytics, SMS (60/mo), Free job alerts, free messaging, team sub‑accounts |

10% of all subscription revenue goes into the **Growth & Community Fund** (internal reinvestment).

**IP/founder royalty:** 0% during pilot and until operating profitability. After profitability, a royalty of 5-10% may be introduced by board resolution.

---

## 9. Agent Network

Agents use simple USSD or a lightweight PWA to perform four activities:

| Activity | Commission | Notes |
|---------|-----------|-------|
| Register new users | ₦50/verified user | User confirms via CONFIRM message |
| Top up Points | 5% of top-up amount | Deducted from deposit before credit appears |
| Onboard providers | ₦50-200 per sign-up | Tiered by plan (Base/Plus/Business) |
| Facilitate walk-in orders | ₦50-100 service fee | Collected from provider, not customer |

Gamified leaderboard + monthly prizes for top agents. Agent-specific data and earnings visible in PWA agent area.

**Agent onboarding flow:**
1. Agent dials *7000# or opens PWA -> selects "Become a Kurukoo Agent"
2. System creates agent record with `preferences.is_agent = true` and a unique referral code
3. Agent shares referral code/link with users and providers
4. Each successful referral tracked in `referrals` table with commission status
5. Commissions auto-credited to agent wallet weekly

**Catalog Scraper (zero additional infra):**
- Runs as a background job when a user shares a WhatsApp Business catalogue URL or social media link
- Uses the AI router's existing Groq/FastText pipeline (§21) to extract product names, prices, and images from the page
- Stores results in `skills.business_products` (JSON array) and `skills.products`
- No separate scraping service needed. Uses the same Groq API already budgeted in the AI layer
- Output format:
  ```json
  [{"name": "Ankara Dress", "price": 8500, "currency": "NGN", "image": "url", "category": "fashion"}]
  ```

**Soft-claim merge algorithm (for partner brand leads):**
When a partner brand (e.g., Moniepoint) identifies a Kurukoo user as a potential agent:
1. Check `memory_profiles` for existing profile completeness (name, LGA, skills)
2. If profile > 60% complete -> soft-claim nudge: "Moniepoint is looking for agents in your area. Your Kurukoo profile is ready. Tap to connect."
3. If profile < 60% complete -> send onboarding nudge first: "Complete your profile and get matched with agent opportunities."
4. User opts in -> Kurukoo shares name, LGA, Trust Score, and relevant skills (with consent)
5. Partner brand contacts user directly
6. Kurukoo earns lead fee per successful agent sign-up

### 9.1 Agent Network for Partner Brands

Kurukoo becomes a lead generation platform for other companies - Moniepoint, OPay, insurance firms, logistics companies - by leveraging its user base and Trust Score.

### 9.2 Partner Brand Integration Flow

1. Partner brand requests agents in a specific LGA or skill segment
2. Kurukoo queries: SELECT phone FROM memory_profiles WHERE primary_lga = ? AND skills MATCH ? AND is_agent = true AND trust_score > threshold
3. Kurukoo sends a push/WhatsApp nudge with the opportunity
4. User opts in -> profile (name, LGA, Trust Score, relevant skills) shared with consent
5. Partner brand contacts user directly off-platform
6. Kurukoo earns lead generation fee per successful conversion

**Data shared (consent-gated):** Name, LGA, Trust Score, relevant skill tags. No phone number, no transaction history, no personal data beyond what the user agreed to share.

This opens a B2B revenue stream without adding complexity for regular users

## 10. Revenue Model

| Source | Details |
|--------|---------|
| Consumer subscriptions | N500-N2,500/month |
| Provider lead charges | 50 Points per accepted liveCast (month 3+) |
| Provider subscription tiers | Premium visibility, analytics |
| Growth and Community Fund | 10% internal allocation (not public ledger) |

Founder/IP revenue: During pilot phase, 0% IP royalty. Post-profitability (determined by board resolution): a structured royalty of 5-10% of net profit may be introduced.

### 10.X – Bill Payments & Airtime/Data Revenue (Three-Tier Roadmap)

Kurukoo offers airtime, data, and bill payments as a user convenience. These are treated as **separate activities** with different licence requirements.

| Tier | Activity | Provider | Licence Required | Status |
|------|----------|----------|------------------|--------|
| **1. Immediate** | Airtime & Data | Africa's Talking (or local VTU API) | Optional: NCC Class Licence (~₦10k) | Available now |
| **2. Launch** | Electricity, DSTV, GOtv, Startimes | Paga / Moniepoint / Flutterwave (PSP) | None – PSP holds CBN licence | Available at launch |
| **3. Later** | Full agent network + cash-in/out + own settlement | Kuru Pay (brand) | Super Agent licence (₦50M capital) | After capital accumulation |

**Revenue model:**
- **Airtime/Data:** Margin on wholesale purchase (e.g., ₦100+ per ₦1,000 sold).
- **Bill payments (PSP):** Flat fee (e.g., ₦100) + small margin on PSP commission.
- **Super Agent phase:** Commission on all bill payments + agent network revenue.

**Regulatory positioning:**
- Airtime/data is covered by NCC Class Licence (optional, cheap).
- Bill payments via PSP are covered by the PSP's CBN approvals.
- Super Agent licence is only pursued for the later agent-network phase.

### 10.1 Revenue Streams (Full)

| Stream | Description |
|--------|-------------|
| Subscriptions | 3‑tier recurring revenue |
| Point top‑up margins | Points sold at face value; cost is near‑zero |
| Lead charges | 20–50 Points per accepted job, paid by providers |
| Private Talent Sourcing | Disclosed margin on professional services |
| Sponsored Daily Picks & Ads | CPM/CPV placements, provider spotlights, city takeovers |
| B2B lead‑gen & data insights | Anonymised demand heatmaps, trend reports, partner fees |
| Bill payments & Airtime/Data revenue | Three‑tier: (1) Airtime/data via Africa's Talking now, (2) Bill payments via PSP (Paga/Moniepoint) at launch, (3) Super Agent later for full agent network |
| E‑commerce & Marketplace commissions | Affiliate commissions from Jumia, Temu, and other marketplaces; product sales via storefronts |

**E‑commerce & Marketplace:**
- **Affiliate model:** Kurukoo surfaces products from Jumia, Temu, and other e‑commerce platforms via affiliate links. Users browse and purchase through Kurukoo's chat interface; Kurukoo earns a commission (typically 5–15%) on each sale.
- **Storefront sales:** Business tier providers sell products directly through their chat‑managed storefronts (§32.6). Kurukoo takes a 10–15% commission on each transaction.
- **No inventory risk:** Kurukoo never holds stock. All products are fulfilled by the marketplace or provider directly.
- **Integration:** Product listings surface in Daily Picks, sponsored cards, and in response to user requests ("I want to buy a phone"). The existing `skills.business_products` catalog field stores both provider products and affiliate products (with `source: 'affiliate'` flag).

No public catalog like Jiji is needed. Sponsored placements and backend prioritisation handle visibility.

Data insights: Anonymised demand heatmaps and trend reports are generated from the database and sold to corporate clients (FMCG, agencies). This is a B2B product, delivered as PDF/API, not a consumer‑facing feature.

### 10.2. Airtime Reward Legal Clarity

- Airtime rewards are a **marketing expense**, not a financial service
- Kurukoo buys airtime wholesale and gifts it — no cash-out
- No Super Agent licence required
- Cap: ₦500/month per user
- Documented in code comments and ECOSYSTEM.md

### 10.3. Point Top‑Up Flow UI

- User taps their Point balance → a bottom sheet opens with preset amounts (₦100, ₦200, ₦500, ₦1,000, Custom).
- After selecting, they choose a payment method: OPay, Moniepoint, or agent code.
- The integrated wallet app opens (or a USSD code is shown) for authorisation.
- On success, a confirmation animation plays and the balance updates instantly.

### 10.4. Lead Charges Flow UI

- User taps a job card → a bottom sheet opens with job details, budget, and deadline.
- User taps “Submit Proposal” → a bottom sheet opens with a form to fill in their proposal.
- On success, a confirmation animation plays and the job is marked as “In Progress”.

### 10.5. Super Agent Licence Roadmap & Three-Tier Bill-Payment Strategy

Kurukoo's bill-payment and financial services rollout follows a **three-tier regulatory strategy** that minimises upfront capital requirements while building toward full payment-processing independence.

#### The Three Tiers

| Tier | Activity | Provider | Licence Required | Capital Required | Status |
|------|----------|----------|------------------|------------------|--------|
| **1. Immediate** | Airtime & Data | Africa's Talking (or local VTU API) | Optional: NCC Class Licence (~₦10k) | ~₦10,000 | Available now |
| **2. Launch** | Electricity, DSTV, GOtv, Startimes, other bills | Paga / Moniepoint / Flutterwave (PSP) | None – PSP holds CBN licence | ₦0 (partner holds licence) | Available at launch |
| **3. Later** | Full agent network + cash-in/out + own settlement | **Kuru Pay** (brand) | Super Agent licence (CBN) | ₦50M capital threshold | After capital accumulation |

**Key principle:** Kurukoo never holds funds directly until Tier 3. Tiers 1 and 2 use licensed partners who hold the required regulatory approvals.

#### Tier 1: Airtime & Data (Immediate — No Super Agent Needed)

- **Provider:** Africa's Talking (or local VTU API)
- **Licence:** Optional NCC Class Licence (~₦10,000) — allows direct airtime/data sales without being a telco
- **Capital:** ~₦10,000 for licence fee
- **Revenue model:** Margin on wholesale purchase (e.g., ₦100+ per ₦1,000 sold)
- **Implementation:** Simple API integration; no escrow needed (instant delivery)
- **Status:** Can launch immediately

#### Tier 2: Bill Payments via PSP (Launch — No Super Agent Needed)

- **Provider:** Paga / Moniepoint / Flutterwave (Payment Service Providers)
- **Licence:** None required — PSP holds CBN approval
- **Capital:** ₦0 (partner holds licence and float)
- **Revenue model:** Flat fee (e.g., ₦100) + small margin on PSP commission
- **Implementation:** PSP API integration; funds flow through PSP's escrow
- **Services:** Electricity bills, DSTV/GOtv/Startimes subscriptions, other bill payments
- **Status:** Available at platform launch

**Critical distinction:** In Tier 2, Kurukoo is a **reseller/aggregator**, not a payment processor. The PSP holds the funds and the licence. Kurukoo earns a commission on each transaction.

#### Tier 3: Kuru Pay — Full Agent Network & Own Settlement (Later — Requires Super Agent)

- **Brand:** **Kuru Pay** — the licensed payment entity
- **Licence:** Super Agent licence from CBN
- **Capital requirement:** ₦50M minimum capital threshold
- **Timing:** Apply only after platform revenue reaches ₦50M capital threshold (typically 2-3 years post-launch)
- **Capabilities unlocked:**
  - Full agent network management (cash-in/out agents)
  - Own settlement and escrow (no PSP dependency)
  - Direct bill payment processing
  - Wallet services (stored-value accounts)
  - Cross-border remittances

**Kuru Pay brand positioning:**
- Consumer-facing brand for all payment services
- "Kuru Pay" = trusted payments layer for the informal economy
- Handles: airtime, data, bill payments, cash-in/out, agent network management
- Licensed entity separate from Kurukoo Technologies Ltd (regulatory requirement)

#### Why This Three-Tier Approach?

1. **Minimises upfront capital:** No need to raise ₦50M before launch
2. **Validates revenue model:** Tiers 1-2 generate cash flow to fund Tier 3
3. **Regulatory compliance:** Each tier operates within its licence boundaries
4. **Risk mitigation:** If Super Agent application is delayed/denied, Tiers 1-2 continue operating
5. **Strategic optionality:** Can choose to remain a PSP aggregator if margins are better

#### Super Agent Licence Application Timeline

- **Year 1-2:** Operate Tiers 1-2; build revenue and transaction volume
- **Year 2-3:** Accumulate ₦50M capital threshold from platform revenue
- **Year 3:** Apply for Super Agent licence
- **Year 3-4:** If approved, launch Kuru Pay with full agent network

**Fallback:** If CBN changes Super Agent requirements or application is denied, Kurukoo continues operating Tiers 1-2 indefinitely via PSP partnerships.

#### Agent Network Expansion (Separate from Super Agent)

Physical agents (cash-in/out points, walk-in assistance) can be recruited **before** Super Agent licence using:

- **Agency banking model:** Partner with existing Super Agents (e.g., Paga, OPay agents) who already hold licences
- **Commission structure:** Kurukoo earns a cut of agent transaction fees; agent earns from spread
- **No licence required:** Kurukoo is a platform connecting users to licensed agents, not operating the agents itself

This allows agent network rollout in Year 1-2 without waiting for Super Agent licence.


---

## 11. Payment Models by Service Type

| Category | Services | How Payment Works |
|----------|----------|-------------------|
| A - Platform-Processed | Food, pharmacy, fixed-price gigs | Wallet debited, escrow, release on completion |
| B - Lead Generation | Plumber, electrician, tutor | Platform connects; payment direct, off-platform |
| C - Peer-to-Peer | liveCast rides, open gigs | Direct cash or wallet transfer. Platform holds no funds |

---

## 12. Unified Adaptive Dashboard (PWA)

The PWA is a single page that changes based on the user's memory profile. Every user sees a unique dashboard.

**Core Elements (All Users):**
- **Discovery Bar:** A prominent microphone button with a text fallback. Tapping it starts a voice input, or the user can type a request. The bar shows contextual hints: *“What do you need?”*, *“Find a worker near you”*, *“Get a Ride”*.
- **Opportunity Feed:** A vertical, scrollable feed of cards. Each card represents an opportunity Kurukoo has surfaced: a job alert, a Kuru liveCast (formerly Pulse) hawker, a market intelligence nudge, or a re‑order suggestion. Cards are ordered by relevance and urgency.
- **Unified Chat Thread:** Accessible via a bottom‑nav tab. Shows the full cross‑channel conversation history.
- **Points:** Always visible in the top‑right corner. Shows Point balance, with a one‑tap top‑up button.

**Role‑Specific Panels (Appear based on skills):**
- **For Riders/Drivers:** A "Ride Requests" panel showing incoming ride requests with distance, fare estimate, and a one‑tap "Accept" button. A toggle to go online/offline.
- **For Hawkers / Mobile Providers:** A "Go Live" panel with a map preview of their current fuzzed location, timer for Pulse session, and a live feed of incoming "Request a Stop" messages.
- **For Professional Service Providers:** A "New Job" panel listing tasks matching their skills, with budget, deadline, and a "Submit Proposal" or "Accept" button.
- **For Business Owners:** A mini‑storefront panel with product catalogue, today's orders, and quick inventory update.

**Adaptation Logic:** The dashboard queries `GET /api/dashboard?phone=...` which returns a JSON object describing which panels to show, based entirely on `memory_profiles.inferred_roles` and `skills`.

Single web page (/dashboard?phone=...) reads memory profile and renders panels dynamically:
- Everyone: Points, subscription, liveCast signals remaining.
- Customer role: Reorder suggestions, recent orders, post a gig.
- user skill: Toggle online/offline, incoming liveCast signals, earnings, Job cards matching each skill, availability toggle.
No separate dashboards for riders, agents, providers. One page, many faces.

---

## 15. KuruTrust - Zero-Cost Trust Ledger

Internal append-only ledger with cryptographic guarantees, publicly verifiable. No blockchain gas fees. Built on existing PostgreSQL + a free Twitter/X bot.

**Table schema (PostgreSQL):**
```
trust_ledger
  id BIGSERIAL PK
  record_type TEXT      -- rating | disbursement | consent | escrow | verification
  record_id TEXT        -- FK to the source record (e.g., ratings.id)
  phone TEXT            -- memory_profiles.phone (hashed for public posts)
  payload JSONB         -- the full record data
  prev_hash TEXT        -- SHA-256 of the previous row in this chain
  this_hash TEXT        -- SHA-256 of (prev_hash + payload + timestamp)
  timestamp TIMESTAMPTZ DEFAULT now()
  posted BOOLEAN DEFAULT false  -- whether anchor has been published publicly
```

**Hash chain logic:**
1. New record arrives (rating submitted, funds released, consent given, etc.)
2. Fetch the latest trust_ledger row for this record_type -> get its this_hash
3. Compute new hash = SHA-256(prev_hash || payload_json || timestamp_iso)
4. Insert row with prev_hash and this_hash
5. Mark posted = false

**Public bulletin board (hourly cron, zero cost):**
- A simple bot posts to a public Twitter/X account: "KuruTrust anchor #{batch_number}: {combined_hash_of_all_rows_posted_this_hour}"
- The bot also posts to a testnet faucet address (free, no gas) as a secondary anchor.
- Anyone can verify: take a transaction ID -> hash it -> compare against the published hourly anchor.
- Cost: one tweet per hour + one testnet post per hour = $0/month.

**DID format:**
`did:kurukoo:phone_hash` where phone_hash = SHA-256(memory_profiles.phone + salt). The salt is a platform-wide secret. Users can prove ownership by signing a challenge with their phone number as the private key (via WhatsApp OTP flow).

**Verification endpoint:**
`GET /api/trust/verify?record_id={id}` returns the full chain from that record back to genesis, with each hash computed server-side for client-side comparison.

**Why this beats blockchain:** No gas fees, no node infrastructure, no waiting for confirmations. A hash chain in PostgreSQL is cryptographically equivalent to a blockchain for append-only verification. The hourly Twitter post is the only thing anyone needs to trust — and it's free.

### 15.1 Trust Score Calculation

The `trust_score` field on `memory_profiles` (NUMERIC(3,2), default 5.0) is a composite metric that aggregates multiple trust signals into a single score. It is recalculated on every completed job and via a daily cron for all profiles.

**Formula:**
```
trust_score = 5.0                              // base
  + ((avg_rating - 3.0) * 0.5)                 // star ratings, range ±1.0
  + min(completed_jobs / 100, 1.0)             // transaction volume, max +1.0
  + (verified_provider ? 0.5 : 0)              // verification bonus
  - (disputes_lost * 0.2)                      // dispute penalty
  + min(account_age_days / 365, 0.5)           // longevity, max +0.5
```

**Inputs:**
- `avg_rating`: Average of all star ratings for this user across all skills (from `ratings` table). If no ratings, defaults to 3.0 (neutral).
- `completed_jobs`: Count of jobs where this user was the provider and `status = 'completed'` (from `orders` or `escrow` table).
- `verified_provider`: Boolean from `memory_profiles.verified_provider`.
- `disputes_lost`: Count of disputes where this user was found at fault (from `dispute_resolution` records).
- `account_age_days`: Days since `memory_profiles.created_at`.

**Range:** [0.0, 8.0] — scores below 3.0 trigger a review (§25 Negative Review Handling); scores above 7.0 qualify for Top Rated badge (§36).

**Recalculation:**
- **On job completion:** Immediately recalculate the provider's trust score.
- **Daily cron (2:00 AM):** Recalculate all profiles to pick up account age changes and any retroactive dispute resolutions.
- **Storage:** Write the new score to `memory_profiles.trust_score`. Also log the inputs and computed score to `trust_ledger` (§15) as a `record_type = 'trust_recalc'` entry for auditability.

**SQLite note:** The formula uses standard SQL aggregate functions (`AVG`, `COUNT`, `julianday('now') - julianday(created_at)`) that work in both SQLite and PostgreSQL.

---

## 17. Content Moderation and Safety

Three-layer pipeline. Zero cost for layers 1-2. Human review only for escalations.

**Layer 1 -- Hard blocklist (zero cost, instant):**
- Stored as a JSON file: `config/blocklist.json`
- Contains: regex patterns for known scams, drug codes, explicit terms, NDPC-prohibited requests
- Checked via regex match on every inbound message before AI routing
- Blocked requests get a standard redirect: "I can't help with that. Try [legitimate alternative]."
- Blocklist updated via admin console — no deploy needed

> **Developer note — Blocklist storage:** The `config/blocklist.json` file does not yet exist in the codebase. When implementing Layer 1, create the file at `config/blocklist.json` with an initial set of regex patterns. The `complianceFilter.ts` service should load the blocklist at startup and cache it in memory (with a file-watch or manual admin refresh to pick up changes). Alternatively, store patterns in a `blocklist` database table for admin-console management without file access. Either approach is acceptable; the database approach is preferred for production.

**Layer 2 -- AI intent classifier (zero marginal cost):**
- FastText model (§21.1) classifies every message that passes the blocklist
- If confidence < 0.7 for all known intents -> flag as "ambiguous"
- Ambiguous messages get a clarifying question instead of a blind match
- High-risk intents (emergency, health, financial) automatically require provider verification before match

**Layer 3 -- Human review (cost-minimised):**
- Only triggered when: (a) Layer 2 flags as ambiguous, (b) user reports content, (c) provider rating drops below 3.0
- Review queue in admin console (Section 32): shows message, context, user history
- Moderator actions: dismiss, warn user, suspend skill, ban user
- All actions logged to compliance_events table

**Emergency services bypass:**
- Kurukoo is a dispatcher, not a provider. It surfaces verified emergency contact numbers and connects users to licensed third-party responders.
- Life-threatening emergencies bypass all three layers instantly. No AI delay.
- Liability disclaimer on every emergency interaction. No freemium refusal for life-threatening emergencies.

**Illegal request handling:**
- Redirected to legitimate alternatives (e.g., "For medical emergencies, dial 112 or visit the nearest hospital")
- Logged in compliance_events with category = "redirected_illegal"
- Pattern tracked: if a user triggers 3+ redirects in 7 days, their account is flagged for review

---

## 18. Anti-Bias & Fairness

Inferred skills are suggestions, never assignments. User must explicitly confirm.

**Rules:**
- No demographic-based inference. Skills inferred solely from behaviour, never location/gender/name.
- User override: any inferred skill can be rejected or deleted with one tap in the profile settings.

**Quarterly bias audit (automated + human):**
- Automated check (zero cost): SQL query groups inferred skills by LGA, device type, and registration month.
  ```sql
  SELECT primary_lga, skill, count(*) as inferred_count,
         avg(confidence) as avg_confidence
  FROM skills
  WHERE source = 'inferred'
  GROUP BY primary_lga, skill
  HAVING count(*) > 10
  ORDER BY inferred_count DESC;
  ```
  Flag any (LGA, skill) pair where inferred_count is >2 standard deviations above the mean for that skill — that indicates demographic clustering that may be bias.
- Human review (admin team): Review flagged pairs. Check whether the inference is behaviourally justified (e.g., many okada riders in a transport hub is expected) or algorithmically biased (e.g., all hairdressers inferred in one LGA due to a data artefact).
- Remediation: If bias is confirmed, the trigger thresholds for that skill in that LGA are increased by 20% for the next quarter to reduce false positives.
- Audit published internally (admin console) with timestamp, findings, and remediation actions.

---

## 41. Privacy & Security

- All personal phone numbers masked via privacy bridge (Africa's Talking / Twilio).
- Encryption at rest (AES‑256) and in transit (TLS 1.3).
- Data minimisation: location history purged after 30 days unless opted in.
- Right to deletion within 30 days.
- 72‑hour breach notification to NDPC and affected users.
- Annual third‑party penetration testing

### 41.1. Compliance & Safety

- **OTP flow:** User‑initiated "CONFIRM" message via WhatsApp/PWA. No SMS OTP. Post‑registration re‑authentication via push/biometric.

> **GenUI Alignment Note (Adopt Now — Consent-First Data Capture):** GenUI's floating mic button with explicit moment-to-moment consent provides a stronger UX pattern for granular consent than broad activation flows. Kurukoo should consider applying this pattern for specific data capture moments — location sharing per session, voice clip processing, device access — strengthening the privacy stance already established in §41. Each consent event should be auditable and revocable independently.
>
> **Living Memory Engine Alignment Note (Watch — Multi-Person Attributed Memory):** The Living Memory Engine supports privacy-scoped retrieval for attributed multi-person memory — useful when multiple people share a device or conversation context. Kurukoo could use this for: (a) money circles (§9) with multiple members, (b) family plans (§35.2.1), (c) business accounts with multiple staff. No immediate action required while Kurukoo remains 1:1 (user↔platform), but monitor for adoption when group/community features move from `future_plans` to active development.
- **Content moderation:** Multi‑layer pipeline with AI intent classifier, hard blocklist, and human review for sensitive categories.
- **Emergency services:** Kurukoo is a dispatcher, not a provider. It surfaces verified emergency contact numbers and connects users to licensed third‑party responders. Liability disclaimer on every emergency interaction. No freemium refusal for life‑threatening emergencies.
- **Anti‑bias:** Inferred skills are suggestions, not assignments. Quarterly bias audit. User override always available.
- Compliance Filter, User Reporting, Dispute Resolution, Verified Provider Badges, Verified Artist Booking (with escrow, manager verification, and cooling‑off period), Scam Reports Dashboard.

### 41.2. UK Market Specifics

- **Pricing:** Base £1/month, Plus £3.99/month, Business £4.99/month. Points: 1 Point = £0.002.
- **Mobility:** Location status checks and delivery tracking only. No ride‑hailing.
- **Food ordering:** Conversational front‑end partnering with existing platforms or independent restaurants.
- **Local services:** Point‑exchange model with 3‑strikes grace policy for low‑Point providers.
- **Community board:** Local clubs, events, volunteer opportunities.
- **Child safety:** Strict compliance with UK Children's Code. Under‑16 accounts supervised; under‑13 not permitted.
- **Diaspora "Send Support Home":** Send airtime, data, pay Nigerian bills, or book services for relatives — all from the UK chat.
- **Payments:** All peer‑to‑peer payments via Stripe Connect; Kurukoo never holds funds.

---

## 16. Service Verticals and Skills Taxonomy

**Vertical layer (active now):** 300+ skill tags across 45 categories designed for the informal economy in Africa. Skills-based matching engine with USSD shortcuts.
Active categories include: food, ride, worker, emergency, health, personal_care, education, events, accommodation, agriculture, professional, spiritual, freelance, gigs, errands, other, communication, logistics, tourism, creative, security, fitness, nightlife, betting, money_circle, classifieds, price_check, government, community, cravings, reach_reference, language_services.

**Horizontal layer (future via feature flags):** UK life-admin skills (see §35.2) are the first horizontal extension. They use the same `skill_flows` table, same memory profile, same Points balance, and same conversation engine — but are gated behind `memory_profiles.country = 'GB'` and `/gb/` locale feature flags. Additional category-friendly names are used for user-facing labels: Government & Civic Help, Automotive Care & Mechanics, Finance & Tax Consulting, Health & Medical, Pet & Animal Care, Community & Neighbourhood, Repairs & Maintenance, Digital Services, Accommodation & Lodging, Property & Real Estate, Driving & Chauffeur Services, Childcare & Nanny Services, Agriculture & Produce, Safety & Security, Fitness & Coaching, Creative Arts & Media, Language & Dialect Services, Freelance Services, Professional Services, Transport & Mobility, Emergency Dispatch, Food & Drink, Entertainment & Music, Tourism & Travel, Classifieds & Marketplace. These map to the existing taxonomy keys and are used for user-facing labels only.

> **Authoritative category list:** The full 45-category taxonomy with every skill tag is maintained in **`ECOSYSTEM.md` §9 — Category Map (Unified Engine) — v5.38 Expanded (45 Categories)**. That table is the single source of truth for category names, icons, and skill tag membership. This blueprint references categories illustratively; ECOSYSTEM.md §9 is the complete registry. When a new skill is added (e.g., in §35.2), it must also be added to the appropriate ECOSYSTEM.md §9 category row so the taxonomy stays in sync.

**Feature-flag rule:** Any skill intended for a future market or vertical must include an `available_locales` array in its `skill_flows.question_set` JSON (e.g., `["ng", "gh"]` or `["gb"]`). If this field is absent, the skill is available to all locales by default. The proactive engagement engine, quick replies, and Daily Picks all respect `available_locales` and `memory_profiles.country` when surfacing skills. No new access-control system is required.
Provider Operation Modes: mobile, stationary, delivery, hybrid.

### 16.1. Delivery vs Errands — Distinct Flows on a Shared Engine

Delivery and Errands share Kurukoo's single `find_worker` engine (§4), the single memory profile, the single conversation thread, and the single Points balance. They are not separate apps, separate code pipelines, or separate user states. The distinction is **declarative**: each is a `skill_flows` entry with its own matching weights, question sets, pricing model, and fulfilment instructions. They are never collapsed into a single `skill_flows` configuration, because the two domains optimise on different axes.

- **Delivery** (`delivery`, `dispatch_rider`, `delivery_rider`): movement of a physical item from point A to point B. Matching prioritises riders within a tight radius with the right transport mode (bicycle, motorbike, van). Pricing is per_job / per_distance with live tracking (liveCast) during the active leg. Fulfilment uses `livecast_tracking`.
- **Errands** (`errand`, `personal_assistant`, `grocery`, `medicine_delivery`, `document_delivery`, `bill_payer`, `queue`, `airport_pickup`, `luggage`): a person performing one or more small tasks on the user's behalf (pick up, drop off, pay a bill, stand in a queue). Matching prioritises trust score and proximity over raw speed. Pricing is per_task or hourly. Fulfilment is primarily `chat_only` with optional `privacy_bridge_call`; live tracking only when an item is physically in transit.

Both write to the same memory profile and appear inside the same conversation, but the matching weights, question sets, pricing models and fulfilment instructions are configured independently in `skill_flows`.
Skill Dimensions: availability_schedule, service_radius_km, transport_mode, pricing_model, payment_method.

**Hybrid tasks (shared engine, sequential matches):** Because both run through the same `find_worker` engine and the same conversation thread, a single user request that combines both domains — for example, "shop for my groceries at the market and deliver them to my home" — executes as two sequential skill matches without the user switching apps or context. The errand match (trust-weighted) handles the shopping leg; the delivery match (speed-weighted) handles the transit leg. Each leg charges its own lead fee and writes its own completion to the single memory profile. An errand may escalate its `fulfillment_instructions` from `chat_only` to `livecast_tracking` for the transit portion only, then revert once the item is delivered.

The platform uses a skills‑based matching engine, with select categories. USSD menus group common skills into UI shortcuts, but the underlying engine queries the `skills` table. Over 300 skill tags exist across 45 categories, including food, ride, worker, emergency, health, personal_care, education, events, accommodation, agriculture, professional, spiritual, freelance, gigs, errands, other, communication, logistics, tourism, creative, security, fitness, nightlife, betting, language_services, money_circle, and more.

---

## 45. Provider Operation Modes & Skill Dimensions

### 45.0 Provider Entity Model and Fulfillment Boundary

> **A Kurukoo provider is an entity capable of fulfilling an Economic Request; it may be human, business, software service, vehicle, robot, drone, autonomous asset, external platform, or other authorized agent/provider.**

Provider identity is entity-type agnostic. A provider's declared skill rows remain its capability source of truth; availability is recorded through the existing profile and skill availability fields; service area uses the existing location and service-radius fields; and `operation_mode` records the current fulfillment mode. Provider type alone never grants authorization, verification, payment, escrow, dispute, delivery, or lifecycle privileges.

The canonical path remains `Economic Request → provider discovery → provider capability match → quote → acceptance → fulfillment → completion → escrow/reward/dispute`. Human and business providers use the current fulfillment path. Autonomous assets are a supported provider concept, **not** a claim of integrated autonomous hardware control. Kurukoo does not currently control drones, vehicles, or robots; obtain autonomous telemetry; perform autonomous flight; or integrate with a live robotics or aviation provider. Any future execution adapter is an external integration boundary and must satisfy the same authorization, payment evidence, escrow, dispute, delivery, skill, and audit controls as every other provider.

A person or organization can hold multiple non-exclusive roles on the same identity: user, contributor, provider, business operator, or asset owner. A contributor remains a separate contribution and reward role; it does not imply provider eligibility. First-class AI agents retain their own prompts, tools, skills, quotas, concurrency, escalation, status, and administration, while their mirrored provider representation is `software_service` when they participate in canonical provider discovery. That type is descriptive only and does not bypass payment, escrow, dispute, delivery, or authorization controls.

Existing businesses and external operators may use Kurukoo as an additional customer-access channel without replacing their own websites, apps, regulated operations, fleets, or fulfillment infrastructure. Kurukoo can supply discovery, conversational demand capture, Economic Requests, status coordination, and—where separately verified—transaction or commission flows. The provider remains responsible for its regulated operation and fulfillment. This model can represent independent riders, keke and taxi operators, courier companies, restaurants, repair businesses, transport platforms, external platforms, future robotics operators, and other authorized providers through the same skill and verification architecture; it does not create or claim a live integration with any named company.

Nigeria already contains independent transport operators and businesses across transport aggregation, logistics, ride-hailing, and emerging drone logistics. Kurukoo's differentiating architecture is therefore not merely another category marketplace: it is the ability to coordinate heterogeneous authorized fulfillment providers through one Economic OS. This is a product-architecture statement, not a claim of market share, exclusive capability, or existing third-party integration.

**Current IoT status:** `iotBridge.ts` and the device-command browser prototype are not a production fulfillment integration. The audit found no mounted `/api/iot/command` route, no startup composition import for the MQTT bridge, and no complete device identity, authorization, command-execution, or audit path. They must be treated as future external fulfillment-integration boundaries until those shared controls exist; the platform makes no current claim of IoT-device control.

#### Orchestration roles, channels, and commercial boundaries

Kurukoo is a **conversational fulfillment and orchestration network**. It is not primarily a taxi company, courier fleet, marketplace operator, drone company, IoT platform, payment institution, or static chatbot. Channels are access points to the same orchestration system; providers are fulfillment entities; skills describe capability; Economic Requests represent intent/work; agents can reason and orchestrate; contributors and partners extend the network; and Points remain a bounded usage/reward/commercial mechanism rather than money or a financial instrument.

An **agent** and a **provider** remain distinct concepts. An agent can reason, discover, negotiate within its authorization, execute permitted actions, and report state or evidence on behalf of a human, business, provider, Kurukoo function, external service, or future asset. A provider is the entity capable of fulfillment. The first-class `ai_agents` model preserves prompts, tools, quotas, concurrency, escalation, status, and administration; when an AI agent itself offers a declared skill through canonical discovery, its mirrored provider record is `software_service`. Contributor, ambassador, sales-consultant, referral, and agent-network participation are non-exclusive network/commercial roles, not automatic provider authorization or separate identities.

The canonical Economic Request lifecycle remains the sole lifecycle and has **one selected primary fulfillment provider**: it collects verified payment evidence, protects an eligible transaction with one buyer-to-primary-provider escrow record, collects completion evidence, and handles disputes. An Economic Request can now additionally carry one durable, informational seller offer reference and explicit `seller`, `delivery_provider`, `external_platform`, and registered `agent` participants. Each participant has its own declared capability, coordination status, and evidence payload, so a seller handover and delivery collection can be recorded distinctly on the same request. Existing single-provider requests remain unchanged when no offer or participants are attached.

For an explicit conversational reference to a known seller offer, Kurukoo can search only currently `available` offer references held by independently verified seller profiles, display the seller-stated availability and price, and start **one** `product_sourcing` Economic Request when the buyer chooses it. The selected request receives an auditable offer snapshot and seller participant; it is not a browseable global inventory catalogue, seller reservation, stock confirmation, or price guarantee. When the buyer requests delivery and provides a location, the same request can display existing verified providers with the declared `delivery` capability and record one buyer-selected delivery participant. A provider's listed delivery rate is informational until an authorized canonical quote and verified payment exist; it does not add a second charge or replace the seller offer price.

Offer provenance is constrained to `seller_created`, `externally_sourced`, `affiliate_derived`, or `conversationally_created`, and availability is explicitly status-marked rather than assumed. Seller and delivery participants may submit their own role-specific evidence only when they are the authenticated participant; the request owner may also submit coordination evidence. Each submission receives server-recorded actor, scope, timestamp, and `submitted_unverified` attribution. This preserves a future proof-of-delivery or external-callback boundary without treating a client-supplied reference as verification, integration evidence, payment evidence, or instruction to execute an external action.

This is deliberately a coordination representation, **not** a separate marketplace checkout, delivery engine, affiliate engine, second lifecycle, inventory system, tracking system, or multi-party settlement mechanism. An offer price does not replace the canonical request quote. A delivery quote remains role-specific evidence and does not create a payable amount. Participant roles neither grant verification, authorization, payment, escrow, dispute, or provider privileges; seller, delivery-provider, and external-platform participants require an independently verified provider profile, while an `agent` participant must be a registered first-class AI agent and is not thereby the fulfillment provider. External platforms are referenceable without asserting an integration.

The storefront can project the same request as offer review, delivery selection, seller handover, or delivery-in-progress when authorized participant data exists. Those cards display declared or submitted evidence only and do not fabricate inventory confirmation, seller reservation, external order status, live delivery tracking, handover, or payment capability. Escrow remains single-recipient until a separately specified, regulated, and fully audited multi-party settlement design exists.

The existing deferred-intention worker can retain a user request, re-run canonical discovery, resume the related storefront, and attempt configured push notification when a provider becomes available. It is not a generic customer-relationship system or unrestricted outbound opportunity engine. Cross-channel delivery must observe each channel's actual consent, template, and messaging-window requirements. For example, WhatsApp Business Platform pricing and permitted message types depend on template category and whether a customer-service window is open; template messages are the normal mechanism for outbound messages outside that window. [Meta WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing). SMS, voice, email, Telegram, WhatsApp, partner applications, external AI assistants, and future agent networks therefore remain access/integration boundaries with provider-specific credentials, policies, and costs.

Third-party AI and channel access is not assumed free. Production use requires an approved account, credentials, contractual/policy review, spend limits, and per-provider cost treatment. Official pricing and policies change and must be checked at integration time: [OpenAI pricing](https://openai.com/api/pricing/), [Anthropic pricing](https://www.anthropic.com/pricing), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), and [Alexa Skills Kit](https://developer.amazon.com/en-US/alexa/alexa-skills-kit). Channel/API cost belongs in Kurukoo's commercial accounting or partner agreement; it does not create a Points-to-money equivalence.

Current evidence and tracking are intentionally limited to authorized application data: provider presence/location is privacy-fuzzed, request/fulfillment state is stored in the canonical lifecycle, messages and supported attachments remain in the conversation boundary, and WebRTC signaling is a communication primitive rather than live delivery tracking. Future provider tracking, proof of delivery, signatures, OTPs, photos, external webhooks, or telemetry must enter as authorized evidence on the same Economic Request and audit trail. No live fleet, device, drone, robot, or external-order tracking is claimed.

### 45.1 Operation Modes

Providers can set their operation mode during skill registration:
- **mobile**: Provider moves around (rider, delivery). Enables Kuru Pulse "Go Live".
- **stationary**: Fixed location (barber, tutor). Cannot use Kuru Pulse.
- **delivery**: Provider delivers goods. Can use Kuru Pulse.
- **hybrid**: Both mobile and stationary work. Partial Kuru Pulse eligibility.

### 45.2 Provider Skill Dimensions

During skill registration, providers set additional dimensions:

| Dimension | Values | Purpose |
|-----------|--------|---------|
| `availability_schedule` | weekdays_8_5, weekends, 24_7, custom | Match when available |
| `service_radius_km` | 5, 10, 20, 100 (statewide) | Limit matching to travel range |
| `transport_mode` | foot, motorbike, car, truck | Delivery speed/capacity |
| `pricing_model` | fixed, hourly, per_job, negotiable | Budget filtering |
| `payment_method` | cash, wallet, Points, bank_transfer, all | Payment compatibility |

**Database**: `skills` table includes all 5 dimensions
**Registration Flow**: Asked during onboarding across USSD, WhatsApp, and PWA

---

## 19. Competitive and Global Precedent

**Vertical layer competitors (informal economy Africa):**
- JustDial (India): Phone-based local search for any service. >$1bn market cap. B2B lead fees, premium listings, advertising.
- Magic/GoButler (US/Europe): SMS concierge; proved concept but constrained by high labour costs.
- GovChat (South Africa): WhatsApp-based government services concierge; validates African appetite for chat-first public services but failed in 2020 when Meta offboarded it for alleged WhatsApp Business API terms violations (multi-client aggregation, data handling). Lesson: single-channel dependency is an existential risk.
- SweepSouth/Domestly/Mr D (South Africa): Specialised vertical app-based service platforms.

**Horizontal layer competitors (smart city / utilities / life-admin):**
- Alexa / Google Home: Voice-first life-admin (reminders, shopping, smart home). But not conversation-first, not multi-role, not Africa-optimised.
- Citymapper / Whistl (UK): Local services and delivery. But app-first, not chat-first, not multi-skill.
- Gojek / Grab (Southeast Asia): Super-app with ride, food, delivery, payments. But app-first, not chat-first, not informal-economy-optimised, no USSD.

**White space:** No player combines JustDial phone-first universal service + African-language voice + mobile-money payments + informal-economy digitisation **in a vertical layer** — AND simultaneously architected as reusable infrastructure for smart-city/MVNO/utility deployment **in a horizontal layer**. That is Kurukoo's defensible position.

**Key insight:** The vertical layer (informal economy Africa) is a market opportunity. The horizontal layer (smart-city/MVNO infrastructure) is a defensible moat. Competitors can copy the vertical layer; few can copy the horizontal architecture because it requires building for both informal-economy density AND smart-city scale from day one.

---

## 20. Diaspora and Returnee Positioning

Nigerians returning from South Africa miss: centralised emergency response, insured home services, formal credit access, broadband independence, Pidgin/English hybrid comfort.
Kurukoo replicates these via: emergency directory, provider rating + escrow + micro-insurance, USSD/IVR-first design, Pidgin-first IVR option.
Channel: NIDCOM partnerships, Facebook diaspora groups, church networks.

---

## 21. AI & Intelligence Layer

### 21.1 Self‑Hosted AI Stack
| Component | Runtime | RAM | Purpose |
|-----------|---------|-----|---------|
| **FastText** | Local (VPS) | 10 MB | Primary intent classifier (target: 98% of traffic). Auto‑trained on server start if model missing. |
| **Groq API (Llama‑3.1‑8B‑Instant)** | Cloud free tier | 0 | Complex 2% fallback (translation, open‑ended chat). Rate‑limited to 1000 calls/day. |
| **DeepSeek Coder 1.3B (Q4)** | Local dev MacBook | ~1 GB | Code completion during development (not in production). |

**FastText Training Pipeline:**
1. Generate initial training examples from regex patterns in `intentRouter.ts`.
2. Augment with logged low‑confidence inputs from production.
3. Periodically retrain the model and deploy the new version.

### 21.2 Intent Router

Four-tier cascade, zero marginal cost for tiers 1-2:

1. **Rule-based regex** — instant, zero-cost, catches 85-90% of traffic.
   - 200+ patterns covering rides, food, skills, Pulse, wallet, onboarding
   - Executes in <5ms, no API call
2. **FastText** — self-hosted, zero marginal cost, catches another 8-10%.
   - 10MB model, auto-trained on labeled Kurukoo conversations
   - Executes in <50ms locally
3. **Groq API** — free-tier Llama-3.1-8B via open router, handles remaining 2-5%.
   - Multi-provider fallback (Groq, Mistral, Gemini, OpenRouter)
   - Prompt includes memory profile context for personalisation
4. **Template fallback** — rule-based `general_question` handler if all else fails.
   - Asks 1-2 clarifying questions then re-classifies

**Training pipeline (run weekly via cron, zero ongoing cost):**
- **Week 1 seed:** 200 manually labeled examples across all 16 intents
- **Ongoing augmentation:** Low-confidence classifications (0.3-0.7) are logged with the correct intent once the user replies
- **Retrain trigger:** Every Sunday at 2am, collect the week's corrections, augment training data, retrain FastText model
- **Model storage:** `models/fasttext/intent_classifier.bin` (10MB)
- **Training data format (JSONL):**
  ```jsonl
  {"text": "I need a plumber", "label": "__label__find_worker"}
  {"text": "How much is rice", "label": "__label__price_check"}
  ```
- **Quality gate:** If new model accuracy < 95% on held-out test set, keep the old model

### 21.3 Proactive Opportunity & Survey Engine

The platform does not rely on a public gig board. Instead, it pushes personalised opportunities into the user's conversation. Survey-style Yes/No questions with images collect latent intent and generate opportunities.

**Delivery channels:**

1. **Push notifications (FCM):** Free, instant. Deep-link into WhatsApp or the PWA Chat tab.
2. **WhatsApp user-initiated messages:** When a push deep-links into WhatsApp, the user's tap opens the service window for free.
3. **PWA Notifications tab:** A permanent, scrollable record of all opportunities. Acts as a history and fallback.

**Nudge ranking algorithm:**
```
score = (user_need_match * 0.4) + (urgency * 0.3) + (recency * 0.2) + (business_value * 0.1)
```
- `user_need_match`: 1.0 if the nudge matches an inferred need, 0.3 if general
- `urgency`: 1.0 for time-sensitive (same-day), 0.5 for this-week, 0.2 for general
- `recency`: 1.0 if never sent before, decays by 0.1 per repeat
- `business_value`: 1.0 for revenue-generating (sponsored, lead-gen), 0.5 for engagement

Top 3 nudges per user per day. Max 1 push per 6 hours. No spam.

**Nudge types:**
- Market intelligence: "Bag of rice is now N3,000 in Lagos. Your shop price is N3,500 - find cheaper suppliers?"
- Skill demand alerts: "10 people near you need a plumber this week. Go Live?"
- Personalised Daily Picks and re-order suggestions
- Engagement rewards: "You've been active 7 days straight! +1 Point bonus#### 21.3.1. Proactive Opportunity Generation
Kurukoo doesn't just wait for requests. It actively creates opportunities by:

Market intelligence nudges:
"Bag of rice in Lagos market is now ₦3,000. You have a shop in Ikeja – want us to connect you with wholesale suppliers?"
"10 people near you are looking for a plumber this week. Your plumbing skill is in demand!"

Cross‑skill recommendations:
"You're a rider in Warri. 5 people in Jakpa need items delivered from Effurun. Want to earn ₵3 making those runs?"

Trending based on user profile:
Each user sees a personalized "Trending Near You" feed based on their skills, location, and past behaviour.

- A caterer sees: "3 events this weekend need caterers in your area."
- A bricklayer sees: "New building site opening in GRA – 2 contractors looking for workers."

Complex multi‑party coordination:
If someone in Jakpa needs an item from a shop in Effurun, Kurukoo coordinates:
- Shop (seller) confirms item and price.
- Delivery rider accepts the pickup and drop‑off.
- Buyer pays (via wallet(OPAY or Moniepoint), cash on delivery, or direct).
- All parties earn Points and ratings.

The platform records the entire transaction chain.

##### 21.3.1.1 Featured Use Case: Construction Site Boss

A site supervisor uses Kurukoo to source labourers, materials, and equipment in one multi-line request:
- "Need 5 labourers for tomorrow, 2 bags of cement, and a concrete mixer"
- Kurukoo parses the intent, creates separate gigs/requests, and matches each to the right provider
- All tracked under one project brief

#### 21.3.1.2. Proactive Opportunity Engine – Delivery and Notification Management

Delivery methods (aligned with the hybrid):
- Push notifications (FCM): Free, instant, deep‑link into WhatsApp or the PWA Chat tab.
- WhatsApp user‑initiated messages: When a push notification deep‑links into WhatsApp, the user’s tap opens the window for free.
- PWA Notifications tab: A permanent, scrollable list of all opportunities and market nudges that have been sent. This serves as a history and a fallback for users who missed a push.

Why the Notifications tab is needed:
- Push can be silenced or dismissed. A managed inbox inside the app ensures no opportunity is lost.
- Users can filter by type (Jobs, Market Intel, Daily Picks) and act directly from the notification card.

#### 21.3.2. Feedback & Reputation Loop (Reinforced)

After every completed transaction, both parties rate each other (1‑5 stars).

Ratings affect matching priority, Point bonuses, and provider visibility.

**Trust Score — Backend-Only (Internal):** The full Trust Score (a composite of ratings, completed jobs, response time and other signals) is computed and stored on the backend only. It is used for matching priority and for gating first access to premium/high-value opportunities. The raw composite score is never shown to users.

**Frontend Trust Signals (Public):** The frontend surfaces only human, verifiable signals that a user can independently understand: star rating, completed job count, Verified badge, and response-time badge. No opaque "score number" is displayed publicly.

### 21.4 Memory‑Powered Map (Internal Only)
Kurukoo maintains a private, detailed map of Nigeria with custom pins for every active provider, colour‑coded by skill, operation mode, and activity. Used internally to identify cold spots, arbitrage gaps, and monitor demand‑supply balance.

---

## 21a AI Agents as First-Class Users

AI agents are treated as first-class citizens of the ecosystem with their own constrained memory profiles and skills.

Each AI agent has:
- A mirrored profile in `memory_profiles` and `skills` allowing native interaction with the Points Engine, Ratings, Trust Score, and Proactive Engine.

- A phone-number-like identity (or internal agent ID)
- A highly engineered system prompt + tool set that prevents hallucination
- A limited set of skills (e.g. price_checker, reminder, buyer, seller, traffic_checker, purchaser, content_writer, support_triage)
- Strict concurrency, token and rate-limit quotas
- Full backend management tools in the admin console

Admin capabilities that must exist:

- Create / edit / pause / resume / delete any AI agent
- Tweak system prompt, tools, temperature, rate limits and skill assignments
- Assign or re-assign agents to specific LGAs, skill categories or user segments
- View live token usage, success rate, escalation rate and cost per agent
- Clone an existing agent as a template for a new one
- Set automatic pause rules (cost threshold, error rate, etc.)

AI agents run primarily on the hosted / free / open models (FastText for classification, Poolside Laguna, Gemma, etc.) with paid models only as last-resort fallback under hard daily quotas. They never hold private user data beyond what is necessary for the current task and always escalate to human when confidence is low or the task is sensitive.

> **MCP Alignment Note (Future — External MCP Tool Discovery):** AI agents should be able to dynamically discover and call external MCP tools based on task requirements. For example, a delivery dispatch agent could discover and use an MCP server for real-time traffic data, or a price-checker agent could query an external MCP pricing API. The existing agent skill system (§21a) should be extended with an `mcp_tool_registry` — a configurable list of external MCP tools that agents can discover, with access controls per agent. This positions Kurukoo as an MCP *consumer* — the AI agent network becomes a gateway to the broader MCP ecosystem, expanding its capabilities without building every integration in-house. **Status: Future — no buildable spec yet; reclassified from "Adopt Now" because no concrete implementation steps or MCP server contracts are defined.**
>
> **Kokoro-Engine Alignment Note (Future — Workflow Orchestration + Human-in-the-Loop):** AI agent task execution should be modelled as **named, versioned workflows** rather than free-form tool calls. Each agent workflow has a stable ID, explicit steps, retry policies, and compensation handlers — so that if a dispatch succeeds but payment fails, the workflow rolls back automatically. Human-in-the-loop pause points are critical: the Transaction Orchestration Engine (§33.1.3) should pause at coordination-exposure decisions and wait for admin confirmation; artist booking (§43) should pause at cooling-off → confirmed transitions; dispute resolution (§19) should pause for human arbitration. The workflow resumes only after the external event arrives. This separation of orchestration from LLM reasoning makes agent behaviour auditable, versionable, and safe — directly aligning with Kokoro-Engine's pattern. **Status: Future — no buildable spec yet; the human-in-the-loop pause-point concept is partially implemented via the escrow state machine (§33.1.3) and cooling-off cron (§43), but the full workflow-orchestration layer is not specified concretely enough to build.**

---

## 22. Referral Programme

Reward: 200 Points per new subscriber who completes first transaction. Single-level only (no MLM). Points credited to referrer balance. Distributed via WhatsApp menu [Invite and Earn] button.
Funded by Growth and Community Fund. Clearly documented as a loyalty reward, not an investment.

[🚕 Get Ride] [🔧 Find Worker] [📊 My Activity] [👥 Invite & Earn]

"Invite & Earn" leads to the referral flow.

Referral rewards are 200 Points, credited to the referrer's balance. Funded by the Growth & Community Fund.

---

## 36. Badges and Reputation

Badge types:
- Top Rated: Top 10% of ratings within skill category over past 90 days
- Verified: Completed NIMC identity verification and in-person spot check
- Contributor: Referred 10+ new subscribers AND/OR completed micro-tasks (see §36.1 Contributor System below). Graded: Bronze (10 referrals or 50 tasks), Silver (25 referrals or 200 tasks), Gold (50 referrals or 500 tasks). Contributors are sub-teammates in the ecosystem — not directly employed by Kurukoo but affiliated with providers or partner organizations. They perform basic operational tasks and are rewarded with airtime from the Growth & Community Fund (§10.2, capped ₦500/mo per user).
- Kuru Founder: Lifetime badge for first 1,000 subscribers

Badge display: Dashboard, provider profile cards, WhatsApp context menus. Recalculated monthly via batch cron.

### 36.1 Contributor System (v5.55)

> **Developer note (v5.55):** The blueprint previously mentioned a "Tasks" panel for Contributors but never specified what tasks they actually do. This subsection defines the full Contributor model per user direction.

**What Contributors are:** Contributors are sub-teammates in the ecosystem — not directly employed by Kurukoo but affiliated with providers or partner organizations. They have the `is_contributor` flag set to `true` in `memory_profiles`. They perform basic operational tasks that improve data quality and community safety, and are rewarded with airtime from the Growth & Community Fund (§10.2, capped ₦500/mo per user as a marketing expense).

**Contributor task types (displayed in the PWA "Tasks" panel, §32.3):**
1. **Price updates** — Contributor visits a nearby stationary provider (shop, bakery, chemist) and confirms/updates product prices in `skills.business_products`. Task payload: `provider_phone`, `product_name`, `confirmed_price`, `timestamp`. Earns 2 Points per confirmed price.
2. **Incident alerts** — Contributor reports a local incident (road closure, flooding, security incident, market disruption). Task creates a row in a `community_alerts` table (to create) with `type`, `location_lat/lng`, `description`, `severity`, `reported_by`, `created_at`. Alert is pushed to nearby users via Daily Picks/push. Earns 5 Points per validated alert.
3. **Neighborhood security updates** — Contributor reports safety status for their LGA (safe/caution/avoid). Updates a `neighborhood_status` cache (Redis, 6h TTL). Surfaces on Discover map as a safety overlay. Earns 3 Points per update.
4. **Confirm stationary locations** — Contributor visits a stationary provider's physical location and confirms it exists and is operational. Updates `skills.location_confirmed_at` timestamp and `skills.location_confirmed_by`. This improves the accuracy of the Discover map and Nearby Pulse. Earns 3 Points per confirmation.
5. **Onboarding assistance** — Contributor helps new users/providers onboard (walks them through WhatsApp registration, skill listing). Tracked via referral system (§existing). Earns standard referral bonus (200 Points) plus Contributor badge progress.
6. **Content verification** — Contributor verifies that a provider's listed services/products match what they actually offer. Earns 2 Points per verification.

**Badge grading (expanded):**
- **Bronze Contributor:** 10 referrals OR 50 completed micro-tasks
- **Silver Contributor:** 25 referrals OR 200 completed micro-tasks
- **Gold Contributor:** 50 referrals OR 500 completed micro-tasks
- Badges display on: Dashboard, provider cards, WhatsApp context menus, For You page Contributor card. Recalculated monthly via batch cron.

**Tasks panel (§32.3 expansion):** The PWA "Tasks" panel (visible only to users with `is_contributor` flag) shows:
- Available tasks near the contributor's current location (sorted by proximity and Point reward)
- Task history (completed tasks, Points earned, badge progress)
- Airtime reward balance (from Growth Fund, capped ₦500/mo)
- Badge level and progress to next tier

#### 36.1.3 Event Coverage Micro-Task (Video & Report)

> **Developer note (v5.58):** Extends §36.1 with a field-content acquisition model. This task type lets Kurukoo dispatch a Contributor to physically attend an event (sports match §55.3, National Event/festival §54, local tournament, market/community event) and capture original video/photos/report. It turns the Contributor network into a distributed, owned-content capture channel (the "Kuru Media" citizen-broadcast layer, §31). It is a slot within the existing micro-task plumbing and uses no new user-facing identity — it reuses `is_contributor` + the Tasks panel.

**Task type identifier:** `event_videography` / `event_reporting` (a distinct task kind, but same assignment, badge, and payment plumbing as §36.1.)

**Assignment flow (conversation-first, per §1.4 Rule 3):**
1. **Proactive offer (Rule 5):** The Cultural Calendar AI Agent (§54) / event system detects an upcoming event and matches it against Contributors whose `memory_profiles` show location proximity, accepted-task history, and optional `event_videographer` skill tag. A task card is pushed to the eligible Contributor(s) via the Tasks panel / WhatsApp: *"Cover [event] at [venue] on [date]. Pay ₦X + 20 Points. No advance needed."*
2. **Accept:** Contributor accepts via chat. Kurukoo records assignment (`task_status = 'assigned'`) and sends an access pass/QR or organizer reference if the venue requires proof of authorized coverage permission.
3. **Check-in (Rule 2):** On arrival, Contributor checks in — their `provider_presence` is set to the event venue live location, so the Discover map can show "Reporter live at [event]."
4. **Capture:** Contributor records video/photos and/or files a written report. Delivery is via PWA upload or WebRTC data channel (§32.11) — not by re-uploading on WhatsApp (cost control).
5. **Submit & moderate:** Uploaded media + report go to a **human moderation queue** (approved gate — never auto-published). Moderation checks: quality/lighting/framing, no personal-injury-explicit or gory content, no incidental bystander PII exposed, content matches the assigned event.
6. **Approve + pay:** On approval, payout is triggered to the Contributor. **Status:** `awaiting_payment → paid`; content is marked `published`, rights-acquired.
7. **Distribute:** Approved content flows to: Daily Picks, Discover map layer ("Live"/"Recent" event tiles), blog/CMS («Kuru Media»), and optionally sponsored placements or venue co-produced packages (§36.1.3.2).

**Payment model (per user request — airtime OR OPay wallet):**
- Contributors are paid in **either airtime (from the Growth & Community Fund) OR cash to their OPay/Moniepoint wallet**, at their choice, per task.
- Because field content capture is higher-effort/risk than a 2-Point price update, **event coverage is NOT capped by the standard ₦500/mo contributor airtime cap.** Instead it has its own per-task rate + a monthly content cap, treated as production cost (not marketing expense).
- **Suggested base rates (configurable):** Short clip/report ₦500 + 20 Points; half-day full event coverage ₦2,000–₦3,000 + 50 Points; full-day multi-clip package ₦5,000 + 100 Points. Rates are stored in config so they can be tuned per region/event type.
- Wallet payout uses the existing OPay/Moniepoint disbursement path (§7 / §35.2.6.1) with the Contributor's `wallet_phone` stored on their `memory_profiles` at first payout (with explicit consent).
- Points still accrue toward Contributor badge tiers even when the primary reward is cash — recognition and reputation scale independently of cash.

**Content rights & terms — "we owe rights" (the crucial piece):**
- **Assignment of rights:** Before any pay is issued, the Contributor must accept the **UGC Content Licence Agreement** (presented in chat at check-in or before first payout). Under this agreement the Contributor grants Kurukoo a **perpetual, worldwide, royalty-free, sub-licensable licence** to use, reproduce, edit, distribute, display, and promote the submitted content across all Kurukoo surfaces and partner placements, and to create derivative works.
- **Payment conditioned on rights:** Rights are secured *only after* payment is made. If a Contributor refuses the licence, the task is cancelled and content is not used. Clean rule: **no payment → no licensed use.**
- **Moral rights / credit:** Terms state Kurukoo may credit the Contributor ("Footage by [name], Kuru Contributor") at its discretion; credit is not a condition of use.
- **Third-party content warranty:** Contributor warrants the content is original, does not infringe third-party rights, and that identifiable people/venues in a private context have given consent. Event/venue consent is pre-arranged by Kurukoo via the venue partnership below.
- **Exclusivity is non-exclusive (Contributor-friendly):** once paid, Kurukoo keeps its perpetual licence but the Contributor may also sell/license the footage elsewhere. This reduces sign-up resistance while still securing Kurukoo's use.
- **Withdrawal/removal:** Kurukoo may take content down for legal/DPA/NDPR or platform-safety reasons at any time; Contributors may request removal of personal attribution but not the underlying licensed content.
- **Compliance:** Aligned with NDPA 2023 (Nigeria) and UK GDPR (`/gb/` locale); incidental bystander faces are minimised and crowd footage exposing identified PII is avoided or blurred at moderation.

**Venue / organizer partnership (36.1.3.2):**
- Kurukoo partners with venues, event organizers, and leagues to: (a) authorise Contributors' access (so they are not trespassing), (b) co-produce official coverage packages, and (c) cross-promote the venue's own events into the National Events calendar (§54) and Daily Picks.
- Partner venues may sponsor coverage or receive a revenue share on co-produced highlight content.

**Moderation & safety guardrails:**
- Human approval gate before any payout and before any publish (never auto-publish — avoids accidental exposure of minors, gore, or PII).
- No coverage of paid/private events without venue authorisation.
- Contributors must be `verified` (basic NIMC/vetting per §55.2 standard level) before being offered paid event work above the base clip tier.

**Domain/integration:** This adds task type #7 to §36.1's list and extends the `GET/POST /api/contributor/tasks` endpoints with an `event_coverage` payload type (`event_id`, `task_type`, `rate_pence`, `payout_method`, `licence_accepted`, `media_urls[]`, `moderation_status`).

---

## 39. Explore Hub (Dynamic card-based discovery, not a feed.)

Explore Hub surfaces content through cards, not a scrollable feed. Cards are algorithmically selected per user, per session.

**API endpoint:** `GET /api/explore?phone={phone}` returns a JSON object:
```json
{
  "cards": [
    {"type": "trending_skill", "title": "Plumbing", "subtitle": "12 requests this week in Ikeja", "cta": "Find a plumber"},
    {"type": "pulse_provider", "title": "Emeka (Okada)", "subtitle": "0.3km away, 4.8 stars", "cta": "Request ride"},
    {"type": "opportunity", "title": "3 caterers needed", "subtitle": "Events this weekend", "cta": "View details"}
  ]
}
```

**Card types supported:**
- Trending skills (highest request volume in user's LGA, last 7 days)
- Kuru Pulse providers (active Pulse providers sorted by distance, consent-based)
- Proactive opportunities from the Opportunity Engine (Section 21.3)
- Sponsored placements (every 6th card is sponsored, marked "Sponsored")

**Trending algorithm (single nightly SQL query, zero ongoing compute cost):**
```sql
SELECT skill, primary_lga, count(*) as request_count
FROM requests r
JOIN memory_profiles m ON r.phone = m.phone
WHERE r.created_at > now() - interval '7 days'
GROUP BY skill, primary_lga
ORDER BY request_count DESC
LIMIT 20;
```
Results cached in Redis with TTL = 24 hours. Served instantly to all Explore requests.

**Card data architecture:**
```json
{
  "id": "uuid",
  "type": "trending_skill|pulse_provider|opportunity|sponsored",
  "title": "Plumbing",
  "subtitle": "12 requests this week in Ikeja",
  "image": null,
  "cta_text": "Find a plumber",
  "cta_action": "open_chat|open_explore|open_profile",
  "cta_payload": {"skill": "plumber", "lga": "Ikeja"},
  "sponsor_id": null,
  "score": 0.0
}
```

**45-category mapping:** Each category in ECOSYSTEM.md Section 9 has a slug (e.g., `/explore/transport-mobility`). When a user taps a category card, they see the live hybrid chat component (Section 40) embedded in the category page.

**Explore card grid also shows:**
- Kuru Pulse active providers: "Nearby Now" horizontal scroll showing Pulse-live providers
- Recommended gigs based on user's skills and LGA
- Quick actions: Ride, order food, find work, Go Live
- Recent activity summary (last 5 transactions)
- Recent opportunities (anonymised)

---

## 43. Verified Artist Booking

Verified artists are providers with a manager-verified profile. They can be booked for events, performances, and appearances through the platform.

**Artist signup flow:**
1. Artist applies via PWA or WhatsApp: "I'm a musician/comedian/performer"
2. System creates a `skills` entry with `verified_artist = false` and `source = 'inferred'`
3. Artist provides manager name + contact. System stores in `skills.manager_contact` (JSON)
4. Admin reviews: checks manager is real (call/WhatsApp), artist has portfolio (social links), and Trust Score is acceptable
5. Admin sets `verified_artist = true` and `source = 'explicit'`
6. Artist gets a trust badge on their provider card and appears in Verified Artist search results

**Booking workflow (state machine):**
```
States: pending -> cooling_off -> confirmed -> completed
                                       -> cancelled
                                       -> disputed
```

1. Customer requests booking: selects artist, date, time, venue, budget
2. Platform creates `escrow` record with full budget held via OPay/Moniepoint
3. System sets `status = 'cooling_off'` and starts a 24-hour timer
4. **During cooling-off (first 24 hours):**
   - Either party can cancel without penalty -> funds returned to customer immediately
   - If neither party cancels -> auto-transitions to `confirmed`
5. **Confirmed:** Artist performs, customer confirms completion -> funds released to artist minus Kurukoo fee
6. **Customer dispute:** If customer reports no-show or unsatisfactory performance -> enters `disputed` state, admin reviews, refund or partial release based on evidence
7. **Artist no-show:** If artist misses without notice and without cooling-off cancellation -> full refund to customer + Trust Score penalty for artist

**Cooling-off implementation:**
- Cron job runs every 15 minutes: checks `escrow` table for rows where `status = 'cooling_off'` and `created_at < now() - interval '24 hours'`
- Auto-transitions those to `confirmed`
- Sends WhatsApp notification to both parties: "Your booking is now confirmed. See you on [date]!"

**Database schema additions:**
- `skills.verified_artist` (boolean) — already exists
- `skills.manager_contact` (JSON: {name, phone, relationship}) — add to skills table
- `escrow` table: id, booking_type, provider_phone, customer_phone, amount, status, cooling_off_until, completed_at, dispute_reason

> **Developer note — Escrow table migration required:** The current `escrow` table in `src/database.ts` is missing four columns needed by the booking state machine. Add these via `ALTER TABLE` migrations in `initTables()`:
> ```sql
> ALTER TABLE escrow ADD COLUMN booking_type TEXT;         -- 'artist_booking' | 'trade_orchestration' | null
> ALTER TABLE escrow ADD COLUMN cooling_off_until TEXT;    -- ISO 8601 timestamp, 24h after creation
> ALTER TABLE escrow ADD COLUMN completed_at TEXT;         -- ISO 8601 timestamp, set on completion
> ALTER TABLE escrow ADD COLUMN dispute_reason TEXT;       -- free text, set when status = 'disputed'
> ```
> The `artistBookingService.ts` cron helper (`transitionConfirmedBookings()`) should use `cooling_off_until` instead of computing from `created_at` for more precise timing.

**Trust badge:** Displayed on artist's provider card as a blue verified tick. Tooltip explains: "Manager verified by Kurukoo team.

---

## 32. PWA Navigation and Quick Replies

**Single-screen chat PWA** with pull-down drawer:
- Main view: Chat interface (primary surface for all interactions)
- Pull-down drawer: Balance, Activity, Settings
- No bottom tabs competing with the chat input

**Personalized Quick Replies** (contextual, based on user profile):
- Rider (mobile): "Accept Rides", "Pulse (Go Live)", "View Earnings", "Top Up Points", "Send Quote"
- Hawker (mobile): "Pulse (Go Live)(Oranges)", "View Orders", "Top Up Points", "Sell Oranges", Sell [Other Items]".
- Plumber (stationary): "View Jobs", "Boost Listing", "Update Schedule", "Withdraw".
- Restaurant (stationary): "View Orders", "Boost Listing", "Update Schedule", "Withdraw", "Pulse", "Offer Promo (Listing)", "Get delivery", "Get Ride".
- Customer (Lagos): "Get Okada", "Order Food", "Find Worker", "Post Gig"
- Construction site bossman (Lagos): "Get Okada", "Order Food", "Find Worker", "Post Gig", "Post Job", "Get Delivery", "Get Ride", "Save Money", "Top Up", "Reorder [Restaurant Name]", "Order [Item] Again".
- student (Lagos): "Get Okada", "Order Food", "Find Worker", "Post Gig", "Post Job", "Get Delivery", "Get Ride", "Save Money", "Top Up", "Reorder [Restaurant Name]", "Order [Item] Again".
- prophet (Lagos): "Get Okada", "Order Food", "Find Worker", "Post Gig", "Post Job", "Get Delivery", "Get Ride", "Save Money", "Top Up", "Reorder [Restaurant Name]", "Order [Item] Again".
- civil servant (Lagos): "Get Okada", "Order Food", "Find Worker", "Post Gig", "Post Job", "Get Delivery", "Get Ride", "Save Money", "Top Up", "Reorder [Restaurant Name]", "Order [Item] Again".
- Customer (Kano): "Get Keke", "Order Food", "Find Worker", "Post Gig"
- Customer with usual bakery: "Reorder [Bakery Name]", "Get a Lift", "Find Worker", "Top Up"
- Customer with repeat orders: "Order [Item] Again", "Get a Lift", "Order Food", "Find Worker"

All quick replies served via GET /api/quick-replies and translated via t().

**Personalised Quick Replies concept**:
The dashboard chat window shows 3–4 contextual buttons that change based on:
- Skills & operation mode – Is the user a rider? Show “Accept Rides”. A hawker? “Go Live”. A plumber? “View Jobs”.
- Roles (inferred) – If the user has only customer role, show “Get a Lift”, “Order Food”, “Find Worker”. If they have provider roles, show earning opportunities.
- Preferences & behaviour – If they always order suya on Fridays, show “Order Suya”. If they have a saved usual bakery, show “Reorder Bread”.
- Location & language – In Lagos, “Get Okada”. In Kano, “Get Keke”. In Pidgin: “Need Lift?”. In Yoruba: “Ẹ gbé mi?”.
- Active listings – If the user listed a car for sale, show “Sell Car”. If they have a phone listing, “Sell Phone”.

Result: Every user sees buttons that reflect their actual life and language. No generic “Find a rider” that means nothing to a driver.


### 32.1 Design Philosophy & System (Frontend – Single‑Screen Chat PWA)
**African Modernism palette:** Cream (#FFF8F0), Terracotta (#D97A5C), Electric Blue (#1E88E5), Charcoal (#2E2E2E).  
**Typography:** Space Grotesk (headings), Inter (body).  
**Material Design 3** spacing/elevation/touch targets as the structural skeleton.  
**Duolingo‑style** icon‑first, low‑literacy interactions.

The PWA is a **single chat interface**. No bottom tabs, no side navigation. Everything — requests, product cards, surveys, delivery maps — appears as inline bubbles within the conversation.

### 32.1.1. Frontend structure.

#### 32.1.2. Public Website (`kurukoo.com`)
Create a new directory `public/` with these pages:
- `index.html` (homepage with all sections: hero, how it works, features, testimonials, blog preview, footer, etc)
- `explore.html` (dynamic feed of anonymised requests from backend)
- `pricing.html` (detailed tier comparison)
- `blog.html` and `blog/[slug].html` (simple article listing and detail)
- `terms.html`, `help.html`, `privacy.html`
- `about.html`, `contact.html`

All pages should:
- Use the African Modernism design system (cream background, terracotta accents, electric blue CTAs).
- Be responsive and mobile‑first.
- Pull dynamic content (opportunities, blog posts) from backend APIs.
- Include login/signup triggers that initiate phone‑number verification via WhatsApp or push.

##### 32.1.2.1. EJS Templating
- Install `ejs` and create a `views/` directory with reusable templates:
  - `views/layout.ejs` (header, footer, navigation)
  - `views/pages/index.ejs` (homepage)
  - `views/pages/[other].ejs` (other pages), etc.
- Create locale files in `locales/en.json`, `locales/ha.json`, `locales/yo.json`, `locales/ig.json`, `locales/pcm.json`, `locales/en-GB.json`.
- The server should look up text strings based on `req.locale`.
- All pricing, currency symbols, and feature flags (e.g., “Driverless Cars Coming Soon” on /gb/ only) are injected from config.

#### 32.1.3. Login & Cross‑Channel Authentication
- Build a unified auth service `src/services/auth.ts` (already exists for CONFIRM flow) and expose endpoints:
  - `POST /api/auth/start` (accepts phone, sends CONFIRM prompt via push or WhatsApp)
  - `POST /api/auth/verify` (accepts phone + session token)
- On the PWA and website, implement the login flow:
  - User enters phone → receives a push/WhatsApp message → taps "CONFIRM" → session token stored in cookie/localStorage.
- The admin console uses a separate email/password/OTP flow (create `/admin/login.html` and `POST /api/admin/auth`).

#### 32.1.4. Admin Console
Create a separate subdirectory `admin/` with:
- `login.html`, `dashboard.html`, `users.html`, `providers.html`, `content.html`, `ads.html`, `compliance.html`, `analytics.html`, `settings.html`.
- All pages authenticate via admin session.
- Basic data tables, forms, and charts (use a lightweight library like Chart.js).
- Connect to backend APIs for real data.

##### 32.1.4.1. Admin Intelligence & Gamification
- **Admin Heatmap**: Leaflet.js-based OSM map in `/admin/analytics.html` visualizing skill demand intensity.
- **Celebrity Demand Aggregation**: Tracked via `celebrity_demand` table; triggers proactive opportunity reports upon reaching interest thresholds.
- **Fuel Delivery**: Dedicated skill tag, demo provider seeding, and automated blog content generation for emergency use cases.
- **Gamification**: Provider leaderboard and automated psychological hooks (FOMO, Point expiry).
- **Contextual Device Discovery**: Automatic detection of smart devices in PWA.
- **Admin Notifications**: Push notifications to admin users for new listings, provider signups, and other critical events.

##### 32.1.4.2. Content Management System
- **Blog**: Markdown-based system with `content/blog/` directory.
- **FAQs**: JSON file with key/value pairs.
- **Help Articles**: JSON file with key/value pairs.
- **Ads**: Ad management (create, schedule, target) is done in the Admin Console.

##### 32.1.4.3. Analytics & Reporting
- **Provider Performance**: Track provider performance metrics (response time, completion rate, etc.).
- **Opportunity Demand**: Track demand for each opportunity type (e.g., ride, delivery, trade offer).
- **User Behavior**: Track user behavior patterns (e.g., time spent on app, number of requests made).
- **Revenue Tracking**: Track revenue generated by each opportunity type and provider.
- **Compliance Monitoring**: Monitor compliance with terms of service and other legal requirements.

### 32.1.5. Admin Pages
- Dashboard (real‑time stats)
- Users (search, view, suspend)
- Skill Flows (view, edit, create)
- Pricing (manage tiers per country)
- Commissions (manage all rates)
- Content (blog, help, legal, pages)
- Ads (create, manage campaigns)
- Analytics (demand heatmap, price trends, export)
- Tickets (support and disputes)
- Scam Reports
- Partnerships (CRM‑lite tracking)
- Social Media (compose, schedule)
- Future Plans (tracking MVNO, smart city, etc.)
- Revenue (monetisation dashboard)

### 32.2 Admin APIs
All admin pages are backed by `/api/admin/*` endpoints with JWT authentication.
- `GET /api/admin/users` (search, view, suspend)
- `GET /api/admin/skills` (view, edit, create)
- `GET /api/admin/pricing` (manage tiers per country)
- `GET /api/admin/commissions` (manage all rates)
- `GET /api/admin/content` (blog, help, legal, pages)
- `GET /api/admin/ads` (create, manage campaigns)
- `GET /api/admin/analytics` (demand heatmap, price trends, export)
- `GET /api/admin/tickets` (support and disputes)

#### 32.1.5. Frontend - Advertising Integration
- In the PWA and public website, create ad slots that fetch from `GET /api/ads?placement=explore_feed` or `placement=website_banner`.
- Ads are served as branded cards, marked "Sponsored".
- Ad management (create, schedule, target) is done in the Admin Console.

#### 32.1.6. Admin Content Management system
- For blog/news, use a simple Markdown-based system:
  - Store posts in `content/blog/` with frontmatter (title, date, category).
  - API endpoint `GET /api/blog` returns list, `GET /api/blog/:slug` returns single post rendered as HTML.
- The admin content page allows creating/editing posts via a text editor (integrate a simple Markdown editor).
- For other content (FAQs, help articles), use a JSON file with key/value pairs.

### 32.3 PWA Components
- Single chat thread; no bottom tabs.
- **Pull‑down drawer:** Balance (Points + Wallet), Activity (last 5 transactions), Settings (profile, skills, Work toggle, language, logout). “Smart Devices” section appears only when at least one device is discovered.
- **Reload modal:** Points top‑up with preset amounts and payment method picker; airtime/data/bills marked “Coming Soon.”
- **Inline cards:** ride picker (Okada/Keke/Taxi/Car), "Go Live/Kuru Pulse (shows as off so its on by default to all users)” toggle, product cards (4 layouts: local, affiliate, trade offer, survey), trade offer card, survey questions.
- **Emergency SOS:** Red button, top‑right, always visible. Queries `emergency_contacts` table and shows local numbers.
- **Voice input:** Web Speech API, always available.
- **Onboarding overlay:** Hidden by default. 6‑step progressive wizard: name → intent (Find/Earn/Both) → skills → operation mode → dimensions → equipment.
- **Unified message history:** Loads last 50 messages from all channels on startup.
- **WebRTC video overlay:** Call, screen share, liveCast button (appears after accepting a mobile/delivery job).
- **“Tasks” panel:** Visible only to Kurukoo Contributors (users with `is_contributor` flag).
- **“Share with Contacts” button:** Referral blast using Web Contact Picker API.
- **Offline Mode:** Banner notification, service worker caching core assets.
- **Rating modal:** Post‑job star rating (1‑5 stars).
- **Data & Privacy:** “Download My Data” and “Delete My Account” buttons in the Settings drawer.
- **Unified Chat Thread** | Cross‑channel conversation history. | Loading history, new message indicator, send via voice or text. |
- **Opportunity Feed** | Scrollable list of personalised cards. | Loading skeleton, populated, empty (with encouragement). |
- **Points** | Balance display + top‑up button. | Showing balance, low balance warning, top‑up in progress. |


### 32.4 The Input Bar

The chat input bar accepts:
- **Text:** "I need a plumber"
- **Voice:** Tap mic, speak request
- **Quick replies:** Ride type picker appears inline

**Blueprint alignment:** Section 5.1: "Input bar: Text and voice, always at the bottom."

### 32.5 PWA & WhatsAPP Key Inline Cards
- **Ride picker:** Okada, Keke, Taxi, Car — shown as a quick‑reply button group in the chat.
- **Kuru Pulse "Go Live":** A toggle that appears as a chat message when the user has mobile skills.
- **Kuru Pulse :** The default off option in the toggle shared with Go Live, that appears in the top drawer.
- **Product card:** Image, price, "Order Now" button, delivered inline.
- **Trade offer card:** Displays arbitrage opportunity with buy/sell prices, profit margin, and Accept/Decline buttons.
- **Survey question:** Image + Yes/No buttons, answered instantly.

### 32.5.1 WhatsApp UI Consistency

WhatsApp cannot be themed, but Kurukoo's identity is maintained through:

- **Rich media templates:** All images, carousels, and videos use the Kurukoo colour palette and typography.
- **Consistent bot voice:** The tone, emoji usage, and greeting style match the PWA's conversational design.
- **Deep‑links to PWA:** For any experience requiring a full interface (live map, dashboard), a single tap opens the PWA, which is fully branded.

### 32.6 Public Website & Explore Hub
- **Country‑prefix routes:** `/ng/`, `/gh/`, `/gb/`. EJS templates with shared partials. Locale files for en, ha, yo, ig, pcm, en‑GB.
- **Header (updated to match live `nav.ejs`):** Logo, Platform dropdown (mega-menu: Conversational Core, Earning & Skills, Safety & Trust, Ecosystem Features), Discover, For You, Pricing, Resources, Explore, Help, Globe. On mobile, Platform and Pricing collapse into a hamburger menu; Help and Globe remain exposed.
- **Homepage:** Hero section with live hybrid chat (two‑phase: auto‑demo then anonymous onboarding), How‑It‑Works (3 steps), 6 feature cards, pricing table, trust signal.
- **Explore Hub (`/explore`):** Card grid with all 45 categories. Every 6th card is a sponsored placement. Trending strip, "Nearby" (Pulse‑active providers) and Daily Picks card.
- **45 Category Pages (`/explore/[slug]`):** Each page embeds the live hybrid chat component inside the top responsive phone mockup hero layout. Mock conversations demonstrate the category’s value and allow users to onboard directly from the embedded chat. Trust metrics are dynamically calculated from real database records (area-scoped verified provider counts, completed jobs, and average star ratings). Ad slots and sub-category navigation present.
- **Help Centre** at `/help`. **Blog** at `/blog` (CMS‑managed, AI‑generated drafts). **API docs** at `/api/docs`.
- **UK homepage (`/gb/`):** Includes diaspora features, UK pricing (£), community board, child safety notice, Stripe mention.
- **No search bar, no public gig board, no category grid on the homepage.**

#### 32.13 Web Widget (B2B Embed)

**Purpose:** Allow businesses to offer Kurukoo services directly on their own websites without leaving their brand. The widget is a lightweight JavaScript embed that renders a Kurukoo chat button and conversation panel.

**Widget tiers (feature-flagged):**
- **Basic (free):** "Chat with Kurukoo" button that deep-links to WhatsApp or opens the PWA. No customization.
- **Standard (Business tier):** Customizable button position, color, and greeting message. Inline chat panel that opens on click, showing the Kurukoo conversation interface in an iframe. Users can complete requests without leaving the partner site.
- **Premium (Business tier + custom deal):** Co-branded experience, custom skill routing (e.g., only show delivery/errand skills for a logistics company), API access for order management.

**Technical implementation:**
- **Embed code:** `<script src="https://kurukoo.com/widget.js" data-business-id="123"></script>`
- **Widget loads:** A floating button in the corner of the partner site. Clicking it opens a chat panel (iframe pointing to `kurukoo.com/widget?business=123`).
- **Authentication:** If the user is already logged into Kurukoo (PWA or WhatsApp), the widget picks up the session via cookie/localStorage. If not, the widget prompts for phone number → CONFIRM flow → creates/links memory profile.
- **Order routing:** Orders placed through the widget are tagged with `source: 'widget'` and `business_id`. The partner business receives a notification (webhook or dashboard) for each new order.
- **Commission:** Standard lead charge applies (50 Points per accepted job). Plus a widget usage fee (₦500–2,000/month per business) for Premium tier.

**Use cases:**
- A restaurant website: "Order delivery via Kurukoo" button → user completes order in widget → restaurant receives order in their Kurukoo provider dashboard.
- A real estate agency: "Book a viewing" button → user schedules via Kurukoo → agency manages appointments via Kurukoo calendar.
- A logistics company: "Get a quote" button → user requests delivery → company receives lead in their Kurukoo dashboard.

**Monetisation:**
- Widget usage fee (₦500–2,000/month per business for Premium tier)
- Standard lead charges (50 Points per accepted job)
- Sponsored placements within the widget (e.g., "You might also need a cleaner" for a real estate widget)

**Admin console:** Businesses can generate their embed code, customize the widget appearance, view order volume, and manage webhooks in the Admin Console under the new "Widgets" section.

**New pages added in v5.55 (see FRONTEND_PAGES.md for full specs):**

- **Discover page (`/:country/discover`):** Live interactive Leaflet.js/OSM map showing nearby providers, AI agents, deals, and emergency services. Toggleable map layers: mobile providers (live via Pulse), stationary providers, AI agents, emergency services (always visible), Kurukoo physical agents, active deals/requests, events/trending. API: `GET /api/discover/map?lat&lng&radius&layers` → GeoJSON, cached via `cacheGet()` 30s TTL. Full-screen map on mobile with bottom-sheet overlays; sidebar + list on desktop. **status: route in nav.ejs, no template yet.**

- **For You page (`/:country/for-you`):** User type chooser with 5 cards: (1) Consumer, (2) Provider, (3) Business, (4) Physical Agent, (5) Contributor. Each card explains what the type gets and can do, with CTA → pre-filled WhatsApp prompt or PWA onboarding with role pre-selected. **status: route in nav.ejs, no template yet.**

- **Resources Hub (`/:country/resources`):** Educational content library (the "library"). Sections: User Guides, Provider Guides, Business Guides, Diaspora & Relocation Guide, API Docs, Legal & Compliance, Blog. Clear split from Help: Resources = learn how things work; Help = fix something that went wrong. API: `GET /api/resources?category&page` (max 20/page). **status: route in nav.ejs, no template yet.**

- **Help Centre (updated split):** `/:country/help` — now transactional support desk only. KEEP: FAQ, Dispute Center, Live Chat, Report a Problem, Contact Support, Status Page. MOVE to Resources: Getting Started, How-To Guides, Privacy & Trust, Earning Money guides. `noindex` for support pages.

- **Partners page (`/:country/partners`):** 8 partner types: Kurukoo Agents, Agent Networks, Service Partners, Technology Partners, Brand/Corporate Partners, Community Partners, Government Partners, Developer Partners. Application form → POST `/api/partner/apply` → `partnerships` table. Admin `partnerships.html` + API + table exist. **status: public page to build.**

- **Advertise page (`/:country/advertise`):** Ad placement inventory (Sponsored Explore cards, Daily Picks, Nearby Pulse pins, Category/City takeovers, Provider spotlights, Blog content). Targeting: location, category, intent, language. Pricing: CPM, CPV, flat-rate. `/api/ads` serving endpoint exists. Admin `ads.html` referenced but file missing. **status: to build.** See §38 Ads Management (to add).

**Architectural clarifications added in v5.55:**

- **Storefront clarification:** The storefront is NOT a public business listing directory. It is a **chat-managed product inventory**: (a) Kurukoo imports products from WhatsApp Business catalogue (catalog scraper PA-17, stores in `skills.business_products`), (b) asks provider questions periodically to keep updated, (c) products surface conversationally — in response to user requests, in Daily Picks, or when boosted/advertised — NOT in a browseable directory. Future: marketplace browsing (explicitly future). Business tier: "Storefront: Kurukoo learns your products from your WhatsApp catalogue and keeps them updated by asking you questions. Your products appear to nearby customers when they search. No dashboard — just chat."

- **Provider dynamic display (no dedicated page):** Providers do NOT get a dedicated public profile page. Provider info surfaces dynamically via: sponsored Explore cards, Daily Picks, Discover map pins, chat-suggested cards, boosted listing cards. Each card: name, skill, rating, badge(s), proximity, CTA. Boosted/advertised cards labelled "Sponsored." Only exception: auto-generated SEO pages (`/:country/p/:provider-slug`) for providers who boosted/advertised/opted-in (§53.1, LocalBusiness schema).

- **PWA as discover/explore area:** The PWA dashboard uses a sidebar + chat layout (ChatGPT-style). The sidebar includes a **Discover panel** surfacing Daily Picks, activity feed, and intent-based suggestions personalized via `memory_profiles.inferred_roles` (e.g., "Demand for delivery driver in your area", "Cheaper rice found — buy?", "{Business} serving pepper soup — book or order?", "{Event} in {area} — attend?"). The Discover panel is a monetization surface: sponsored cards, provider spotlights, CPM/CPV Daily Picks. Mobile: sidebar collapses to drawer. Desktop: fixed 280px panel.

- **Scrollable "What Can You Do?" cards:** Homepage section with ~28 grouped cards (horizontal snap-scroll on mobile, grid on desktop; algorithmically re-ordered per logged-in user via `inferred_roles`/`behavior_patterns`). Grouped into 5 visual bands. See FRONTEND_PAGES.md §K.

  **Everyday Food:** (1) Order Food → `/explore/food` (§55.4 shared flow), (2) Get Groceries → `/explore/groceries` (§55.4 shared flow).
  **Everyday Home / Errands:** (3) Get Errands Done, (4) Logistics & Delivery (send parcels, courier, dispatch rider), (5) Get a Ride / Mobility → Discover mobility layer (mobility is a high-traffic intender, now surfaced as a card, links to Discover map).
  **Home & Repairs:** (6) Auto Repair & Car Parts → `/explore/automotive-mechanics` (§55.1 — repair, body work, upgrades, parts sourcing from Ladipo/Trade Fair, `spare_parts_sourcer`), (7) Home Services (consolidates plumbing/electrical/cleaning), (8) Generator & Appliance Repairs, (9) Solar Installation.
  **Health, Money & Safety:** (10) Access Health & Care, (11) Money Circle (Ajo/Esusu), (12) Emergency Services / SOS, (13) Security & Close Protection → `/explore/security-safety` (§55.2 — bodyguard, bouncer, event security, escort; duration-based booking), (14) Neighborhood Safety Alerts (report incident/crime — separate from reactive SOS).
  **Earning, Building & Community:** (15) Find Work / Gigs, (16) Sell Locally (chat-managed storefront, not a directory), (17) Reach Customers / Advertise (ties to Advertising module §38), (18) Become a Contributor / Cover Events → `/for-you` Contributor (§36.1.3 — get paid airtime/wallet to video/report events, update prices, confirm locations), (19) Join a Sports Match / Club → `/explore/sports-recreation` (§55.3 — find a game, book a pitch, join a league or football club, tournaments), (20) Community / Groups (Kuru Circles, watch parties, local meetups).
  **Info, Alerts & Entertainment:** (21) Get Price Alerts → `/explore/price-check`, (22) Check Key Services (NIN, CAC), (23) Check Results (JAMB/WAEC/NECO), (24) Reload Airtime & Data, (25) Universal Remote (TV/Devices), (26) Know What's Happening / Nearby → Discover + National Events Calendar, (27) Hawkers Near You, (28) Prayers & Spiritual.

  **Explore category targets (all already routed in ECOSYSTEM.md):** auto → cat 32 `automotive-mechanics`; security → cat 5 `emergency-dispatch` + cat 20 `security-safety`; sports → cat 46 `sports-recreation`. Note: cat 20 `security-safety` (legacy) and cat 46 already carry the security/sports skill tags; the new cards link to these existing slugs.

- **Price checker visibility:** `price_check` category currently invisible on public site. Surface via: (1) Homepage scrollable card, (2) Explore category card, (3) PWA inline cards on "How much is rice?" → queries `skills.business_products`, (4) Daily Picks price alerts, (5) For You Consumer card. Future: market price intelligence (aggregated trends).

- **Universal remote placement:** §32.12 feature appears in: (1) Homepage scrollable card, (2) For You Consumer card, (3) PWA Smart Devices panel, (4) Resources guide, (5) Business tier feature, (6) Explore explainer page. Business tier by default; Plus/Base on demand.

- **Responsive design & no inline styles mandate:** ALL pages (public, PWA, admin) MUST: (1) No inline `style="..."` — use CSS classes from shared stylesheets. Current `nav.ejs` has ~30 inline declarations to refactor. (2) Mobile-first (360px → 768px → 1024px+). (3) 44×44px min touch targets. (4) Images: `loading="lazy"`, `width`/`height`, `srcset`, WebP/AVIF, auto-generated `alt` (§53.2.3). (5) No horizontal scroll. (6) CSS variables from §31.1.1. See FRONTEND_PAGES.md §Responsive Design Mandate.

> **Developer note (SEO plumbing — see §53):** The shared `views/_partials/head.ejs` must be refactored to accept per-page EJS variables (`title`, `description`, `canonical`, `ogImage`, `schema`, `robots`, `hreflang`) sourced from the `seo_pages` table (§53.6). **Current state (root cause of SEOptimer Usability F / Links F grades):** `<title>` and `<meta name="description">` are hardcoded literals identical on every page; `<html lang="en">` is hardcoded despite `/gb/` and multilingual locales; and there are no canonical, Open Graph, Twitter Card, JSON-LD/structured-data, or hreflang tags anywhere. There is also no `robots.txt` and no `sitemap.xml` in the project. All of this is remediated by the §53 build (action items PA-18/PA-19).

### 32.7 PWA Caching Strategy

Offline-first with stale-while-revalidate:
- App shell (HTML, CSS, JS): Cache on install via service worker. Serve from cache instantly; update in background.
- API responses: Cache with 30-second TTL. Serve stale while fetching fresh.
- Point balance: Cache with 15-second TTL. Never show stale balance without loading indicator.
- Messaging history: Cache last 50 messages per conversation. Full history available when online.

Service worker lifecycle:
1. Install: Pre-cache app shell and manifest
2. Activate: Clear old caches, claim clients
3. Fetch: Stale-while-revalidate for API, cache-first for static, network-first for transactions
4. Push: Display liveCast signals and job matches as push notifications

### 32.8 Mobile App Roadmap & Store Wrappers

- **Phase 2 -- Store Wrappers (TWA & WKWebView):**
  - **Android TWA (Trusted Web Activity):** Play Store package generated using TWA container. Chrome handles rendering inside a native shell. Uses `/.well-known/assetlinks.json` for domain verification.
  - **iOS WKWebView Store Wrapper:** App Store package using a native Swift WKWebView wrapper with APNs push notification relay. Uses `/.well-known/apple-app-site-association` for Apple Universal Links.
- **Phase 3 -- Cross-Platform Native App (Flutter / React Native):**
  - Full native build for iOS & Android with native UI components and background services.
  - **Deep linking:** Custom `kurukoo://` URI scheme and universal links (`https://kurukoo.com/chat`) for seamless external navigation.
  - **Native Push & Background Services:** Direct FCM & APNs native push triggers for real-time liveCast signals, nearby Pulse nudges, and urgent job alerts.
  - **Biometrics & Hardware Sync:** Fingerprint / FaceID authentication for wallet transactions, native contact list sync for referral blasts, and background GPS location updates for active delivery runners.
  - **Offline Storage:** On-device SQLite database sync for offline message queuing and encryption.
  - **Unified Backend:** All mobile app variants connect directly to the central Kurukoo API (`/api/*`), maintaining 100% conversation and profile continuity in the shared `memory_profiles` and `messages` tables.

### 32.9 PWA Interface</new_text>

Memory‑driven interface — the dashboard is not a fixed menu. It changes based on what the memory profile knows about the user. A hawker sees “Go Live” and “Today’s sales.” A driver sees “Accept Lift” and “Earnings.” A professional sees “Open Jobs” and “Proposals.” Everyone sees their Point balance and rewards.

### 32.10 PWA Features

- **Onboarding overlay:** Hidden by default. 6‑step progressive wizard: name → intent (Find/Earn/Both) → skills → operation mode → dimensions → equipment.
- **Unified message history:** Loads last 50 messages from all channels on startup.
- **WebRTC video overlay:** Call, screen share, liveCast button (appears after accepting a mobile/delivery job).
- **“Tasks” panel:** Visible only to Kurukoo Contributors (users with `is_contributor` flag).
- **Unified message history:** Loads last 50 messages from all channels on startup.
- **WebRTC video overlay:** Call, screen share, liveCast button (appears after accepting a mobile/delivery job).
- **“Tasks” panel:** Visible only to Kurukoo Contributors (users with `is_contributor` flag).
- **“Share with Contacts” button:** Referral blast using Web Contact Picker API.
- **Offline Mode:** Banner notification, service worker caching core assets.
- **Rating modal:** Post‑job star rating (1‑5 stars).

### 32.11 WebRTC Video Overlay

WebRTC is used strictly for high-value, short-lived sessions:

- 1:1 privacy-bridged voice/video calls
- Live location sharing during an active delivery or errand
- Short confirmation data channel after a Pulse nudge is accepted
- Remote help / screen share for elderly or less tech-savvy users
- Low-bandwidth data-channel signalling for Universal Remote / IoT commands
- Contactless Points transfer confirmation (closed-loop only)

WebRTC is never used for continuous always-on presence of the entire user base. Continuous presence is handled by the Presence Trick-Bridge + FCM.

- **LiveCast button:** Appears in the chat input bar when a job is accepted.
- **Video call:** One‑to‑one video call with the customer or runner.

**WebRTC Technical Implementation:**

> **Developer note:** The current `webrtcSignalling.ts` is a 12-line stub (in-memory room map). The full implementation requires the following:

**Signalling:** WebSocket endpoint at `/ws/webrtc/:roomId`. The server relays SDP offers, SDP answers, and ICE candidates between the two peers. No media flows through the server — it is signalling-only.

**Connection lifecycle:**
1. **Room creation:** When a job is accepted or a user initiates a call, the server creates a room with a unique `roomId` (UUID) and adds the initiating peer.
2. **Peer join:** The second peer connects to `/ws/webrtc/:roomId`. The server notifies both peers.
3. **SDP exchange:** Peer A creates an SDP offer → sends to server → server relays to Peer B → Peer B creates SDP answer → sends to server → server relays to Peer A.
4. **ICE candidates:** Both peers gather ICE candidates and relay them through the server. The server does not process them — just forwards.
5. **Connection established:** Direct peer-to-peer media/data flow begins.
6. **Connection cleanup:** On job completion, call end, or disconnect, the server destroys the room and notifies the other peer. Rooms are also auto-cleaned after 30 minutes of inactivity.

**STUN/TURN servers:**
- **Development:** Google STUN server (`stun:stun.l.google.com:19302`) — free, sufficient for same-network testing.
- **Production:** Self-hosted coturn server with TURN relay for NAT traversal. TURN is only used when direct P2P fails (~10-15% of connections). TURN bandwidth is the primary WebRTC cost.

**Data channel message format (for IoT commands — §32.12):**
```json
{
  "type": "device_command",
  "device_id": "living_room_ac",
  "command": "set_temperature",
  "value": 22,
  "request_id": "uuid"
}
```

**Security:** All WebSocket connections require authentication (JWT or session token in the connection URL). Room IDs are unguessable UUIDs. Only the two peers assigned to a room can join.

### 32.12 Universal Remote & IoT Control

"Control your devices from the same chat" — a first-class feature that can appear on the public website and PWA.

Discovery and control are strictly on-demand. There is no background polling unless the user explicitly enables a device.

- **Discovery:** When a user types "control my TV" or "turn on the AC", Kurukoo discovers nearby discoverable smart devices (Wi-Fi smart TVs, ACs, streaming sticks, IR-only devices via an IP-to-IR bridge such as Broadlink RM Mini). Discovery is triggered by the request, never run continuously in the background.
- **Control:** Commands flow over a low-bandwidth WebRTC data channel or an MQTT/HTTP bridge. The user confirms each action inside the chat ("Turned on the living room AC ✓").
- **Enablement:** A device must be explicitly enabled by the user before any polling or state-sync is allowed. Disabled devices are invisible to the platform.
- **Access:** Available to Business tier by default; Plus/Base on demand. Commands are logged to the memory profile as behaviour signals (device_usage) so Kurukoo can later suggest automations.

All device commands appear inside the unified conversation thread and update the single memory profile.

**IoT Bridge Technical Implementation:**

> **Developer note:** The current `iotBridge.ts` is a 19-line stub. The `mqtt` package is already in `package.json` dependencies. The full implementation requires the following:

**MQTT broker:** Use Mosquitto (self-hosted) or HiveMQ Cloud (free tier) as the MQTT broker. Each user gets a topic namespace: `kurukoo/{phone_hash}/devices/{device_id}`. The backend subscribes to command topics and publishes state topics.

**Device discovery protocol:**
1. User types "control my TV" or "turn on the AC" in chat.
2. Backend publishes a discovery message to `kurukoo/{phone_hash}/discover` via MQTT.
3. Enabled devices on the user's local network respond with a discovery payload:
   ```json
   {
     "device_id": "living_room_tv",
     "device_type": "smart_tv",
     "name": "Living Room TV",
     "capabilities": ["power", "volume", "channel", "input_source"],
     "protocol": "wifi | ir_bridge",
     "manufacturer": "Samsung"
   }
   ```
4. Backend presents discovered devices as inline chat cards. User selects one to control.

**Command flow:**
1. User sends a command (e.g., "turn on the living room AC").
2. Backend publishes command to `kurukoo/{phone_hash}/devices/living_room_ac/command`:
   ```json
   {"command": "power_on", "request_id": "uuid", "timestamp": "2026-08-01T10:00:00Z"}
   ```
3. Device (or IR bridge) executes and publishes acknowledgment to `kurukoo/{phone_hash}/devices/living_room_ac/state`:
   ```json
   {"state": "on", "request_id": "uuid", "timestamp": "2026-08-01T10:00:01Z"}
   ```
4. Backend confirms to user in chat: "Turned on the living room AC ✓"
5. Command logged to `user_behavior_signals` as `signal_type = 'device_usage'`.

**Security:** MQTT connections use TLS + username/password auth. Device topics are scoped per user (phone_hash). No device can receive commands for another user's namespace. IR bridge devices (Broadlink RM Mini) connect via a local bridge agent that authenticates with the user's MQTT credentials.

**State sync:** When a device is enabled, the backend subscribes to its state topic. State changes (e.g., user turned on AC with physical remote) are published and logged to `user_behavior_signals` for automation suggestions. Disabled devices have no active subscription — zero polling cost.

---

## 33. Progressive Onboarding (30-Day Conversational Learning)

Instead of a one‑time form, Kurukoo learns about the user over 30 days of small, natural conversations. Each interaction:
- Feels personal and helpful, not like a survey.
“Hey Ama, I was looking into opportunities near you and realised I don’t know if you enjoy live shows or prefer watching from home?”
- Earns the user their daily 1 Point — giving a clear, honest reason for the reward.
- Resets the 24‑hour WhatsApp window at no cost, keeping the conversation alive.
- Subtly markets the platform by exposing the user to features they might not know about.
  Asking about comedy → hints at Events. Asking about selling from a cart → hints at Kuru Pulse.
- Builds a habit of chatting with Kurukoo, making it the go‑to for everything else.

After a month, the system has a rich, confirmed profile without ever showing the user a long form.

No big registration. The system learns who you are as you use it:

- First contact: "Welcome to Kurukoo! What is your name?" stored in memory.
- After first order: "What did you buy?" starts learning preferences.
- After 3 food orders: customer role inferred; preference tracking begins.
- Pattern detection: "You order bread every Sunday. Want to earn? Nearby people need a baker."
- One personalized question per day via WhatsApp/PWA/USSD across 20+ templates covering work, skills, lifestyle, food, finance, location, payments, behavior, creators, safety, community.
- Smart sequencing: Priority-ranked unanswered questions. Respects existing roles. Avoids repeats.
- Creator reach: When user confirms interest in entertainment, Kurukoo serves Daily Picks featuring local comedian/musician clips or upcoming shows.

### 33.1 The Progressive Onboarding Concept: How It Works Technically

**A Question Bank, Not Random Chatter**
The system maintains a library of question templates, grouped by life area:

**Area | Sample Question**
Work & Mobility	| “Do you usually work from one spot, or move around during the day?”
Entertainment	| “Do you enjoy live shows (comedy, music) or prefer watching on your phone/TV?”
Food Preferences	| “Any food you really love or can’t eat? Helps me find the best spots for you.”
Financial Goals	| “Are you saving towards something big? I can help find the right agents.”
Skills Discovery	| “You mentioned you cook a lot. Would you be open to selling meals through us?”
Social Life	| “Do you hang out with friends at bars or lounges, or keep it low‑key?”

**Smart Sequencing**
The system picks the next question based on:
- Priority of missing fields (work mode, skills, location first).
- User’s existing roles — don’t ask a driver about shopping preferences; ask about preferred routes.
- Behaviour patterns — if they’ve already ordered suya five times, skip “Do you like street food?”

No repeats — a sent‑question log prevents asking the same thing twice.

**The Daily Engagement Flow**
- A background cron job checks for users who haven’t interacted in 18–22 hours.
- It picks the next best question from the bank and sends a push notification.
- The notification deep‑links to WhatsApp. The user’s reply opens the free service window.
- The webhook receives the reply. The AI router extracts the intent and updates the memory profile.
- Kurukoo replies with a warm acknowledgment and credits the 1 Point.

The field is marked as collected and the process repeats the next day.

**Creator Reach Extension (The Opportunity Engine in Action)**
Once Kurukoo knows a user likes live comedy, it can:
- Show a personalised Moment with a clip from a local comedian.
- List the comedian’s upcoming show in the Notifications tab.
- Offer the comedian a Business tier to promote their content.
- Push the comedian’s content to all users who share that interest.

This makes Kurukoo a discovery platform for emerging Nigerian talent — comedians, musicians, content creators, spoken‑word artists — all organically reaching new audiences through the platform’s daily engagement loop.

**Key Features & Differentiation**

#### 33.1.1 Work Toggle — Unified Earning
A single toggle: **"Available for work"** (ON/OFF). When ON, the system looks for:
- **Lead‑based gigs:** Connecting the user directly to customers who need their skills.
- **Transaction orchestration deals:** Kurukoo coordinates the full transaction — finding a trusted seller, arranging delivery, holding payment in escrow — and dispatches the user as a delivery person for a guaranteed fee. The platform does not hold inventory.

The user sees a simple notification: *"New work: Deliver a bag of rice. Earn ₦1,500. Accept?"* The complexity is managed internally.

#### 33.1.2 Transaction Orchestration Engine (Kurukoo Guarantee)
Kurukoo acts as a transaction coordinator when it detects a trusted seller with a product at a competitive price and a buyer willing to pay. The platform never holds inventory. Instead:

1. **Buyer commits first:** The buyer confirms the deal at an agreed price. Payment is collected upfront and held in escrow via OPay or Moniepoint.
2. **Platform takes coordination cut:** Kurukoo deducts its coordination fee (margin) from the total. The seller's portion remains in escrow.
3. **Delivery is arranged:** Kurukoo dispatches a trusted delivery person (from the provider pool) to collect the item from the seller. The delivery person's fee is paid post-delivery from the buyer's payment.
4. **Delivery confirmed → settlement:** Once the buyer confirms receipt (via push notification feedback), escrow releases payment to the seller and the delivery fee to the courier. Kurukoo's cut is already accounted for.
5. **Delivery fails → protection:** If the buyer does not receive the item, the delivery person is not paid, the seller receives their funds back, and the buyer is refunded in full.

This turns idle users into a trusted delivery fleet and generates coordination revenue without inventory risk, working capital, or markup on goods. Trust scores and ratings of both sellers and delivery persons are factored into every orchestration decision.

**User-facing name:** **Kurukoo Guarantee** — "We coordinate, you confirm, we deliver." The backend is the Transaction Orchestration Engine; the user sees a simple guarantee.

#### 33.1.3 Transaction Orchestration Engine — Intended Behaviour (Going Forward)

> **Developer note — `tradeEngine.ts` rewrite required:** The current `src/services/tradeEngine.ts` implements the **old arbitrage model** (buying inventory at a low price, selling at a high price, dispatching a runner, pocketing the margin). This is the model the blueprint explicitly says is **incorrect**. The file uses `ArbitrageDeal` interfaces, `calculateArbitrage()` functions, and `detectArbitrage()` with hardcoded mock deals. **This file must be completely rewritten** to implement the 5-step escrow flow described in §33.1.2 above:
>
> 1. Remove `ArbitrageDeal`, `calculateArbitrage()`, `detectArbitrage()` — no arbitrage logic.
> 2. Implement `createOrchestratedDeal(buyerPhone, sellerPhone, item, price)` → calls `createEscrow()` from `escrow.ts`.
> 3. Implement `dispatchDeliveryProvider(escrowId)` → finds eligible delivery provider using config-driven skill eligibility (not hard-coded `'delivery'` string).
> 4. Implement `confirmDelivery(escrowId)` → calls `releaseEscrow()` from `escrow.ts`, deducts coordination fee, pays delivery provider.
> 5. Implement `handleFailedDelivery(escrowId)` → calls `refundEscrow()`, logs failure, triggers Trust Score penalty.
> 6. Replace `addCredits()` calls with `addPoints()` (the canonical name since v5.41).
> 7. Add audit logging to `trade_offers` table for every orchestration decision (§33.1.3.5).
>
> The `escrow.ts` service already has `createEscrow()`, `releaseEscrow()`, and `refundEscrow()` — use these. The `trade_offers` table already exists in `database.ts`.

The Transaction Orchestration Engine (`tradeEngine.ts`) is responsible for **platform-orchestrated fulfilment** — cases where Kurukoo coordinates a full transaction on behalf of the buyer and seller (for example finding a trusted seller, arranging a delivery person, holding payment in escrow, and settling after delivery confirmation). The platform **never** holds inventory, takes title to goods, or uses its own capital to purchase stock.

##### 33.1.3.1 No Hard-Coded Skill Strings for Core Logic

The engine **must not** hard-code any single skill (e.g., `s.skill = 'delivery'`) in its core selection logic. Eligible skills are read dynamically from configuration (`skill_flows` metadata or a dedicated config table) at runtime.

##### 33.1.3.2 Configuration-Driven Eligibility

Any skill that is allowed to participate in transaction orchestration / automated runner dispatch **must be explicitly marked as eligible** via a flag or metadata field on the `skill_flows` record. Examples of skills that may be marked eligible: `delivery`, `dispatch_rider`, certain `mobile_errand` types, `fuel_delivery`, etc. Skills that are **not** marked eligible **must never** be selected by the Transaction Orchestration Engine, regardless of demand signals or available capacity.

##### 33.1.3.3 Respect Existing Provider Constraints

When selecting a provider for an orchestrated job, the Transaction Orchestration Engine **must** honour every constraint already enforced by the standard matching engine:
- `skills.is_available = 1`
- Active provider subscription status (Base, Plus, or Business — not expired or suspended)
- Remaining lead / Points quota for the provider
- Operation mode (`mobile`, `delivery`, `hybrid` where relevant)
- Geographic proximity rules already used by Nearby Pulse and `find_worker`

##### 33.1.3.4 Separation of Concerns

The Transaction Orchestration Engine is **not** the primary matching engine for normal user-to-provider jobs. Normal user requests continue to be handled by the **standard order finalizer + skills matching path** (`find_worker`). The Transaction Orchestration Engine is **exclusively** for:
- Platform-orchestrated fulfilment (coordinating a trusted seller, delivery person, and buyer)
- Escrow-based transaction coordination where the buyer pays first
- Designated-agent dispatch on behalf of the platform
- Guaranteed delivery and settlement flows

The engine **never** buys, holds, or resells inventory.

##### 33.1.3.5 Auditability

Every Transaction Orchestration Engine decision **must** be logged with enough detail for admin review:
- Which skill was chosen and why (query criteria, scoring)
- Which provider was selected and their eligibility rationale
- Detected price gap (buy price, sell price, margin)
- Escrow transaction ID and payment flow status
- Timestamp, session context, and outcome (presented / accepted / declined / timed-out / delivered / refunded)

These logs feed into a dedicated admin console view (`/api/admin/trade-engine/logs`) and are retained per the data retention policy (§46).
> **GenUI Alignment Note (Watch):** GenUI's roadmap includes multi-participant conversation support with identified speakers and group cognitive-state tracking. Kurukoo should monitor this if/when group features activate — community boards (§28), money circle discussions (§9), or multi-party delivery coordination (§21.3.1.1) would benefit from a per-participant insight model. No immediate action required while Kurukoo remains 1:1 (user↔platform).
>
> **Kokoro-Engine Alignment Note (Watch — Workflow Observability & Replay):** Kokoro-Engine provides structured execution logs per workflow instance, enabling time-travel replay of any failed or disputed process. Kurukoo's admin console (§38) currently has analytics but lacks per-order workflow replay. If Kokoro-Engine's observability pattern becomes a standard, it would give admins a step-by-step forensic view of any failed dispatch, onboarding flow, or payment cycle — showing exactly which node failed, what state was rolled back, and why. Monitor this for adoption when Admin Console §38 is enhanced with per-order debugging. Also watch for community-published workflow templates (onboarding, dispute resolution, dispatch) that Kurukoo could import for Africa-market patterns rather than building from scratch.


##### 33.1.3.6 Cost and Safety Controls

The engine **must** enforce the following global and per-skill limits:
- **Global coordination exposure cap:** Maximum total outstanding escrow value across all concurrent orchestrated jobs.
- **Per-skill concurrent job cap:** Maximum number of simultaneous open orchestration jobs per eligible skill.
- **Automatic pause rule:** If cumulative failed deliveries or refund rate for a skill exceed a configurable threshold within a rolling window, the engine must pause further orchestration for that skill and escalate to the admin console.
- **Grace-period / recovery rule:** A paused skill may be re-enabled only by explicit admin action after review.

All limits are read from the `trade_config` or `commission_config` table, not hard-coded.

#### 33.1.4 Visibility: Boost Listing vs. Kuru Pulse

> **GenUI Alignment Note (Watch):** GenUI's roadmap includes multi-participant conversation support with identified speakers and group cognitive-state tracking. Kurukoo should monitor this if/when group features activate — community boards (§28), money circle discussions (§9), or multi-party delivery coordination (§21.3.1.1) would benefit from a per-participant insight model. No immediate action required while Kurukoo remains 1:1 (user↔platform).
These are **different mechanisms** that share a Point-based economy.

- **Boost Listing** (10 Points/24 h): For **stationary** providers. Their profile appears at the top of search results when a user looks for that skill. No real‑time location component.
- **Kuru Pulse** (1 Point/day): For all **mobile** users. A default‑setting, geo‑fenced broadcast that sends a device vibration to nearby users. Users receive push notifications or Daily picks when a relevant hawker is nearby.
- **Kuru Pulse "Go Live"** (5 Points/30 min): For **mobile** providers. A real‑time location‑broadcast feature, geo‑fenced broadcast that sends out a location pulse and enables user accepts jobs, and nudge users nearby as they are mobile. Users receive push notifications or their phone vibrates when a relevant hawker is nearby.

#### 33.1.5 Mobility

> **GenUI Alignment Note (Watch):** GenUI plans timeline/analytics views with sentiment and decision-tracking from conversation context. If Admin Console §38 is enhanced with conversation analytics, GenUI's approach — reconstructing session timelines, extracting action items, and tracking decision progress — provides a reference architecture. Kurukoo's `messages` table already contains the underlying data.

- **Nigeria:** Request an okada, keke, or taxi. Drivers pay a lead charge; riders keep 100% of fare. The internal location‑broadcast mechanism is called `liveCast`.
- **UK:** Used for location status checks (opening hours, busyness) and delivery tracking only. No ride‑hailing.

**Multi‑Vehicle Picker**
- In the PWA, when a user taps "Get Ride", show a quick vehicle type picker: Okada, Keke, Taxi, Car (Ride Share).
- The system matches only drivers of that vehicle type.
- Update the public website to describe Get Ride as: "Get an okada, keke, or taxi. Tap Ride and pick your ride, pick your ride, and a trusted driver comes to you – privately."

#### 33.1.6 Sponsored Daily Picks (formerly Moments)
A daily rich-media message delivered inline in the chat, containing sponsored products, job opportunities, and market intel. Engagement resets the WhatsApp window and earns a daily Point.

> **GenUI Alignment Note (Watch):** GenUI's planned action-item extraction — auto-detecting commitments, reminders, and follow-up nudges from conversation context — could enhance Kurukoo's opportunity engine (§33) and proactive engagement scheduler. The `messages` and `memory_profiles` tables already contain the conversation history needed for this; explicit tracking would make the system more proactive about inferred commitments from chat.
**Card data architecture:**
Each Daily Pick is a JSON record in `daily_picks` table:
```json
{
  "id": "uuid",
  "type": "sponsored|spotlight|market_intel|reorder",
  "title": "Bag of Rice - N3,500",
  "image": "url",
  "cta_text": "Order Now",
  "cta_action": "open_chat|open_explore|open_listing",
  "cta_payload": {"skill": "grocery_seller", "phone": "..."},
  "target_segment": {"lga": ["Ikeja", "Surulere"], "skills": ["grocery"]},
  "sponsor_id": null,
  "cpm_bid": 0,
  "score": 0.0,
  "expires_at": "2025-07-12T06:00:00Z"
}
```

**Placement algorithm (3 slots per day, zero ongoing compute cost):**
1. Slot 1: Highest-scoring market intelligence nudge (skills + behaviour patterns)
2. Slot 2: Sponsored placement if budget exists, else second-highest market intel
3. Slot 3: Trending skill in the user's LGA (single nightly SQL query)

Score = (user_need_match * 0.4) + (sponsor_bid * 0.3) + (recency * 0.2) + (engagement_prediction * 0.1)

**User controls:** Skip (reduces category for 7 days), react with emoji (+0.2 relevance), save for later (`memory_profiles.saved_items`).

**Monetisation:**
- Sponsored product card: N5 CPM or N10,000/week per LGA
- Provider spotlight: Included in Business plan or N2,000/week
- City-wide brand takeover: N50,000/day

All promotional Daily Picks are classified as Marketing (N70.65/message) and kept on a separate, controlled budget line. Revenue flows into the Growth & Community Fund.
### 33.1.12 Minority Language & Cultural Inclusion
- **Ijaw audio approach:** Audio prompts recorded in Izon, Nembe, and Kalabari combined with Pidgin text.
- **LGA‑to‑dialect mapping:** Selects the correct greeting automatically.
- **Extensible** to other minority languages without adding text‑UI complexity.

### 33.1.13 Ijaw cultural audio (without adding Ijaw as a full written UI language).

#### 33.1.13.1. Audio Asset Placeholders
Create a directory `/public/audio/ijaw/` and add placeholder audio files (silence or tone) for the following phrases, in three dialect sub‑directories:
- izon/
- nembe/
- kalabari/

Phrases needed:
- welcome.mp3 (greeting on IVR/WhatsApp voice call)
- confirm.mp3 ("Do you want to proceed?")
- success.mp3 ("Done! What else can I help with?")
- error.mp3 ("Sorry, I didn't catch that. Try again or use text.")
- goodbye.mp3 ("Thank you. We'll speak again soon.")

#### 33.1.13.2. Language Detection via Location
When a user registers from a known Ijaw‑speaking LGA (Yenagoa, Southern Ijaw, Brass, Warri South, etc.), set their `preferences.communication_language` to `pcm` (Pidgin text) and `preferences.audio_dialect` to the appropriate Ijaw dialect (mapped from LGA). This can be a lookup table in a new config file `dialectMapping.ts`.

#### 33.1.13.3. IVR & Voice Flow Integration
In the IVR handler (`src/index.ts` or voice service), check the user's `audio_dialect`:
- If set, play the corresponding dialect audio file for welcome, confirm, etc.
- Fall back to Pidgin/English TTS for any prompts not recorded.

#### 33.1.13.4. Skill Tags for Niger Delta Economy
Add the following skill tags to the skills seed data:
- `boat_operator`, `outboard_engine_repair`, `fish_net_maker`, `cold_room_operator`, `creek_guide`, `marine_transport`, `oil_spill_cleaner`, `mangrove_restorer`, `canoe_carver`

These tags are added under the existing modules: agriculture, logistics, worker.

#### 33.1.13.5. Agent Recruitment for Niger Delta
In the strategic roadmap, note: "Recruit Kurukoo Agents in Yenagoa, Warri, and Port Harcourt to onboard Ijaw‑speaking users via in‑person assistance and voice‑first registration."

---

## 38. Admin Console

The admin console is the single operational control plane for the entire platform. It manages both human and AI participants and all economic, presence and content systems.

**Dashboard:** Real-time MAU, GTV, active providers, subscription revenue, Point transactions.

**Provider Management:** Approve/reject/view provider profiles, ratings, suspend skills, review disputes.

**Physical Agent / Sales Consultant Management:** Full lifecycle management of physical agents and partner-brand sales consultants — onboarding, commission configuration, territory/LGA assignment, performance tracking, walk-in assistance logs.

**AI Agent Management:** Full backend management of every AI agent — create / edit / pause / resume / delete; tweak system prompt, tools, temperature, rate limits and skill assignments; assign or re-assign agents to specific LGAs, skill categories or user segments; view live token usage, success rate, escalation rate and cost per agent; clone an existing agent as a template; set automatic pause rules (cost threshold, error rate, etc.).
>
> **Living Memory Engine Alignment Note (Adopt Now — Prospective Memory / Open Intentions):** Kurukoo's Opportunity Engine already creates proactive nudges, but these are not formalised as persistent **open intentions** that survive across sessions. The Living Memory Engine demonstrates that explicit, time-bounded "open intentions" (e.g., "user wanted a plumber 3 days ago but didn't book") dramatically improve proactive engagement reliability. Kurukoo should add an `open_intentions` array to `memory_profiles` with TTLs and resolution states, allowing the AI to follow up on incomplete requests, abandoned carts, and half-expressed needs across days and channels. This makes the Opportunity Engine (§33) dramatically more effective without increasing message volume.

**Live Map:** Leaflet.js/OSM map with filters by skill, live status, LGA, and agent type (human provider, physical agent, AI agent). Visualises the shared presence layer in real time.

**Token Economy Dashboard:** Points minted, spent, lead charges collected, Go Live costs, boosts, rewards, and Growth & Community Fund balance.

**Dispute & Compliance Tools:** Review flagged requests, approve/reject, view compliance_events logs, dispute resolution workflows.

**Content / CMS:** Blog, help, legal and public pages; sponsored Daily Picks scheduling.

**Ads Management (NEW — v5.55):** Dedicated ad campaign management module, separate from Content/CMS. Campaign creation wizard (placement → targeting → creative → budget → schedule), ad creative management (upload images, write copy, AI-assisted via Groq through `lib/router.ts`), targeting engine (location/LGA/city, category, language, user segment, intent), scheduling & flight management (start/end dates, frequency capping), performance reporting (impressions, clicks, CTR, conversions, spend), billing & invoicing (integrate with revenue dashboard), approval workflow (ads must be approved before going live — compliance with §17 blocklist), A/B testing support. API: `GET/POST/PUT/DELETE /api/admin/ads` (CRUD) + `GET /api/admin/ads/:id/performance`. Admin page: `/admin/ads.html` (referenced in earlier specs but file missing — to create). Ad serving endpoint `/api/ads` already exists. Ad placements: Sponsored Explore cards (every 6th card), Sponsored Daily Picks (§33.1.6), Nearby Pulse sponsorships (branded map pins on Discover page), Category/City takeovers, Provider spotlights, Blog sponsored content, PWA Discover panel sponsored cards. Pricing models: CPM, CPV, flat-rate takeovers. See FRONTEND_PAGES.md §E2 and §H14.

**SEO Management:** Full SEO control plane — per-page metadata, schema.org/JSON-LD manager, sitemap & robots.txt editor, programmatic page generation, redirect/404 manager, keyword research & rank tracking, Google Search Console + Bing Webmaster integration, Core Web Vitals + SEO Health Score dashboard, AI-assisted (GEO) content generation. Fully specified in §53.

**Performance & Cost Monitoring:** Server status, API latency, WhatsApp health, database size, cache hit rate, AI cost per agent, FastText/Groq usage breakdown.
>
> **Living Memory Engine Alignment Note (Adopt Now — Working Context Inspector):** The Living Memory Engine provides a "Working Context" view showing exactly what was sent to the LLM vs. what was available but not selected for a given request. Kurukoo's admin console (§38) currently shows analytics but lacks per-request context selection visibility. Adding a "Working Context" inspector would: (a) enable debugging of bad AI responses by showing which memories were retrieved and why, (b) build trust with providers and users by making AI decision-making transparent, and (c) satisfy §41 auditability requirements. This should be implemented as a debug panel in the admin console showing the MMR-selected context, the full available memory pool, and the relevance scores for each retrieved memory.

**Caching Controls:** Redis TTL configuration, presence TTL configuration, cache invalidation triggers, hot-path key inspection.

**User Management:** Search by phone, view memory profile, transaction history, subscription.

**Fund Reconciliation:** Growth and Community Fund balance, allocation history, disbursement logs.

**System Health:** Server status, API latency, WhatsApp health, database size, cache hit rate.

**Access:** /admin/login with JWT-based auth. Roles: admin, moderator, finance, viewer.

---

## 31. Brand Architecture

Kurukoo uses a master brand + consumer feature architecture. The master platform is always **Kurukoo**. Consumer-facing features use simple, descriptive names (the platform, website, PWA).

**Vertical layer (active now — informal economy Africa):**
**Live features:** Kuru Pulse, Reload, Work, Circle, Ride, Discover, Food, Health, Events, Classifieds, Community Board, Errands and Delivery.

**Horizontal layer (future via feature flags — smart city / MVNO / utilities):**
**Future features:** Pay, Kuru Mobile, Hub, Wallet.
**Consumer products:** Kuru Pay, Kuru Pulse, Kuru Ride, Kuru Circle
**Business units:** Kuru Media, Kuru Agents
**Future ventures:** Kuru Mobile (MVNO), Kuru Wallet, Kuru Pay, Full smart‑city integration, Kurukoo‑branded physical service centres (Kuru Hub)

**Kuru Pay brand evolution:**
- **Tiers 1–2 (Now–Launch):** Kurukoo operates bill payments via partners (Africa's Talking for airtime/data; Paga/Moniepoint for bills). No Kuru Pay branding yet — these are Kurukoo services.
- **Tier 3 (Later — Super Agent licence obtained):** Kuru Pay becomes the **licensed consumer-facing brand** for all payment services. It is a separate legal entity from Kurukoo Technologies Ltd (CBN regulatory requirement). Kuru Pay handles: airtime, data, bill payments, cash-in/out, agent network management, and own settlement. The brand represents trust in payments for the informal economy — "Kuru Pay: Send money. Pay bills. Get cash. All in one place."

**Branding rule:** Consumer features use simple descriptive names. The master platform is always Kurukoo.
**Historical note:** Previously named Xentrix (retired). Adopted Kurukoo with Kuru sub-brand prefix.
*Note: “Kuru” is a shortened prefix derived from Kurukoo. It is not the master brand.*

**Vertical vs Horizontal rule:** The vertical layer (informal economy Africa) is the current public face. The horizontal layer (MVNO, smart city, utilities) is future architecture — it stays internal until those layers are live. Feature flags control which layer is visible to which user.

### 31.1 Brand Voice (Pidgin‑first engagement)
Every interaction starts with “Ku Kurukoo!” followed by a warm, Pidgin or English prompt. The tone is warm, energetic, familiar, and trustworthy.

### 31.1.1 Design System: African Modernism

A unified visual language across the PWA, WhatsApp templates, USSD menus, and future native apps.

**Colour Palette:**
- **Primary Background:** Warm cream (#FFF8F0) — reduces eye strain in bright sunlight.
- **Primary Surface:** Terracotta (#D97A5C) — for cards, buttons, active states. Feels earthy and energetic.
- **Accent:** Electric Blue (#1E88E5) — for links, confirmation buttons, and the Live Cast animation. Feels futuristic and trustworthy.
- **Text:** Charcoal (#2E2E2E) — high contrast, very legible.
- **Success / Confirmation:** Deep green (#2E7D32).
- **Alert / Emergency:** Deep red (#C62828).

**Typography:**
- **Headings:** Space Grotesk (bold, geometric, modern).
- **Body:** Inter (high readability at small sizes on mobile screens).
- **USSD / WhatsApp fallback:** System fonts, but with consistent emoji and text styling.

**Iconography:**
- Custom Kurukoo icon set using simple, universally recognisable symbols.
- The "livecast" icon is a pulsing ring. The "Nearby" icon is a radar wave. The "Gig" icon is an open hand.

**Animations & Micro‑interactions:**
- **Kuru Pulse:** When a user taps "Get Ride," a glowing pulse animation radiates from their location pin, fading as it reaches nearby drivers.
- **Kuru Kuru Pulse:** Toggle shared with LiveCast - When a user taps "Go live," a glowing pulse animation radiates from their location pin, fading as it reaches nearby users and users phone ring/nudge/vibrate as hawker gets closer.
- **Go Live confirmation:** A subtle vibration (where supported) and a green halo that appears around the provider's avatar.
- **Job accepted:** A satisfying "stamp" animation that overlays the job card.
- **Rating:** A star‑tap animation with haptic feedback.

### 31.1.2 Platform Features & Capabilities

- Unified Memory Profile (skills‑based identity)
- Channel‑Agnostic Access (WhatsApp, USSD *7000#, PWA)
- Push‑First Notification Architecture
- Number Masking / Privacy Bridge
- Kuru Points (1 Point = ₦1, top‑up, daily reward)
- Lead Charge system (per‑provider‑type fees)
- Rewards system
- Save for later ( heart icon)
- Subscription Tiers (Base, Plus, Business)
- Progressive Onboarding (30‑day conversational learning)
- Dynamic Quick Replies (personalised buttons)
- Kurukoo Daily Picks (daily rich‑media carousel)
- Proactive Opportunity Engine (market nudges, skill alerts)
- Emergency Dispatch (connects to third‑party responders)
- Multi‑Country Architecture (/ng/, /gh/, /gb/)
- Unified Conversation (cross‑channel message history)
- Operation Mode (mobile / stationary / delivery / hybrid)
- Provider Dimensions (availability, radius, transport, pricing, payment)
- 300+ skills tags
- Intent‑Based Onboarding (“Find” / “Earn” / “Both” / "other")
- Smart‑home control
- Universal remote controls
- Reminders via SMS, push, whatsapp, USSD

### 31.1.3 Platform Operational Systems:
- Agent Network (commissions, onboarding, walk‑in assistance)
- Admin Console (content, ads, users, analytics)
- Catalog Scraper (WhatsApp Business catalog import)
- Compliance & Content Moderation
- Dispute Resolution
- Escrow (via OPay/Moniepoint)
- Multi‑Currency & Multi‑Language (i18n, 5 languages)
- KYC / NIMC Verification
- Carrier Billing (stubbed)
- Progressive Engagement Scheduler

### 31.2 Design System References

kurukoo's interface must work across a Nokia‑adjacent USSD session, a budget Android PWA, and eventually a full native app, in five languages, for users with a wide range of digital literacy. The following reference systems are chosen explicitly for this constraint set. They inform the Kurukoo design system but are applied through our own "African Modernism" visual language (cream #FFF8F0, terracotta #D97A5C, electric blue #1E88E5, charcoal #2E2E2E; Space Grotesk + Inter).

#### 31.2.1 Things that should be on the public website and PWA marketing pages:

Customer Benefit	| Kurukoo Feature(s) That Deliver It
- Get anything done – no app needed	| Channel‑agnostic access (WhatsApp, USSD, PWA)
- Find work instantly, keep all your pay	| Lead‑fee model, Kuru Work (Gigs & Professional)
- See who’s selling near you, right now	| Kuru Pulse
- Ride with trusted drivers, keep your number private	| Ride hailing + Privacy Bridge
- Save together with your community	| Group savings (Money Circle)
- Buy airtime, data, pay bills (coming soon)	| Kuru Reload
- Your skills, your hustle, one place	| Unified Memory Profile (framed as “Your Kuru Profile”)
- Emergency help, always connected	| Emergency Dispatch
- ₦500/month – less than a 1 litre of petrol	| Base membership pricing
- Sponsored Daily Picks – ads that feel useful	| Kuru Media

#### 31.2.2. Things that should NOT be on the public website (internal only):

- Operation mode
- 30‑module taxonomy
- Intent‑based onboarding mechanics
- Push‑first notification architecture
- Redis caching
- Progressive onboarding question bank
- Compliance content filtering pipeline
- Agent commission structure
- Catalog scraper
- Database schema details

#### 31.2.3. Things that should be on the internal admin console:

- Agent Network (commissions, onboarding, walk‑in assistance)
- Admin Console (content, ads, users, analytics)
- Catalog Scraper (WhatsApp Business catalog import)
- Compliance & Content Moderation
- Dispute Resolution
- Escrow (via OPay/Moniepoint)

#### 31.2.4. Things that should be on the internal developer console:

- Multi‑Currency & Multi‑Language (i18n, 5 languages)
- KYC / NIMC Verification
- Carrier Billing (stubbed)
- Progressive Engagement Scheduler
- Unified Conversation (cross‑channel message history)
- Provider Dimensions (availability, radius, transport, pricing, payment)
- 300+ skills tags
- Rewards system
- Save for later ( heart icon)
- Subscription Tiers (Base, Plus, Business)
- Dynamic Quick Replies (personalised buttons)

#### 31.2.5. Feature List for Public Frontend

The homepage and marketing pages should highlight these 10 consumer value propositions, each backed by the internal systems we’ve built:

- One Number for Everything – Dial *7000# or text 7000 on WhatsApp.
- Find Work, Keep Your Pay – Lead fees as low as 50 Points. No commissions.
- See What’s Nearby – Kuru Pulse shows live hawkers, riders, repairers.
- Ride Private – Ride connects you to drivers without exposing your number.
- Save Together – Kuru Circle for group savings.
- Top Up & Pay – Kuru Reload for airtime, data, bills.
- Your Hustle, Your Profile – Skills‑based profile learns what you do and brings you opportunities.
- Help in Emergencies – Connect to ambulances, security, fire services.
- All for ₦500/month – Access the entire platform for less than a single litre of fuel.
- Built for Nigeria, Ready for Africa – Works on any phone, in your language, with your community.
- Get errands done & send items fast — describes errand runners, bicycle delivery, and parcel sending.

This is the public face of Kurukoo. Clean, benefit‑driven, and backed by a massive internal engine that users never need to see

#### 31.2.6. Core Consumer Features
Work Toggle, Kuru Pulse, Daily Picks, Circle (Money Circle + Buying Circle + Safety Circle), Reload, Ride, Emergency SOS, Referral System, Micro‑Tasks (Kurukoo Contributors), Contact‑Based Referral Blast.

#### 31.2.7. Operational & Revenue Features
Transaction Orchestration Engine (Kurukoo Guarantee), Survey Engine, Affiliate Product Sourcing, Telco Promotions, Appointment Booking, Privacy Bridge, Blog Automation (AI‑generated drafts), Social Media Automation, SEO Features, API Documentation for Partners, Backend‑Controlled Pricing, Configurable Agent Commissions.

#### 31.3 Information Architecture — Grab / Gojek / WeChat

These Southeast Asian super‑apps solved the exact "one interface, many services" problem that Kurukoo faces. We adopt their patterns, not their visual style.

- **Single‑thread chat as the primary surface (WeChat).** The "Home" screen is the chat. Every service request, product card, survey, and delivery map appears as an inline bubble. There is no separate "services" page.
- **Bottom‑nav‑plus‑inline‑cards pattern (Grab/Gojek).** While the current PWA has no bottom tabs, any future navigation (e.g., a quick‑access tray) will follow Grab's approach: a minimal bottom bar (3‑4 icons) that surfaces context‑specific shortcuts, never a grid of all services. Inline cards inside the chat thread remain the primary discovery surface.
- **Progressive disclosure (Grab/Gojek).** Show the most likely next action first. Example: after ordering food, the next chat bubble automatically offers "Track Delivery" or "Reorder Your Usual." Don't surface all 45 categories up front; reveal complexity only when the user signals intent.
- **Service grouping without tabs (Grab).** Grab groups "Ride," "Food," "Delivery," and "Mart" under a single input. Kurukoo does the same with the chat bar: "I need a ride," "I'm hungry," "I need a plumber" — the AI routes to the correct service.
- **Persistent access to critical functions (WeChat).** A pull‑down drawer (already built) provides always‑available access to Balance, Activity, and Settings, mirroring WeChat's "Me" tab without occupying a permanent navigation slot.

#### 31.4 Component & Layout System — Material Design 3

Material 3 is free, well‑documented, and feels native on the Android devices that dominate Kurukoo's user base. We use its structural rules as the skeleton, overridden with our own colour, typography, and iconography.

- **Spacing & touch targets.** Minimum touch target 48 dp. Card padding 16 dp internal, 16 dp margin between cards. Chat bubble spacing 8 dp between consecutive bubbles, 16 dp between different senders.
- **Elevation & surfaces.** Cards (product, survey, ride picker, Pulse live) use 1 dp elevation (subtle shadow). The pull‑down drawer uses 4 dp elevation. The Reload modal uses 8 dp. No heavy shadows; keep the interface light and fast‑rendering on budget GPUs.
- **Responsive layout.** Single‑column, centred, max‑width 480 dp on larger screens (tablets, desktop PWA). The chat input bar is always pinned to the bottom; the message list scrolls above it.
- **Navigation rail (future).** If a small set of permanent destinations is ever added (e.g., on tablet), use Material 3's side navigation rail, not a bottom bar that competes with the chat input.
- **Buttons.** Primary actions (Accept, Order, Confirm) are filled, terracotta (#D97A5C). Secondary actions (Cancel, Skip) are outlined, charcoal (#2E2E2E). All buttons are minimum 48 dp tall, with 12 dp horizontal padding and 4 dp corner radius.
- **Typography scale.** Use Material 3's type scale for consistency: Headline (card titles) at 18 sp medium, Body (chat messages, descriptions) at 14 sp regular, Caption (timestamps, status labels) at 12 sp regular. Overridden with Space Grotesk (headings) and Inter (body).

#### 31.5 Icon‑First, Low‑Literacy Interaction — Duolingo

Duolingo's interface is designed to be understood even when the user cannot read the text. Kurukoo serves a multi‑language, code‑switching audience where text‑heavy UI would fail. We adopt these specific patterns.

- **Icon + colour for status, not text alone.** Instead of "Order Confirmed," show a green checkmark icon with a subtle pulse animation. Instead of "Payment Failed," show a red warning icon with the amount. Text is always present as a secondary cue, never the sole communication.
- **Shape‑based category differentiation.** Each major service uses a distinctive card shape or icon treatment, not just a label. Example: "Ride" cards have a rounded vehicle icon in a terracotta circle; "Food" cards have a plate icon in an electric‑blue circle. Users learn the shapes and colours, reducing reliance on reading.
- **Yes/No buttons with visual weight.** Survey cards and trade offers use large, coloured buttons: green (positive) and grey‑outlined (negative), consistent with Duolingo's answer buttons. No one needs to read "Yes" or "No" — the colour and position communicate intent.
- **Motion as feedback.** Subtle animations signal state changes: a checkmark bounces slightly on success; a card slides right when dismissed; a chat bubble appears from the bottom. No motion that lasts longer than 300 ms (respects performance on low‑end devices).
- **Progressive language introduction.** When a new feature is introduced (e.g., "Work" toggle turned on for the first time), use a short, animated visual explanation (2‑3 screen overlay with icons) rather than a paragraph of text. Text explanations are available but secondary.
- **Audio feedback for critical actions.** Where available, play a short sound for completed transactions, incoming ride requests, and Pulse nudges, in addition to the visual and haptic feedback. This serves users who are visually impaired or in high‑glare environments.

---

## 34. Language Services and Dialect Mapping

Module: language_services with skill tags (transcriber, translator, voice_over_artist, interpreter, language_tutor, ijaw_transcriber, izon_translator, urhobo_transcriber).

Ijaw Audio Pack: Audio prompts recorded in Izon, Nembe, and Kalabari combined with Pidgin text. LGA-to-dialect mapping supports Rivers/Bayelsa LGAs.

Data Monetization: Users can opt in to share anonymized voice samples. If opted in, anonymised clips stored securely for African language AI training.

Consent mechanism: User-facing message - "Kurukoo may use anonymised voice samples to improve African language AI. You can opt out in Settings." Consent stored in memory_profiles.preferences.data_sharing_opt_in.

---

## 35. Internationalisation (i18n) Architecture

**Architecture principle:** Kurukoo is a single codebase with feature-flagged vertical and horizontal layers. Country-prefix routing activates the appropriate layer(s) for each market.

- **Vertical layer (informal economy Africa):** Active for `/ng/` (Nigeria), `/gh/` (Ghana), and adjacent markets. Includes 45 service verticals, Points economy, Kuru Pulse, escrow-based coordination, USSD-first access, agent referral networks.
- **Horizontal layer (smart-city / utilities / life-admin):** Active for `/gb/` (UK) and future markets. Includes UK life-admin skills, GBP pricing, Stripe Connect payments, no Points (regulatory). Uses the same memory profile, conversation engine, and Points infrastructure — but Points are disabled via feature flag for `/gb/`.

**Feature flags per locale:**
- `ussd` — NG/GH only (feature-phone fallback not needed in UK)
- `nimc_kyc` — NG only (NIN verification)
- `mobile_money` — NG/GH only (OPay, Moniepoint, Paga)
- `stripe_paypal` — UK only (no cash/mobile-money dominance)
- `points_enabled` — NG/GH only (Points disabled for UK due to regulatory difference)
- `ride_robotaxi` — UK "Coming Soon" (future horizontal extension)
- `skill_<id>_enabled` — per-skill flags in `locales/*.json` under `feature_flags`
- `whatsapp_enabled` — all markets (primary acquisition channel)
- `ussd_enabled` — NG/GH only (feature-phone fallback not needed in UK)
- `pwa_enabled` — all markets
- `sms_enabled` — all markets
- `telegram_enabled` — pilot in NG, secondary in tech-forward markets
- `email_enabled` — UK primarily, NG secondarily
- `ivr_enabled` — NG/GH only (low-literacy users)
- `web_widget_enabled` — Business tier feature
- `mcp_enabled` — pilot/developer preview

**Locale files:**
- `en.json` (Nigeria, default — vertical layer)
- `en-GB.json` (UK, diaspora features — horizontal layer)
- `pcm.json` (Pidgin), `ha.json` (Hausa), `yo.json` (Yoruba), `ig.json` (Igbo)

**Rule:** All locale-specific behaviour is controlled by feature flags and `memory_profiles.country`. No hard-coded country checks in business logic. Adding a new market = new locale file + feature flag configuration + optional `available_locales` on `skill_flows`. No code rewrite.

> **Developer note — Feature flag system implementation:** The feature flag system described above is **not yet implemented** in the codebase. No locale file contains a `feature_flags` key, and no enforcement logic exists. To implement:
>
> **Step 1 — Add `feature_flags` to each locale file:**
> ```json
> // locales/ng.json (add this key)
> "feature_flags": {
>   "ussd": true,
>   "ussd_enabled": true,
>   "nimc_kyc": true,
>   "mobile_money": true,
>   "stripe_paypal": false,
>   "points_enabled": true,
>   "whatsapp_enabled": true,
>   "pwa_enabled": true,
>   "sms_enabled": true,
>   "telegram_enabled": true,
>   "email_enabled": false,
>   "ivr_enabled": true,
>   "web_widget_enabled": false,
>   "mcp_enabled": false
> }
> ```
> ```json
> // locales/gb.json (add this key)
> "feature_flags": {
>   "ussd": false,
>   "ussd_enabled": false,
>   "nimc_kyc": false,
>   "mobile_money": false,
>   "stripe_paypal": true,
>   "points_enabled": false,
>   "whatsapp_enabled": true,
>   "pwa_enabled": true,
>   "sms_enabled": true,
>   "telegram_enabled": false,
>   "email_enabled": true,
>   "ivr_enabled": false,
>   "web_widget_enabled": true,
>   "mcp_enabled": false
> }
> ```
>
> **Step 2 — Create `src/services/featureFlags.ts`:**
> ```typescript
> import { getLocale } from '../i18n.js'; // or wherever locale loading lives
>
> export function getFeatureFlag(country: string, flagName: string): boolean {
>   const locale = getLocale(country);
>   const flags = locale?.feature_flags || {};
>   return flags[flagName] ?? false; // default: disabled
> }
>
> export function isPointsEnabled(country: string): boolean {
>   return getFeatureFlag(country, 'points_enabled');
> }
>
> export function isSkillEnabled(country: string, skillId: string): boolean {
>   return getFeatureFlag(country, `skill_${skillId}_enabled`);
> }
> ```
>
> **Step 3 — Add `available_locales` column to `skill_flows`:**
> ```sql
> ALTER TABLE skill_flows ADD COLUMN available_locales TEXT;
> -- Set to JSON array e.g. '["ng","gh"]' or '["gb"]'. NULL = available to all locales.
> ```
>
> **Step 4 — Wire flag checks into services:**
> - `intentRouter.ts`: Skip skills where `isSkillEnabled(country, skill)` returns false or `available_locales` doesn't include the user's country.
> - `pointsEngine.ts`: Check `isPointsEnabled(country)` before any Points award/deduct. For UK users, skip Points logic entirely.
> - `skillFlows.ts`: Filter `listSkillFlows()` by `available_locales` matching the user's country.
> - Channel routing: Check `whatsapp_enabled`, `ussd_enabled`, etc. before sending via that channel.

**UK-specific positioning:** UK homepage focuses on: diaspora remittances, local gig economy, product marketplace, reminders/routines, and privacy trust. Pricing: Base £1/mo, Plus £3.99/mo, Business £4.99/mo (see §7.2 for the authoritative multi-country pricing table).
- All text rendered via `t()` function from locale JSON.

### 35.1 Chinese Seller Integration

No separate "international_supplier" skill. Sellers in China list themselves with existing skills (e.g., `electronics_supplier`, `fabric_wholesaler`) and set their location to "Guangzhou, China". They are discoverable via location-filtered search. Lead charge: 100 Points per match (higher value).

### 35.2 UK Life-Admin Capabilities as Universal Skills

The /gb/ locale reuses the same memory profile and conversation engine as /ng/. The difference is the default skill set, GBP pricing, and heavier feature flags. All UK life-admin capabilities are implemented as **universal skills** — they use clean, country-agnostic skill IDs (e.g., `bin_day`, `mot_reminder`, `lost_pet`, never `uk_bin_day` or `uk_mot`). This means the same skills can be enabled for any country without renaming or duplication.

Every skill listed below is a `skill_flows` entry that reads from and writes to the single memory profile, lives inside the unified conversation, uses the shared Points balance, and uses the shared presence / reminder infrastructure. No new tables, no voting system, no parallel Points system.

#### 35.2.1 Complete Skill Mapping

The following table documents every UK life-admin skill with its universal ID, user-facing name, category, required data fields, legal disclaimer, payment model, and fulfilment type.

| Skill ID | User-facing Name | Category | Required Data | Legal Disclaimer (short) | Payment Model | Fulfilment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| bin_day | Bin Day Bot | Government & Civic Help | postcode | We check your council's public bin schedule using your postcode. | 1 Point/month | chat_only |
| mot_reminder | MOT Reminder | Automotive Care & Mechanics | vehicle_registration | We check your MOT expiry with the DVLA using your vehicle registration. | 1 Point/reminder | chat_only |
| insurance_renewal | Insurance Renewal Nudge | Finance & Tax Consulting | insurance_policy_details | We remind you when your policy is due. No data is shared with insurers without consent. | 1 Point/month | chat_only |
| doctor_appointment | Appointment Reminder | Health & Medical | appointment_date (nhs_number optional) | We store only the appointment date/time to send reminders. No medical records are kept. | 1 Point/appointment | chat_only |
| council_tax | Council Tax Band Checker | Government & Civic Help | postcode, current_band | We use public VOA data. No personal financial data is stored. | 1 Point/check | chat_only (affiliate) |
| energy_tariff | Energy Tariff Watchdog | Finance & Tax Consulting | postcode, energy_usage_optional | We compare tariffs using your postcode. You may be shown affiliate links. | 1 Point/check | chat_only (affiliate) |
| lost_pet | Lost Pet Alert | Pet & Animal Care | pet_name, description, last_seen_postcode, owner_phone | Your phone number is only shared with people who find your pet. | Free | chat_only |
| skill_swap | Skill Swap | Community & Neighbourhood | skills_offered, skills_wanted | We connect you with neighbours for skill exchange. | Free | chat_only |
| parking_appeal | Parking Ticket Appeal Helper | Government & Civic Help | ticket_details, images | We generate an appeal template. You submit it yourself. | 1 Point/appeal | chat_only |
| boiler_service | Boiler Service Reminder | Repairs & Maintenance | boiler_type, last_service_date | We remind you when your boiler is due. Optionally connect local engineers. | 1 Point/month | chat_only (affiliate) |
| warranty_tracker | Warranty Tracker | Digital Services | product_name, purchase_date, warranty_length | We store purchase details only to alert you when warranties expire. | 1 Point/month | chat_only |
| moving_house | Moving House Checklist | Accommodation & Lodging | moving_date, old_postcode, new_postcode | We generate a checklist and can connect removal services. | 1 Point/month | chat_only (affiliate) |
| first_flat | First Flat Guide | Accommodation & Lodging | none | Step-by-step guide for new renters. | Free | chat_only |
| rental_tracker | Rental Application Tracker | Property & Real Estate | property_address, agent_name | We track your applications and send reminders. | 1 Point/month | chat_only |
| funeral_wishes | Funeral Wishes Planner | Community & Neighbourhood | wishes_text | We store your wishes securely. They are not legally binding. | Free | chat_only |
| digital_executor | Digital Executor | Digital Services | instructions | We store digital legacy instructions. Data is encrypted. | Free | chat_only |
| bereavement_admin | Bereavement Admin Support | Community & Neighbourhood | deceased_name | We provide checklists and guidance. | Free | chat_only |
| street_party | Street Party Organiser | Community & Neighbourhood | street_name, council | We help coordinate with neighbours and council. | Free | chat_only |
| borrowed_iou | Borrowed Item IOU | Community & Neighbourhood | item, borrower, return_date | We send reminders for borrowed items. | Free | chat_only |
| school_run | School Run Carpool | Driving & Chauffeur Services | school_name, postcode, schedule | We match nearby parents for carpooling. | 1 Point/month | chat_only |
| babysitter | Babysitter Network | Childcare & Nanny Services | child_age, date_time | We connect you with babysitters. You are responsible for vetting. | 1 Point/booking | chat_only |
| allotment_sitter | Allotment Plot Sitter | Agriculture & Produce | plot_number, watering_needs | We coordinate watering and care for your allotment. | Free | chat_only |
| pet_taxi | Pet Taxi Rota | Pet & Animal Care | pet_type, vet_address | We arrange shared pet transport. | 1 Point/trip | chat_only (affiliate) |
| micro_volunteer | Micro-Volunteering Finder | Community & Neighbourhood | interests | We suggest local volunteering opportunities. | Free | chat_only |
| pride_events | Pride Local Events | Community & Neighbourhood | postcode | We list upcoming Pride events near you. | Free | chat_only |
| right_to_roam | Right to Roam Alert | Tourism & Travel | postcode, route | We notify you about access rights on routes near you. | Free | chat_only |
| flood_line | Flood Line | Emergency Dispatch | postcode | We send Environment Agency flood warnings. | Free | chat_only |
| swep_alert | SWEP Alert | Emergency Dispatch | postcode | We alert you when Severe Weather Emergency Protocols are activated. | Free | chat_only |
| running_beacon | Running Alone Beacon | Fitness & Coaching | emergency_contact, route | Your emergency contact is only notified if you don't check in. | 1 Point/run | livecast_tracking |
| night_walk | Late Night Walk Monitor | Safety & Security | emergency_contact, route | Similar to Running Beacon for night walks. | 1 Point/walk | livecast_tracking |
| couch_to_5k | Couch to 5k Coach | Fitness & Coaching | none | We send weekly running plans. | Free | chat_only |
| sketch_prompt | Sketchbook Daily Prompt | Creative Arts & Media | none | We send a daily drawing prompt. | Free | chat_only |
| word_of_day | Word of the Day | Language & Dialect Services | language | We send a new word in your chosen language daily. | Free | chat_only |
| creative_block | Creative Block Unsticker | Creative Arts & Media | none | We send creative exercises. | Free | chat_only |
| digital_declutter | Digital Declutter Weekend | Digital Services | none | We guide you through a digital detox weekend. | Free | chat_only |
| inbox_zero | Inbox Zero Nag | Digital Services | none | We send prompts to clear your inbox. | Free | chat_only |
| side_hustle | Side Hustle Accountability | Freelance Services | goal | We check in on your side-project progress. | 1 Point/month | chat_only |
| job_tracker | Job Application Tracker | Professional Services | company, role, deadline | We track applications and send reminders. | 1 Point/month | chat_only |
| retirement_coach | Retirement Coach | Finance & Tax Consulting | retirement_date | We provide retirement planning reminders. | 1 Point/month | chat_only |
| sleep_tracker | Sleep Debt Tracker | Health & Medical | sleep_hours | We log sleep hours and remind you to catch up. | Free | chat_only |
| energy_logger | Energy Logger | Health & Medical | energy_level | We track daily energy levels. | Free | chat_only |
| pet_weight | Pet Weight Monitor | Pet & Animal Care | pet_weight | We remind you when to weigh your pet. | Free | chat_only |
| sad_lamp | SAD Lamp Reminder | Health & Medical | none | We remind you to use your SAD lamp in darker months. | Free | chat_only |
| carer_break | Carer's Break Reminder | Health & Medical | none | We nudge carers to take regular breaks. | Free | chat_only |
| car_boot | Car Boot Spotter | Classifieds & Marketplace | postcode | We list upcoming car boot sales near you. | Free | chat_only |

| museum_quiet | Museum Quiet Hour | Entertainment & Music | postcode | We list quiet hours at museums. | Free | chat_only |
| urban_explorer | Urban Explorer | Tourism & Travel | city | We suggest urban exploration routes. | Free | chat_only |
| charity_shop | Charity Shop Scout | Classifieds & Marketplace | postcode | We find charity shops near you. | Free | chat_only |
| farm_shop | Farm Shop Deadline | Classifieds & Marketplace | postcode | We remind you of farm shop times and deals. | Free | chat_only |
| vinyl_wantlist | Vinyl Wantlist | Entertainment & Music | album, artist | We track your wishlist and alert you when a copy appears. | 1 Point/month | chat_only (affiliate) |
| genealogy | Genealogy Prompt | Community & Neighbourhood | ancestor_name | We send weekly genealogy research prompts. | Free | chat_only |
| accessibility | Accessibility Checker | Government & Civic Help | venue_name | We check venue accessibility details. | Free | chat_only |
| walking_group | Walking Group | Fitness & Coaching | postcode | We help find or start a walking group near you. | Free | chat_only |
| ev_charging | EV Charging | Transport & Mobility | postcode | We find EV charging point availability. | 1 Point/check | chat_only (affiliate) |
| taxi_quick | Taxi Quick | Transport & Mobility | pickup, dropoff | We book a taxi via partner apps. You pay the partner directly. | 1 Point/booking | privacy_bridge_call |
| train_check | Train Check | Transport & Mobility | origin, destination, date | We check live train times and delays. | 1 Point/check | chat_only (affiliate) |
| flight_alert | Flight Alert | Tourism & Travel | route, dates | We alert you when flight prices drop. | 1 Point/alert | chat_only (affiliate) |
| food_nearby | Food Nearby | Food & Drink | postcode, cuisine | We list nearby restaurants. | 1 Point/check | chat_only (affiliate) |
| grocery_reminder | Grocery Reminder | Food & Drink | shopping_list | We remind you when to buy groceries. | 1 Point/month | chat_only |
| event_finder | Event Finder | Entertainment & Music | city, dates | We find local events (affiliate). | 1 Point/month | chat_only (affiliate) |
| parking_spot | Parking Spot | Transport & Mobility | location | We find and reserve parking. | 1 Point/booking | chat_only (affiliate) |
| hotel_deals | Hotel Deals | Accommodation & Lodging | city, dates | We send hotel deals. | 1 Point/alert | chat_only (affiliate) |
| gift_finder | Gift Finder | Classifieds & Marketplace | occasion, budget | We suggest gifts and send store links. | 1 Point/month | chat_only (affiliate) |

#### 35.2.2 skill_flows Configuration

Every skill listed above must have a corresponding entry in the `skill_flows` table. The `skill_flows` schema is:

```sql
skill_flows
  skill (text)                    -- universal skill ID, e.g. 'bin_day'
  question_set (JSON)             -- pre-match questions to collect required data fields
  post_match_action (text)        -- lead | appointment | affiliate | escrow | emergency
  payment_model (text)            -- lead_fee | commission | peer_to_peer | principal_margin
  fulfillment_instructions (text) -- chat_only | livecast_tracking | privacy_bridge_call | delivery_gig
  legal_disclaimer (text)         -- short disclaimer shown in chat before data collection
  booking_mode (text)             -- appointment | instant (where applicable)
```

**Configuration rules:**
- **question_set** must include fields for every item in the "Required Data" column above. For skills with no required data (`none`), the question_set can be empty or trigger immediately.
- **payment_model** is `peer_to_peer` for free skills, `lead_fee` for Point-cost skills, and `principal_margin` for affiliate-fulfilled skills.
- **fulfillment_instructions** is `chat_only` for all reminder and information skills, `livecast_tracking` for safety beacon skills (running_beacon, night_walk), and `privacy_bridge_call` for skills that require a third-party booking handoff (taxi_quick).
- **booking_mode** should be set to `appointment` for skills with scheduled reminders (bin_day, mot_reminder, doctor_appointment, boiler_service, etc.) and `instant` for on-demand lookups (council_tax, energy_tariff, train_check, etc.).
- **legal_disclaimer** must be shown as a one-time inline message in the chat before collecting any personal data. The user must confirm (tap "I understand" / "Continue") before data collection proceeds.

#### 35.2.2.1 External API Spec Cards for UK Skills

> **Developer note:** The UK life-admin skills are seeded as stubs in `skillFlows.ts` — they collect user data (postcode, vehicle reg, etc.) but do not yet query external APIs to fulfil the request. Below are the API specs for the most critical skills. Skills marked "informational only" have no public API and should return pre-configured guidance text.

**`bin_day` — Council bin schedule checker**
- **External API:** No single UK council API. Each council has its own website or API.
- **Implementation approach:** Use a community aggregator API (`api.lob.com` or council-specific). Alternatively, scrape the council's public bin collection page using the postcode.
- **Fallback:** If no API/scraper available for the user's council, return: "I can't look up bin schedules for [council name] yet. Visit [council website URL] to check your schedule. I'll remind you the day before once you tell me your collection days."
- **Cache TTL:** 24 hours (bin schedules change infrequently)
- **Legal:** "Bin schedule data is sourced from public council websites. Kurukoo is not affiliated with any council."

**`mot_reminder` — DVLA MOT expiry checker**
- **External API:** DVSA MOT History API (`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/{registration}`)
- **Auth:** API key (request from DVSA — free for low volume)
- **Request:** GET with vehicle registration (no spaces, uppercase)
- **Response:** JSON with `motTestExpiryDate`, `motTests[]` array
- **Error handling:** 404 = invalid registration, 403 = API key invalid, 429 = rate limited
- **Cache TTL:** 7 days (MOT expiry doesn't change daily)
- **Fallback:** "I couldn't check your MOT status right now. Visit https://www.gov.uk/check-mot-history to check manually. Tell me the expiry date and I'll set a reminder."
- **Legal:** "MOT data is provided by the DVSA. Kurukoo is not affiliated with the DVSA."

**`council_tax` — Council tax band checker**
- **External API:** VOA (Valuation Office Agency) public data — `https://www.gov.uk/council-tax-banding`
- **Implementation approach:** No direct API. Use the GOV.UK council tax band lookup tool by scraping or redirecting. Alternatively, return a deep link: "Check your council tax band at https://www.gov.uk/council-tax-banding. Tell me your band and I'll estimate your annual cost."
- **Cache TTL:** 30 days (bands rarely change)
- **Legal:** "Council tax data is from the VOA. Kurukoo is not affiliated with the VOA."

**`doctor_appointment` — GP appointment reminder**
- **External API:** No public GP API (NHS App has private APIs for authenticated patients only)
- **Implementation approach:** Informational only — Kurukoo cannot book GP appointments. It sets reminders and provides the GP surgery's phone number and booking instructions.
- **Response:** "I can't book GP appointments directly. Call [surgery name] at [phone number] to book. Want me to remind you to call tomorrow morning at 8:30 AM?"
- **Legal:** "Kurukoo does not provide medical advice or book appointments. Always contact your GP directly for medical matters."

**`train_check` — Train departure checker**
- **External API:** National Rail Enquiries API (`https://api.nationalrail.com/` or OpenData DARWIN API)
- **Auth:** API key (request from National Rail — free for developers)
- **Request:** GET with station CRU code (3-letter)
- **Response:** JSON with `trainServices[]` array (destination, scheduled time, expected time, platform)
- **Cache TTL:** 5 minutes (train times change frequently)
- **Fallback:** "I can't check live train times right now. Visit https://www.nationalrail.co.uk/ for real-time departures."
- **Legal:** "Train data is from National Rail Enquiries. Kurukoo is not affiliated with National Rail."

**Skills with no external API (informational only):**
- `boiler_service`, `gas_safety_check`, `electric_safety_check`, `fire_alarm_check`, `pat_test`, `property_inventory`, `lost_pet`, `tax_return_deadline`, `self_assessment_reminder`, `passport_renewal_reminder`, `driving_licence_renewal`

These skills return pre-configured guidance text and set calendar reminders. They do not query external services.

#### 35.2.3 Locale & Feature Flag Control

Availability of these skills is controlled through existing mechanisms only — no new access-control system. This is the **horizontal layer** in action: the same `skill_flows` entries serve both the vertical layer (Nigeria/Ghana informal economy) and the horizontal layer (UK life-admin) via feature flags.

1. **`memory_profiles.country`** — The primary gate. When a user's profile has `country = 'GB'`, the system includes UK life-admin skills in the default skill set. Users in other countries (`country = 'NG'`, `country = 'GH'`, etc.) do not see these skills by default.

2. **Feature flags scoped to `/gb/` locale** — Each skill has a corresponding feature flag (e.g., `skill_bin_day_enabled`, `skill_mot_reminder_enabled`, `skill_lost_pet_enabled`) in the `/gb/` locale configuration. These are defined in `locales/en-GB.json` under `feature_flags`. Flags can be toggled independently to enable/disable individual skills without code changes.

3. **Optional `available_locales` metadata** — The `skill_flows` table's `question_set` JSON can include an `available_locales` array (e.g., `["gb", "ng"]`) to restrict a skill to specific locales. If this field is not present, the skill is available to all locales (subject to `memory_profiles.country` and feature flags).

**Vertical vs horizontal rule:**
- Skills designed for the **horizontal layer** (UK life-admin) are marked with `available_locales: ["gb"]` and are disabled by default for `/ng/` and `/gh/` users.
- Skills designed for the **vertical layer** (informal economy) are marked with `available_locales: ["ng", "gh"]` and are disabled by default for `/gb/` users unless explicitly enabled.
- This prevents UK users from seeing "okada rider" or "suya seller" skills, and prevents Nigerian users from seeing "bin day" or "MOT reminder" skills.

**Behaviour:**
- UK users see a filtered, relevant subset by default — life-admin skills that match their locale (council tax, bin day, MOT, NHS appointments, etc.) are surfaced in the proactive engagement engine, quick replies, and Daily Picks.
- The same skills can later be enabled for other countries without renaming. For example, `council_tax` could be enabled for a `/ng/` user as "Local Government Tax Checker" with a different question set, using the same skill ID.
- The proactive / engagement engine can introduce skills over time based on user behaviour signals, regardless of locale. A user who frequently asks about vehicle maintenance may be prompted to try `mot_reminder` even if the feature flag is toggled off by default.

#### 35.2.4 Points Economy

**Horizontal layer note:** Points are a **vertical-layer feature** and are **disabled for the UK (`/gb/`)** via the `points_enabled` feature flag. UK users do not earn, spend, or see Points. This avoids regulatory complexity (Points are closed-loop loyalty tokens with economic value, which triggers CBN scrutiny in Nigeria but different rules in the UK).

For the vertical layer (Nigeria, Ghana), the standard rules apply:

- **1 Point** = the base micro-unit for most skills (see §7.1).
- **Free skills** (e.g., `lost_pet`, `first_flat`, `flood_line`, `couch_to_5k`) cost 0 Points — they are available to all users regardless of subscription tier.
- **Paid skills** deduct 1 Point from the user's balance at the time of each use or at the start of each reminder period. If the balance is insufficient, the user is prompted to top up or subscribe.
- **Affiliate skills** (marked `chat_only (affiliate)`) operate the same way but may display sponsored results or affiliate links. Kurukoo earns a commission on any resulting sale; the 1 Point cost is separate from the affiliate transaction.

#### 35.2.5 Tight Integration Mandate Compliance

Every skill listed in §35.2.1 has been verified against the Tight Integration Mandate (§1.4):

- ✅ **Memory Profile is the single source of truth** — All skills read required data from `memory_profiles.preferences` or collect it on first use and store it there. No separate data stores.
- ✅ **Real-time Presence is shared and adaptive** — Skills that involve location (e.g., `lost_pet`, `running_beacon`, `night_walk`) use the shared `provider_presence` layer. No separate location system.
- ✅ **The Conversation is the only primary interface** — All skills are fulfilled entirely within the chat (WhatsApp or PWA). Reminders, results, and affiliate links appear as inline messages.
- ✅ **Tokens / Points are the continuous economic layer** — All paid skills use the shared Points balance. No separate currency, credits, or tokens.
- ✅ **Proactive intelligence is driven by the same memory** — Reminders (bin day, MOT, insurance renewal, boiler service, etc.) are generated by the proactive opportunity engine using the same memory profile data.

#### 35.2.6 Diaspora Focus — "Send Support Home"

**Target:** Nigerians in the UK who need services in Nigeria, and the broader African diaspora who need services across multiple markets.

**Core flows:**

- **Send Support Home:** A diaspora user in London can send a service request to a trusted provider in Lagos (plumber, delivery, home inspection) — payment goes into escrow via Stripe, provider is dispatched, buyer confirms delivery, seller gets paid. Kurukoo earns a cross-border coordination fee. Same engine as domestic — same `find_worker`, same `memory_profiles`, same Points (disabled for GB).

- **Family Support Network:** Diaspora users can create "support circles" — recurring service budgets for family members back home (e.g., monthly grocery delivery, quarterly house cleaning). Managed via subscription, fulfilled by local providers.

- **Remittance Tracking:** Instead of sending money blindly, diaspora users send service requests (e.g., "buy school uniforms for the kids") with tracked delivery and photo confirmation. Reduces fraud risk, increases trust.

- **Diaspora Agent Network:** UK-based Kurukoo users earn referral Points (or GBP-equivalent value) for connecting diaspora friends to local services (legal, financial, relocation).

**Key insight:** Diaspora users are high-value because they (1) have GBP income, (2) trust the platform with family back home, and (3) have a strong incentive to use formal, trackable transactions over informal cash transfers.

**Blueprint alignment:** Uses the same vertical layer (informal economy skills) + horizontal layer (UK life-admin) + Transaction Orchestration Engine (cross-border escrow). No new architecture required.

#### 35.2.6.1 Cross-Border Payment Architecture

> **Developer note:** Cross-border payments are the most complex payment flow in the system. This spec defines how money moves from GBP (UK) to NGN (Nigeria) for diaspora transactions. **This is not yet implemented.**

**Payment rail:**

The cross-border flow uses a **partner-mediated escrow** model — Kurukoo does not hold a money-transmitter licence. Instead:

1. **Buyer (UK) pays in GBP:** Payment is collected via Stripe Connect (or PayPal) into Kurukoo's UK escrow account. Funds are held in GBP.
2. **FX conversion:** At the point of escrow creation, the current mid-market GBP→NGN rate is fetched from a rate API (e.g., `open.er-api.com/v6/latest/GBP`). The rate is **locked at escrow creation** (not at release) so both parties know the exact NGN amount upfront. The rate + timestamp are stored on the `escrow` record.
3. **Provider (Nigeria) is paid in NGN:** When delivery is confirmed, Kurukoo triggers a payout to the provider via OPay or Moniepoint's disbursement API. The payout amount is the locked NGN equivalent. Kurukoo's UK escrow account is debited the GBP equivalent.
4. **Coordination fee:** Kurukoo deducts a coordination fee from the escrowed funds before payout. The fee is **3% of the transaction value** (capped at £15 / ₦15,000 per transaction). This covers FX spread, payment processing, and platform revenue.

**Regulatory compliance:**
- **UK side:** Stripe Connect handles FCA-regulated payment processing. Kurukoo acts as a platform (not a money transmitter) because funds are held in Stripe's regulated escrow, not Kurukoo's own accounts.
- **Nigeria side:** OPay/Moniepoint handle CBN-regulated disbursement. The provider receives NGN via a licensed mobile money operator.
- **Kurukoo's role:** Kurukoo coordinates the transaction (matching, escrow instructions, delivery confirmation) but does not directly transmit money across borders. The money flows: Buyer → Stripe (UK) → [FX conversion] → OPay/Moniepoint (Nigeria) → Provider. Kurukoo instructs both ends but does not intermediate the funds.

**FX rate storage:**
```sql
-- Add to escrow table
ALTER TABLE escrow ADD COLUMN source_currency TEXT;      -- 'GBP'
ALTER TABLE escrow ADD COLUMN target_currency TEXT;      -- 'NGN'
ALTER TABLE escrow ADD COLUMN fx_rate REAL;              -- locked rate at creation
ALTER TABLE escrow ADD COLUMN fx_rate_source TEXT;       -- 'open.er-api.com'
ALTER TABLE escrow ADD COLUMN fx_rate_timestamp TEXT;    -- ISO 8601
ALTER TABLE escrow ADD COLUMN coordination_fee_minor INTEGER;  -- fee in source currency (pence)
```

**Dispute resolution (cross-border):**
1. Buyer (UK) reports non-delivery or unsatisfactory service.
2. Escrow status → `disputed`. Provider (Nigeria) is notified.
3. Evidence collection: Buyer provides photos/videos via chat. Provider provides delivery photos or service completion evidence.
4. Admin reviews evidence in the admin console (§38). Decision within 48 hours.
5. Outcomes: `refunded` (full refund to buyer via Stripe), `partial_release` (partial payment to provider + partial refund), `released` (full payment to provider, dispute rejected).
6. All decisions logged to `trust_ledger` (§15) and `compliance_events`.

#### 35.2.7 Engineering Advantages vs User-Facing Features (Internal Only)

**Rule:** Engineering advantages are defensible moats, NOT user-facing messaging. Users experience outcomes, not architecture.

| Engineering Advantage | User-Facing Outcome | Where It's Documented |
|---|---|---|
| AI-first intent routing (FastText + Groq) | "Kurukoo just gets you" — fast, accurate responses | Internal (§31, §4.3) |
| Single memory profile | "Kurukoo remembers everything about me" — personalised service | User-facing (§4) |
| 300+ skills, one engine | "I can ask for anything" — universal coverage | User-facing (§16) |
| Transaction Orchestration Engine | "Kurukoo guarantees the deal" — safe transactions | User-facing (§33.1.2) |
| Channel-agnostic (WhatsApp + USSD + PWA) | "It just works wherever I am" — no app download | User-facing (§6) |
| Multi-role identity | "One number, every hustle" — be both buyer and seller | User-facing (§31.2.5) |
| Living Memory Engine | "Kurukoo gets smarter the more I use it" — proactive nudges | User-facing (§4.3) |

**Public-facing copy must only describe outcomes, never architecture.** Saying "AI-powered intent routing" is engineering; saying "Kurukoo just gets you" is the user outcome.

#### 35.2.8 No New Tables Required

The features described in §35.2 are all implemented using existing infrastructure:
- `memory_profiles` for user data (including `open_intentions`)
- `skill_flows` for conversational workflows
- `messages` for unified conversation history
- `user_behavior_signals` for proactive nudges
- `provider_presence` for real-time discovery
- Points balance for economic layer
- `trade_offers` for Transaction Orchestration Engine

No separate diaspora tables, no parallel Points systems, no dedicated life-admin databases. The same engine that matches an okada rider in Lagos also schedules a MOT reminder in London.

---

## 23. WhatsApp Channel Deep-Dive

Two products: WhatsApp Business App (free, manual, limited automation) vs WhatsApp Business Cloud API (paid after free tier, fully programmable).
Conversation window: 24-hour session opens when business sends first message. If user replies within window, it resets for another 24h. One fee covers the entire thread as long as user keeps responding.
Three-layer hybrid frontend: WhatsApp (primary, 95% of smartphone users) + PWA push (free) + USSD (feature-phone fallback). Unified messages table enables cross-channel continuity.
In-chat payments: Deep-links to OPay/Moniepoint/Paga, USSD fallback codes. User never leaves conversation.

### 23.1 Push‑to‑WhatsApp Deep Linking: Keeping the Conversation Alive
Push notifications (free via FCM) can be used strategically to re‑engage users and reset the 24‑hour WhatsApp conversation window, drastically reducing the number of paid conversations.

### 23.1.2 Push Notification & Add‑to‑Home‑Screen Prompts

- **Push permission:** Triggered after the user completes their first successful request. A warm, trust‑building message: *“Let Kurukoo keep you updated on your job, even when you're not here.”* with an illustration.
- **Whitelisting guide:** A simple, illustrated step‑by‑step for Transsion (Tecno, Infinix, itel) users to disable battery optimisation for Kurukoo.
- **Add to Home Screen:** Triggered after the second visit. A short animation shows how to tap “Share” → “Add to Home Screen.” Benefits are listed: faster access, free push notifications, offline use.

### 23.1.3 WhatsApp UI Consistency

WhatsApp cannot be themed, but Kurukoo's identity is maintained through:

- **Rich media templates:** All images, carousels, and videos use the Kurukoo colour palette and typography.
- **Consistent bot voice:** The tone, emoji usage, and greeting style match the PWA's conversational design.
- **Deep‑links to PWA:** For any experience requiring a full interface (live map, dashboard), a single tap opens the PWA, which is fully branded.

### 23.1.4 USSD Menu Visual Hierarchy

- Each menu has at most **4–5 options**, using short, plain language.
- **Numbered list** with emoji markers for visual scanning.
- **Critical actions (Emergency)** always appear at the bottom with a red marker.
- **Response text** is formatted with clear line breaks, avoiding dense paragraphs.


### 23.2 Push‑to‑WhatsApp Deep Linking: Mechanism
The Kurukoo backend monitors the last user interaction timestamp (memory_profiles.last_interaction).

If a user hasn’t interacted with WhatsApp for ~18 hours (6 hours before window expires), the system sends a push notification (PWA, iOS, Android) that, when tapped, deep‑links directly into the existing WhatsApp chat.

The deep link format is https://wa.me/<KurukooPhoneNumber>?text=Hi. Tapping it opens the WhatsApp app with a pre‑filled message. Sending that message counts as a user‑initiated inbound message, which resets the 24‑hour window for free.

### 23.3 Push‑to‑WhatsApp Deep Linking: Examples of Engagement Triggers

| Notification	| Purpose
- “Still need a ride? 🛵 Tap to open your chat with kurukoo.”	Resets window, prompts action
- “Your usual bread from Nneoma’s is available. Want to order?”	Sparks interaction, keeps window alive
- “You haven’t checked your Kurukoo balance today.”	Financial nudge
- “A new plumber is nearby – remember your leak last month?”	Contextual, value‑driven

Opportunities are pushed directly into the chat thread as system messages, just as they would appear on WhatsApp.

### 23.4 Push‑to‑WhatsApp Deep Linking: Technical Implementation

FCM payload includes a link field pointing to https://wa.me/<KurukooNumber>?text=Hi%20Kurukoo.

- On Android/iOS, tapping the notification opens WhatsApp directly.
- On desktop/PWA, the link can open WhatsApp Web or show an in‑app chat if the user prefers.

The sent message (“Hi Kurukoo”) is received by our webhook, classified as a “keep‑alive” intent, and we simply reply with a friendly menu or “How can I help you today?”.

Result: We can keep a WhatsApp conversation window alive for days or weeks with free push notifications, reducing the average number of paid conversations per user to potentially one per month.

A user who interacts once daily via WhatsApp earns 1 Point and keeps the conversation window alive indefinitely.
This costs Kurukoo at most one WhatsApp conversation fee per month (if the window ever closes and reopens).

### 23.5 Self-Hosted Custom Business WhatsApp API Onboarding
To provide a zero-marginal-cost storefront route for high-tier merchants, Kurukoo offers a decentralized **Self-Hosted Custom Business WhatsApp API** configuration.
- **Standalone Setup:** Business sellers can toggle "Connect Custom Business WhatsApp API" in the unified onboarding modal.
- **Credentials:** Merchants input their specific WhatsApp Number, Meta App ID (from developer.facebook.com), and Permanent Meta System Access Token.
- **Database Mapping:** These configuration parameters are persisted directly in `memory_profiles.preferences` under the JSON path `preferences.self_hosted_whatsapp` and `preferences.whatsapp_channel_mode = 'self_hosted'`.
- **Assisted Storefront Activation (₦5,000):** If the merchant selects contributor-assisted setup, a verified Kurukoo Contributor handles Meta developer console setup, webhook handshakes, and verification within 24 hours. The setup fee is debited directly from the profile's balance as `-5000` via `credit_transactions` (recorded with type `setup_fee`).
- **Endpoint:** `POST /api/onboard/self-hosted-whatsapp` handles input validation, profile creation/updates, and fee transactions.

### 23.6 Keep-Alive Scheduler Status and FCM Push/Webhook Interceptor
To ensure transparency and allow merchants/consumers to monitor their free keep-alive cycles, Kurukoo implements a dedicated keep-alive tracker.
- **Standby Trigger:** After any conversation message, the backend sets a 15-hour countdown.
- **FCM Trigger & Interceptor:** If 15 hours pass without a text, the scheduler sends an FCM Push notification. Clicking it triggers a deep-link that auto-fills WhatsApp with verification text. Once the user hits send, our webhook interceptor captures it, keeps the session active for another 24 hours, and intercepts the response to keep it entirely free.
- **Endpoint:** `GET /api/onboard/keep-alive-status?phone={phone}` returns real-time status:
  - `active`: boolean representing active monitor state.
  - `hoursSinceLastInteraction`: integer tracking the current idle time.
  - `nextPushScheduledAt`: timestamp of the next FCM Push trigger.
  - `status`: e.g., `STANDBY_15H_TRIGGER_ACTIVE`.

### 23.7 Alternative Free Chat Bot Channels
To mitigate Meta-specific platform lock-in and provide zero-messaging-fee alternatives, the Unified Onboarding Modal includes instant access to other popular social messenger bots:
- **Telegram Bot:** Tapping deep-links directly with user validation `https://t.me/kurukoo_bot?start=onboard_{phone_number}`.
- **Facebook Messenger Bot:** Deep-links to `https://m.me/kurukoo`.
- **Instagram DM Helper:** Deep-links to `https://instagram.com/kurukoo`.
- **TikTok DM Agent:** Deep-links to `https://tiktok.com/@kurukoo`.
- These channels offer 100% free messaging with zero Meta conversation-window fees, allowing budget-conscious users or those on lightweight devices to access all Kurukoo services.

---

## 24. High-Profile and Celebrity Opportunities

Celebrities (Davido, Basketmouth, Don Jazzy) listed as providers on Kurukoo Business. Onboarded via talent agencies. Verified manager profiles with trust badges. Lead generation model with higher charges.

---

## 25. Negative Review Handling

1-2 star reviews recorded. Rolling 30-day average checked. If <3.0 after 10 reviews for a specific skill, flagged for human review. Outcome: temporary suspension (7 days) or permanent removal of that skill only. Other skills unaffected.

---

## 26. Technology Stack

> **Developer note — Development vs. Production Stack:** The codebase currently runs on the **development stack** (SQLite, in-memory caches, no Redis). The **production stack** is the target for pilot launch and scaling. All code should be written to work on the development stack now and migrate to the production stack with minimal changes.
>
> | Component | Development (Current) | Production (Target) | Migration Trigger |
> |-----------|----------------------|---------------------|-------------------|
> | Database | SQLite (`sql.js`, in-memory + file persistence) | PostgreSQL 15+ | 1,000+ users or concurrent write contention |
> | Cache | In-memory `Map` with manual TTL | Redis 7+ | 500+ users or presence query latency > 100ms |
> | Spatial index | Bounding-box lat/lng queries | PostgreSQL GIST (`ll_to_earth`) | PostgreSQL migration |
> | File storage | Local filesystem | S3-compatible (Cloudflare R2 / AWS S3) | UK launch (GDPR data residency) |
> | WebSocket | `ws` library, in-memory rooms | Sticky-session load balancer + Redis pub/sub for room sync | 2+ server instances |
> | Process model | Single Node.js process | PM2 cluster mode or Docker + Kubernetes | CPU saturation on single core |

- Backend: Node.js/TypeScript, Express, SQLite  (-> PostgreSQL at scale).
- Frontend: Vanilla HTML/CSS/JS (no React, no Vite, no JSX)
- Caching: Redis is the hot-path cache (sub-millisecond reads) for: current Points balance, provider presence records, recent messages (last 50), memory profile snapshots, rate-limit counters, and session data. Postgres/SQLite remains the source of truth; Redis is the acceleration layer with aggressive TTLs.
- Channels: WhatsApp Cloud API, Africa's Talking (USSD/SMS/Voice), PWA with FCM push
- AI: FastText (self‑hosted intent classifier, 10 MB, auto‑train) for 98% intent classification, Groq API (free‑tier Llama‑3.1‑8B‑Instant for complex 2% queries). Note - Currently uses token similarity simulator. Real FastText CLI model integration is a Phase 1 completion task.
- Real‑Time: WebRTC (voice, video, data, live tracking, liveCast, proximity nudge), WebSockets (signalling)
- Payments: Integrated mobile money (OPay, Moniepoint, Paga); Stripe Connect for UK
- Privacy Bridge: Africa Talking Voice / Twilio for number masking. (Service stub exists; full number‑masking integration is a Phase 2 task. Phone numbers are currently exchanged directly after matching.)
- Maps: OpenStreetMap with Leaflet.js, self‑hosted OSRM for routing.
- Data Retention: 30-day location purge, 60-day transactions, 90-day messages, 12-month compliance logs
- Point Compliance: Closed-loop loyalty tokens; no cash-out, no P2P stored-value transfer.
- **AI Router:** Free‑tier multi‑provider (Groq, Mistral, Gemini, OpenRouter) with local keyword fallback

---

## 27. Government Policy Landscape

| Area | Regulator | Impact |
|------|----------|--------|
| Data protection | NDPC (NDPA 2023) | Must register as data controller; consent, minimisation, 72hr breach notification, right to deletion |
| Telecoms/short codes | NCC | Shortcode + USSD require NCC approval; 4-8 week process |
| Payments/wallets | CBN | Never hold funds directly; integrate via licensed MMO APIs. Full MMO licence N2bn capital; Super-Agent N50M. Not applicable if we do not hold funds |
| Health/telemedicine | MDCN | Platform must not diagnose. Connect only to MDCN-registered practitioners or licensed HMO partner |
| Gig labour | No dedicated law yet | Keep engagement terms as independent contracting |
| Corporate/tax | CAC, FIRS | LTD incorporation, VAT (7.5%), company income tax |

---

## 28. Implementation Roadmap


### Phase 1 (Pilot — Months 1‑6)
- Fix database seed bug. ✅ (Done)
- Wire USSD messages to unified `messages` table. ✅ (Done)
- Enforce subscription tier gating on premium actions. ✅ (Done)
- Build the single‑screen chat PWA with pull‑down drawer. ✅ (Done)
- Implement survey‑style opportunity engine (replace gig board). ✅ (Done — Phase 2)
- Deploy FastText intent classifier and integrate into AI router.
- Connect Groq API as fallback for complex queries.
- Launch pilot in one Nigerian city with 50‑100 seeded providers, Prove IVR/USSD ordering. Validate liveCast model.

### Phase 2 (Growth — Months 7‑18)
- Integrate WebRTC for voice/video calling and liveCast tracking, launch WhatsApp channel and expand to more cities.
- Build Work toggle with lead‑generation and Transaction Orchestration Engine (escrow-based coordination, no inventory holding).
- Add micro‑insurance, market price intelligence, and buying circles (as Circle extension).
- Launch UK version (£1/month) as a **horizontal extension** — same memory profile, same conversation engine, same Points balance, gated by `/gb/` locale feature flags and `memory_profiles.country = 'GB'`. UK skills are implemented as universal `skill_flows` entries (e.g., `bin_day`, `mot_reminder`) with `available_locales: ["gb"]`. No new tables, no parallel Points system, no country-prefixed skill IDs.
- Integrate universal remote and smart‑home control (starting with WiFi‑based devices).
- Launch bill payments via PSP (Paga/Moniepoint) — no Super Agent licence required.
- **Bill payments three-tier rollout:** (1) Airtime/data via Africa's Talking (immediate, optional NCC Class Licence ~₦10k), (2) Electricity, DSTV, GOtv, Startimes via PSP at launch (no licence needed — PSP holds CBN approval), (3) Full agent network + cash-in/out via Kuru Pay brand later (requires Super Agent licence at ₦50M capital threshold).
- **Feature-flag discipline:** All Phase 2 and Phase 3 features that are market-specific must be controlled by locale feature flags, not hard-coded country checks. This keeps the codebase clean and makes future market additions a configuration change, not a rewrite.

### Phase 3 (Scale — Months 19‑36)
- Full Transaction Orchestration Engine with AI-assisted coordination (no inventory holding).
- Peer‑to‑peer tool rental, virtual neighbourhood watch, language interpretation.
- Expand smart‑home device support (IR, Zigbee, MQTT).
- Native iOS/Android apps (Flutter).
- Pan‑African expansion (Ghana, Kenya) and diaspora features — all via feature flags. No code rewrite required for new markets.
- **Smart-city pilot:** Activate horizontal layer for one city (e.g., Abuja smart-district试点) — MVNO, utilities, city services — using the same infrastructure. This is the first true horizontal deployment and validates the feature-flag architecture.

### 28.1. Long-term vision (future):

Kuru Solar - Solar panel sales, installation, and peer-to-peer energy trading (future).
Kuru Pay - Payment processing & Super Agent - The licensed entity that processes airtime, data, DSTV, electricity payments. After obtaining the Super Agent licence, this brand handles all bill payments.
Kuru HUb - Physical service centres - Future walk-in locations for agent services, provider training, tool rental, and community events. "Visit your Kuru Hub."
Kuru Agent - Agent network - The brand for the agent recruitment and management platform. Agents are "Kuru Agents."
Kuru Foods - Cloud kitchens / food delivery - Owned restaurants or meal delivery service, powered by the platform.
Kurukoo Smart City -	Urban development - The long-term smart city project. The entire city runs on Kurukoo OS.
Kuru Homes - Real estate / rentals - Property listing and short-let management.
Kuru Airways - Aviation - Ultra-long-term vision: a regional airline that books tickets directly through Kurukoo.
Kuru Media - Advertising & Daily Picks - The ad network and sponsored content arm. "Kuru Media" sells placements in Daily Picks, push notifications, and the Notifications tab.
Kuru Coin - Future token - If a tokenised economy ever makes sense, "Kuru Coin" is ready. Not a priority.

**Long-Term Multi-Agent Horizon (Future, Not Current Scope):** The same constrained memory-profile + skills architecture is deliberately designed so that, over time, human providers and specialised AI agents (delivery, logistics, home automation, manufacturing, and beyond) can negotiate and complete tasks with each other inside the same system. This is a future horizon, not current build scope; no multi-agent negotiation is built today. The current architecture (one memory profile, one skills schema, constrained AI agents with hard quotas) is the foundation that makes this evolution possible without a rewrite.

### 28.2. Long‑Term Aspirations (Horizontal Layer — Future via Feature Flags)

These aspirations represent the **horizontal infrastructure layer** that can be activated in any market once the vertical layer is stable. They are not separate products — they are the same Kurukoo infrastructure applied to new domains.

- **Kuru Mobile (MVNO):** Mobile + home internet + TV bundle. Uses the same identity, payments, and conversation infrastructure. Activated via feature flags when MVNO licence is obtained.
- **Kuru Pay:** The licensed payment entity. Handles full bill payments, agent network management, cash-in/out, and own settlement. Activated when Super Agent licence is obtained. Three-tier rollout: (1) Airtime/data via Africa's Talking now (optional NCC Class Licence ~₦10k), (2) Bill payments via PSP at launch (no licence needed), (3) Full agent network + cash-in/out via Kuru Pay brand later (requires Super Agent licence at ₦50M capital threshold).
- **Kuru Hub:** Physical service centres for agent training, tool rental, community events. Uses the same agent network and provider_presence infrastructure.
- **Kuru Homes:** Real estate / rentals / short-let management. Uses the same skill_flows, appointment booking, and escrow infrastructure.
- **Kuru Airways:** Aviation bookings. Uses the same affiliate and escrow infrastructure.
- **Kuru Coin:** Future tokenised economy. Only activated if/when regulatory clarity emerges. Not a priority.
- **Kurukoo Smart City:** The entire city runs on Kurukoo OS — conversation, identity, payments, logistics, trust, utilities, transport. This is the ultimate horizontal deployment: the same infrastructure powering the informal economy is repurposed as city infrastructure.

**Rule:** None of these horizontal extensions require a code rewrite. They are activated by feature flags (`memory_profiles.country`, locale `feature_flags`, `skill_flows.available_locales`) and configuration changes. The core engine (conversation, memory profile, Points, presence, escrow) remains unchanged.

### 28.2. (The Operational Launch Sequence)

These are not engineering tasks—they are business, legal, and partnership actions required to turn the platform from a codebase into a live service:

- Meta WhatsApp Business setup
  1. Create a Meta Business account registered in Nigeria.
  2. Obtain a dedicated phone number for Kurukoo.
  3. Configure the webhook to point to your live server endpoint.
  4. Test with a Meta-provided test number (free).

Africa’s Talking USSD sandbox
  1. Sign up for a shared shortcode (available in 24–48 hours).
  2. Connect the callback to your server’s /ussd endpoint.
  3. Test the full *7000# flow from a real phone.

Real mobile money integration
  1. Obtain sandbox API keys from OPay or Moniepoint.
  2. Replace the simulated wallet top‑up with real test Naira transactions.
  3. Validate the full Point purchase flow.
  
Pilot city selection & provider recruitment
  1. Choose a mid‑sized city with high smartphone penetration and a strong informal sector (e.g., Ibadan).
  2. Manually seed 50–100 providers (riders, food vendors, plumbers, hawkers) with real phone numbers.
  3. Run 30 days of real transactions with a small, trusted user group.

Legal & compliance
  1. Register Kurukoo Technologies Ltd with CAC.
  2. Obtain a formal CBN legal opinion on the Point‑to‑airtime model.
  3. File the provisional patent for Kuru Pulse.

---

## 37. Contingency Plans

| Scenario | Triggered By | Automated Action |
|----------|-------------|------------------|
| AI router fails | 3 consecutive failed intent classifications | Fallback to human dispatcher pool; log to unknown_intents table |
| WhatsApp API down | 5 failed message sends in 1 minute | Route all outbound to SMS; retry WhatsApp every 5 minutes |
| Payment provider down | 3 failed payment API calls | Freeze all wallet deductions; notify users via SMS; activate manual reconciliation |
| Server overload | CPU > 80% for 5 minutes | Enable rate limiting; deprioritize non-critical nudges; push notification to admin |
| Database corruption | Checksum mismatch on backup | Restore from latest backup; notify DBA |
| Telco USSD outage | No USSD callback received for 2 minutes | Fallback IVR announcement with alternative contact methods |


---

## 44. Risks & Mitigations

| Risk | Mitigation |
|-----|-----------|
| Poor voice-recognition accuracy for local languages/dialects | Start with constrained, limited-vocabulary domains per vertical; human-in-the-loop validation; continuously retrain on real user interactions |
| Provider reliability / fraud | Strict vetting, escrow-style payments, rating system, group micro-insurance, clear blacklist policy |
| Shortcode/telco cost and dependency | Negotiate revenue-share or zero-rating deals; pursue multiple telco relationships; keep a plain-line IVR fallback |
| Low uptake of digital wallets | Support cash-on-delivery/on-completion initially; incentivise wallet use with small discounts; lean on agent cash-in points |
| Regulatory exposure (health, security, payments) | Partner with already-licensed entities in each regulated vertical rather than seeking heavy licences directly; proactive regulator engagement |
| Gig-worker classification changes | Keep engagement terms clearly framed as independent contracting; monitor legal developments |
| WhatsApp API dependency / pricing changes | PWA and USSD channels are fully functional backups; channel-agnostic architecture prevents lock-in |
| Data breach / privacy | Encryption at rest (AES-256) and in transit (TLS 1.3); 72-hour breach notification; annual penetration testing |

---

## 46. Data Retention Policy

Summary:
- Location history: Purged after 30 days unless user opts in
- Transaction records: Retained 7 years (legal requirement for financial records), then cold storage
- Memory profile: Duration of account. Deleted within 30 days of user request
- Temp sessions: Retained 7 days
- Voice recordings: Purged after intent classification completes. Anonymised samples retained only with explicit consent
- Chat messages: Retained 12 months, then anonymised and aggregated into behaviour patterns and deleted
- Compliance events: Retained 12 months (regulatory requirement), then anonymised


**Purge mechanism (zero ongoing cost):**
a. Cron job runs daily at 2am. One DELETE per table with `WHERE created_at < cutoff`.
b. Runs inside a transaction; if any delete fails, whole batch rolls back and alerts admin.
c. No data moved to archive tables. Deleted permanently.

| Table | Default Retention | 30-Day Opt-In | Method |
|-------|-------------------|---------------|--------|
| location_history | 30 days | 12 months (user says "Keep") | DELETE WHERE cutoff |
| temp_sessions | 7 days | N/A | DELETE WHERE cutoff |
| voice_recordings | After classification | N/A | DELETE WHERE processed=true |
| chat_messages | 12 months | N/A | Anonymise THEN delete |
| compliance_events | 12 months | N/A | Anonymise THEN delete |
| consent_logs | 7 years | N/A | Anonymise (legal hold, never delete) |

**30-day opt-in:** User sends "Keep my location" -> `preferences.location_retention_opt_in = true` -> cron uses 12-month cutoff. User says "Delete my location" -> resets to 30 days.

**User-initiated deletion:** "Delete my account" in Settings -> triggers purge of all user data within 30 days per NDPA 2023. Audit log entry created in compliance_events before deletion begins.

---

## 47. Caching Strategy

> **Developer note — Development cache:** Redis is **not yet in use**. The codebase runs on SQLite with in-memory caches. For development, use a simple `Map<string, { value: any, expiresAt: number }>` with TTL-based cleanup as a Redis stand-in. Create a `src/services/cache.ts` with `cacheGet(key)`, `cacheSet(key, value, ttlMs)`, and `cacheInvalidate(key)` that uses the in-memory Map now and can be swapped to Redis later with no API change. All high-frequency reads (Points balance, presence, recent messages) should go through this cache layer.

**Redis is the hot-path cache** (sub-millisecond reads) for the following, all with aggressive TTLs. Postgres/SQLite remains the source of truth; Redis is the acceleration layer:
- Current Points balance
- Provider presence records
- Recent messages (last 50)
- Memory profile snapshots
- Rate-limit counters
- Session data
- WhatsApp conversation window cache (TTL: 24 hours, tracks whether window is still open)
- Leaderboards

**Secondary caches:**
- In-memory LRU cache for frequently accessed memory profiles (TTL: 5 minutes)
- CDN for static assets (PWA shell, icons, locale files)
- Database query cache for skill search results (TTL: 30 seconds)

---

## 48. Unit Economics & Financial Model

**Per-transaction economics:**

| Metric | Value | Derivation |
|--------|-------|-----------|
| Per-job cost (smartphone) | N0 | Push + user-initiated WhatsApp, no per-message fee |
| Per-job cost (feature-phone) | N10-15 | SMS fallback, covered by Lite/Base plan |
| WhatsApp cost reduction | 98% | Push nudge resets 24hr window; daily engagement costs N70.65/month max |
| Point top-up margin | ~100% | Points sold at face value (N1 = 1 Point); near-zero cost |

**Revenue projections (conservative):**

| Users | Mix | Monthly Revenue | Infrastructure Cost | Net |
|-------|-----|---------------|-------------------|-----|
| 1,000 | 70% Base (N500), 30% Plus (N1,500) | N950,000 | <N200,000 | N750,000 |
| 10,000 | 70% Base, 20% Plus, 10% Business | N9,500,000 | <N500,000 | N9,000,000 |
| 50,000 | 70% Base, 20% Plus, 10% Business | N47,500,000 | <N1,500,000 | N46,000,000 |
| 100,000 | Same mix | N95,000,000 | <N2,500,000 | N92,500,000 |

Infrastructure scaling: PostgreSQL + Redis on a single medium instance covers 10K users. At 50K, add read replica. At 100K, add dedicated Redis cluster. Linear cost scaling.

**Customer Acquisition Cost (CAC):**
- Organic (WhatsApp, word-of-mouth, USSD): N0-50 per user
- Paid (social ads, radio, influencer): N200-500 per subscriber
- Target blended CAC: < N150 per user
- Payback period: 3 months (Base tier at N500/month)

**Customer Lifetime Value (LTV):**
- Average subscription duration: 8 months (conservative)
- Base tier LTV: N500 * 8 = N4,000
- Plus tier LTV: N1,500 * 8 = N12,000
- Business tier LTV: N5,000 * 8 = N40,000
- Blended LTV (70/20/10 mix): ~N6,800 per user
- LTV:CAC ratio target: > 45:1 (healthy for marketplace platforms)

**Churn assumptions:**
- Monthly churn: 5% (industry average for emerging-market subscription apps)
- Annual churn: ~46%
- Churn reduction levers: daily engagement (1 Point reward), progressive onboarding (30-day learning), community features (Circle, Daily Picks)

**Break-even analysis:**
- Monthly fixed costs at 10K users: N500,000 (infrastructure + team + WhatsApp)
- Revenue at 10K users (conservative): N9,500,000
- Break-even: ~600 subscribers at Base tier, or ~200 at mixed tier
- Path to profitability: Achievable at ~2,000-3,000 paying subscribers

---

## 49. Cost-Effective Operating Principles

These principles are mandatory and govern every build decision:

- Presence Trick-Bridge is mandatory — continuous feel without continuous cost.
- FCM is the always-on nervous system for nudges and re-engagement.
- WebRTC / precise GPS only on confirmed high-value moments (accepted nudge, active job, explicit live-location share).
- FastText handles ≥95% of intent classification locally; paid LLMs are last-resort fallback.
- Free / open models are preferred; paid models are quota-limited per agent and per day.
- Aggressive TTLs and Redis for all hot presence and profile data; Postgres/SQLite remains the source of truth.
- Proactive marketing messages are strictly limited and preferably user-initiated.
- AI agents have hard resource quotas (concurrency, tokens, rate limits) with automatic pause rules.

---

## 50. Current Implementation Status

> **Developer note:** This section reflects the actual codebase as of v5.51. Items marked ✅ are built and functional. Items marked ⚠️ are partially built (stubs or missing pieces). Items marked ❌ are specified in the blueprint but not yet implemented.

**Built and functional (✅):**
- ✅ Unified memory profile + skills schema (`memory_profiles`, `skills`, `messages` tables)
- ✅ AI memory service (preferences, behaviour, role inference) — `memoryProfile.ts` with AES-256 encryption
- ✅ Subscription engine with liveCast credits — `subscription.ts`, tier gating
- ✅ Skills-based request matching — `find_worker` generic handler, 300+ skill flows seeded
- ✅ 1 generic USSD handler (reads `service_categories` and `skill_flows`) — `src/ussd/menus.ts`
- ✅ Intelligent onboarding (name capture, behaviour learning) — `progressiveOnboarding.ts`
- ✅ Unified adaptive dashboard (API + UI) — `public/dashboard.html`, `kurukoo-chat.js`
- ✅ Driver lead charge (50 Points after 2 months) — `pointsEngine.ts` with grace cap
- ✅ Growth and Community Fund (10% internal allocation) — tracked in Points ledger
- ✅ Session store, transaction logging, Point system — `pointsEngine.ts`, `POINTS_COMPLIANCE.md`
- ✅ TypeScript compilation — strict mode, NodeNext ESM, 0 errors
- ✅ E2E tests — 100/100 passing (`tests/run-blueprint.ts`)
- ✅ AI Agents as first-class users — `aiAgentService.ts` (482 lines), REST API, admin UI
- ✅ Verified Artist Booking — `artistBookingService.ts`, full state machine, cooling-off cron
- ✅ Privacy Bridge — `privacyBridge.ts`, proxy numbers, AES-256, access log
- ✅ Referral Programme — `referralService.ts`, code generation, tracking, 200-Point rewards
- ✅ Points Economy — `pointsEngine.ts`, CBN-compliant, grace cap, leaderboard
- ✅ Content Moderation Pipeline — `complianceFilter.ts` (Layer 1 blocklist file still needed)
- ✅ Escrow service — `escrow.ts` (create, release, refund) — missing booking-specific columns
- ✅ Survey/Opportunity Engine — `surveyEngine.ts`, `engagementScheduler.ts`
- ✅ Rating service — `ratingService.ts`

**Partially built (⚠️):**
- ⚠️ FastText pipeline — `fastTextService.ts` exists with template fallback; real FastText CLI model integration is a Phase 1 task
- ⚠️ Notification architecture — `pushNotifications.ts` exists; push delivery confirmation loop (§13.3) needs verification
- ⚠️ Kuru Pulse — `nearbyPulse.ts` exists; spatial queries use bounding-box (not GIST); Presence Trick-Bridge logic needs completion
- ⚠️ Transaction Orchestration Engine — `tradeEngine.ts` exists but implements **old arbitrage model**, needs complete rewrite to escrow-based flow (see §33.1.3 developer note)
- ⚠️ Agent Network — `commissionService.ts` exists; catalog scraper and soft-claim merge not implemented
- ⚠️ UK Life-Admin Skills — 60+ skills seeded in `skillFlows.ts` as stubs; external API integrations not built
- ⚠️ KuruTrust Trust Ledger — `trust_score` column exists; hash chain ledger and Twitter bot not implemented; trust score formula needs implementation (see §15.1)
- ⚠️ WebRTC — `webrtcSignalling.ts` is a 12-line stub; full signalling, STUN/TURN, data channels needed (see §32.11)
- ⚠️ IoT Bridge — `iotBridge.ts` is a 19-line stub; MQTT broker integration needed (see §32.12)

**Not yet implemented (❌):**
- ❌ Feature flag system — no `feature_flags` in locale files, no enforcement (see §35 developer note)
- ❌ Living Memory Engine — MMR retrieval, memory lifecycle, open intentions, ai_audit_log (see §4.3)
- ❌ SSO / Email authentication — schema columns not yet added (see §2.1 developer note)
- ❌ Diaspora cross-border payments — no payment rail or FX logic (see §35.2.6.1)
- ❌ Redis caching — codebase uses SQLite only (see §47 developer note)
- ❌ PostgreSQL migration — codebase runs on SQLite (see §26 dev vs prod table)
- ❌ MCP server pattern — alignment note only, no implementation
- ❌ Kokoro-Engine workflow pattern — alignment note only, no implementation
- ❌ `config/blocklist.json` — file does not exist (see §17 developer note)

---

## 51. What Is NOT Built Yet

- Africa Talking live USSD sandbox and ngrok
- Real mobile money API (Moniepoint/Paga)
- Carrier billing (MTN/Airtel)
- NIMC KYC verification
- Real-time GPS rider matching
- Provider self-onboarding via *7000*99# (USSD flow stubbed; needs testing)
- Multi-language IVR (Hausa/Yoruba/Igbo/Pidgin) flows.
- Medication reminders
- Native iOS/Android apps
- Feature flag system (§35) — locale `feature_flags` keys, `available_locales` on `skill_flows`, enforcement in services
- Living Memory Engine (§4.3) — MMR retrieval, memory lifecycle cron, open intentions, `ai_audit_log` table, Working Context inspector
- SSO authentication (§1.5.2) — `email`, `sso_provider`, `sso_provider_id`, `email_verified_at` columns on `memory_profiles`
- Transaction Orchestration Engine rewrite (§33.1.3) — `tradeEngine.ts` must be rewritten from arbitrage to escrow
- Cross-border diaspora payments (§35.2.6.1) — Stripe UK → OPay/Moniepoint NG, FX conversion, coordination fee
- Redis caching layer (§47) — `cache.ts` with `cacheGet`/`cacheSet`/`cacheInvalidate`
- Trust score formula (§15.1) — composite calculation from ratings, jobs, verification, disputes, age
- WebRTC full implementation (§32.11) — signalling, STUN/TURN, SDP/ICE, data channels
- IoT bridge full implementation (§32.12) — MQTT broker, device discovery, command flow
- `config/blocklist.json` — content moderation Layer 1 blocklist file

---

## 52. Priority Action Items — Consolidated Build Roadmap

> **Developer note:** This section consolidates all priority action items from the Technical Spec Audit (`TECHNICAL_SPEC_AUDIT.md`) into a single, trackable build backlog. Each item cross-references the blueprint section where the full technical specification already lives (added in v5.52 as inline developer notes). Items are ordered by priority tier: Immediate (blocks all further development) → Near-Term (needed for UK launch) → Medium-Term (needed for scale) → Low Priority (future work). When an item is completed, update its status marker from ❌ to ✅ and add the completion date. This section is the single source of truth for what remains to be built and in what order.

### 52.0. Summary — All 20 Action Items + 5 Consistency Fixes

| ID | Finding | Severity | Action | Spec § | Status |
|----|---------|----------|--------|--------|--------|
| PA-1 | C1 | CRITICAL | Rewrite `tradeEngine.ts` to escrow-based Transaction Orchestration Engine | §33.1.3 | ❌ |
| PA-2 | C2 | CRITICAL | Add 8 missing `memory_profiles` columns | §2.1 | ❌ |
| PA-3 | C3 | CRITICAL | Implement feature flag system | §35 | ❌ |
| PA-4 | C4 | HIGH | Add 4 missing `escrow` columns | §43 | ❌ |
| PA-5 | H2 | HIGH | Build cross-border payment rail (diaspora) | §35.2.6.1 | ❌ |
| PA-6 | H3 | HIGH | Build UK external API integrations | §35.2.2.1 | ❌ |
| PA-7 | M6 | MEDIUM | Resolve UK Points contradiction in code | §7.1, §35 | ❌ |
| PA-8 | H4 | HIGH | Migrate dev→prod stack (SQLite→PostgreSQL+Redis) | §26, §47 | ❌ |
| PA-9 | H1 | HIGH | Build Living Memory Engine (MMR, lifecycle, audit log) | §4.3 | ❌ |
| PA-10 | M1 | MEDIUM | Implement trust score formula | §15.1 | ❌ |
| PA-11 | M2 | MEDIUM | Build full WebRTC implementation | §32.11 | ❌ |
| PA-12 | M3 | MEDIUM | Build full IoT bridge implementation | §32.12 | ❌ |
| PA-13 | M4 | MEDIUM | Create `config/blocklist.json` | §17 | ❌ |
| PA-14 | L1 | LOW | MCP server specification (Future) | §4 note | ❌ |
| PA-15 | L2 | LOW | Kokoro-Engine workflow specification (Future) | §4 note | ❌ |
| PA-16 | L3 | LOW | Complete notification delivery confirmation loop | §13.3 | ⚠️ |
| PA-17 | M7 | MEDIUM | Implement catalog scraper | §9 | ❌ |
| PA-18 | — | HIGH | Refactor `head.ejs` to per-page SEO metadata + canonical/OG/Twitter/JSON-LD/hreflang | §53.2.2, §32.6 | ❌ |
| PA-19 | — | HIGH | Implement `robots.txt` + multi-sitemap (`sitemap.xml` index) generation pipeline | §53.2.1 | ❌ |
| PA-20 | — | MEDIUM | Build Programmatic SEO engine (category×city×country) + GEO/llms.txt | §53.2.4, §53.2.5 | ❌ |
| CF-1 | X1 | LOW | Fix package version mismatch | — | ❌ |
| CF-2 | X2 | LOW | Expand `types.ts` `MemoryProfile` interface | §2.1 | ❌ |
| CF-3 | X3 | LOW | Replace `addCredits()` with `addPoints()` | — | ❌ |
| CF-4 | M5 | LOW | Fix §8 subscription tier table separator | §8 | ✅ |
| CF-5 | H5 | MEDIUM | SQLite bounding-box query for spatial index | §5 | ✅ |

---

### 52.1. Immediate — Blocks Development (CRITICAL)

These four items must be resolved before any further feature development. They represent critical contradictions between the blueprint specification and the actual codebase that would mislead any developer attempting to build on the current code.

**PA-1. Rewrite `tradeEngine.ts` to Escrow-Based Transaction Orchestration Engine**
- **Finding:** C1 — CRITICAL
- **Status:** ❌ Not started
- **Problem:** `tradeEngine.ts` still implements the old arbitrage model: `ArbitrageDeal` interface with `buyPrice`/`sellPrice`/`fee`, `calculateArbitrage()`, `detectArbitrage()` returning hardcoded mock deals (rice, TV, solar lamp), `executeTrade()` recording in `survey_opportunities` and paying via `addCredits()`. Console log reads `"Running daily Principal Arbitrage Trade Engine pass..."`. No escrow integration — does not call `createEscrow()`, `releaseEscrow()`, or `refundEscrow()`.
- **Blueprint says (§33.1):** Transaction Orchestration Engine — buyer pays into escrow (OPay/Moniepoint), platform takes coordination cut, seller's portion held in escrow, delivery confirmed → release payment. No inventory holding, no working capital.
- **Fix:**
  1. Remove `ArbitrageDeal` interface, `calculateArbitrage()`, `detectArbitrage()`, and the arbitrage path of `executeTrade()`.
  2. Implement the 5-step escrow flow: (1) buyer requests → (2) `createEscrow()` hold → (3) provider dispatched → (4) delivery confirmed → (5) `releaseEscrow()` minus coordination fee.
  3. Replace `addCredits()` with `addPoints()` (resolves CF-3).
  4. Update console log to `"Running Transaction Orchestration Engine pass..."`.
- **Spec:** §33.1.3 · **Files:** `src/services/tradeEngine.ts`, `src/types.ts`

**PA-2. Add Missing `memory_profiles` Columns**
- **Finding:** C2 — CRITICAL
- **Status:** ❌ Not started
- **Problem:** The `memory_profiles` table in `src/database.ts` has 20 columns. The blueprint (§2.1, updated v5.51) specifies 25+. Missing: `email`, `full_name`, `sso_provider`, `sso_provider_id`, `email_verified_at`, `display_name`, `subscription_expiry`, `available_for_work`. The `MemoryProfile` interface in `src/types.ts` has only 9 fields (resolves CF-2).
- **Impact:** SSO authentication (v5.51), email-based UK compliance, and subscription auto-renewal cannot be built without these columns.
- **Fix:**
  1. Add `ALTER TABLE memory_profiles ADD COLUMN` statements for all 8 missing columns in the `initTables()` migration block in `src/database.ts`.
  2. Update `MemoryProfile` interface in `src/types.ts` to match the full blueprint schema (25+ fields).
  3. Update all service files that read/write `memory_profiles` to handle the new columns.
- **Spec:** §2.1 · **Files:** `src/database.ts`, `src/types.ts`, `src/services/memoryProfile.ts`

**PA-3. Implement Feature Flag System**
- **Finding:** C3 — CRITICAL
- **Status:** ❌ Not started
- **Problem:** No locale file contains a `feature_flags` key. `locales/gb.json` and `locales/ng.json` only have i18n strings. There is no feature flag enforcement anywhere in the codebase. The `available_locales` field on `skill_flows` is also missing from the database schema.
- **Impact:** The entire i18n/market-separation architecture is described but unimplemented. A developer cannot build the UK market launch because there's no mechanism to disable Points for UK, enable Stripe, or gate skills by locale.
- **Fix:**
  1. Add `feature_flags` object to each locale file (`locales/ng.json`, `locales/gb.json`, `locales/gh.json`) with keys: `ussd`, `nimc_kyc`, `mobile_money`, `stripe_paypal`, `points_enabled`, `skill_<id>_enabled`, `email_required`, etc.
  2. Add `available_locales` TEXT column to `skill_flows` table in `src/database.ts`.
  3. Create `src/services/featureFlags.ts` with `getFeatureFlag(country, flagName)` utility that reads from the locale file.
  4. Wire flag checks into the intent router, Points engine, and skill-flow lookup.
- **Spec:** §35 (developer note with 4-step implementation guide and code examples) · **Files:** `locales/*.json`, `src/database.ts`, `src/services/featureFlags.ts` (new), `src/services/intentRouter.ts`, `src/services/pointsEngine.ts`

**PA-4. Add Missing `escrow` Columns**
- **Finding:** C4 — HIGH
- **Status:** ❌ Not started
- **Problem:** The `escrow` table in `src/database.ts` has only: `id`, `buyer_phone`, `provider_phone`, `amount_minor`, `description`, `status`, `created_at`. The blueprint (§43) specifies `booking_type`, `cooling_off_until`, `completed_at`, `dispute_reason`.
- **Impact:** The Verified Artist Booking service needs `cooling_off_until` for the 24-hour cooling-off period, and `dispute_reason` for the dispute workflow.
- **Fix:** Add `ALTER TABLE escrow ADD COLUMN` statements for `booking_type TEXT`, `cooling_off_until TEXT`, `completed_at TEXT`, `dispute_reason TEXT` in the migration block.
- **Spec:** §43 (developer note with migration SQL) · **Files:** `src/database.ts`, `src/services/escrow.ts`

---

### 52.2. Near-Term — Needed for UK Launch (HIGH)

These items are needed before the UK market can launch. The technical specifications have been added to the blueprint (v5.52) as inline developer notes; the implementation work remains.

**PA-5. Build Cross-Border Payment Rail (Diaspora)**
- **Finding:** H2 — HIGH
- **Status:** ❌ Not started
- **Problem:** "Send Support Home" (§35.2.6) describes a diaspora user in London sending a service request to a provider in Lagos, with payment via Stripe into escrow and provider paid via OPay/Moniepoint. No payment rail, FX conversion, regulatory compliance, fee structure, or dispute resolution is implemented.
- **Fix:** Implement the cross-border architecture specified in §35.2.6.1: (a) Stripe UK → OPay/Moniepoint NG payment rail, (b) FX conversion at escrow creation (rate locked), (c) 3% cross-border coordination fee, (d) regulatory compliance approach (UK FCA + CBN), (e) dispute resolution flow with 14-day window.
- **Spec:** §35.2.6.1 · **Files:** new `src/services/crossBorderPayment.ts`, `src/services/escrow.ts`

**PA-6. Build UK External API Integrations**
- **Finding:** H3 — HIGH
- **Status:** ❌ Not started (stubs only — 60+ skills seeded in `skillFlows.ts`)
- **Problem:** UK life-admin skills (`bin_day`, `mot_reminder`, `council_tax`, `doctor_appointment`, `train_check`, etc.) are seeded as stubs but the actual fulfilment logic (querying external APIs) is not implemented.
- **Fix:** For each UK skill that queries an external API, implement the integration per the spec cards in §35.2.2.1: (a) API endpoint, (b) auth method, (c) request/response format, (d) error handling, (e) cache TTL, (f) fallback behaviour. Start with the 5 specified skills: `bin_day`, `mot_reminder`, `council_tax`, `doctor_appointment`, `train_check`.
- **Spec:** §35.2.2.1 · **Files:** `src/services/skillFlows.ts`, new `src/services/ukApiIntegrations.ts`

**PA-7. Resolve UK Points Contradiction in Code**
- **Finding:** M6 — MEDIUM
- **Status:** ❌ Not started (spec resolved in v5.52, implementation pending)
- **Problem:** §7.1 defines a UK Point value (£0.002 per Point), but §35 feature flags say `points_enabled` is NG/GH only (Points disabled for UK). The v5.52 developer note clarifies: Points are disabled for UK; the §7.1 value is forward-compatibility only. This clarification needs to be reflected in code.
- **Fix:** Ensure `getFeatureFlag('gb', 'points_enabled')` returns `false`. Ensure the Points engine and UI respect this flag (no Points display, no Points earning/spending for UK users).
- **Spec:** §7.1, §35 · **Files:** `src/services/featureFlags.ts`, `src/services/pointsEngine.ts`

**PA-8. Migrate Dev → Prod Stack (SQLite → PostgreSQL + Redis)**
- **Finding:** H4 — HIGH
- **Status:** ❌ Not started
- **Problem:** The codebase uses `sql.js` (SQLite compiled to WebAssembly). The blueprint's performance assumptions are based on PostgreSQL + Redis. There is zero Redis usage and zero PostgreSQL usage. The v5.52 developer note in §26 clarifies the dev vs. prod distinction with a migration table.
- **Fix:** Follow the §26 dev→prod migration plan: (a) add `pg` and `ioredis` to `package.json`, (b) create a database abstraction layer that switches between SQLite (dev) and PostgreSQL (prod) based on `NODE_ENV`, (c) implement `cacheGet`/`cacheSet`/`cacheInvalidate` in `src/cache.ts` using Redis in production, (d) replace GIST spatial index with PostgreSQL-equivalent in prod (bounding-box in dev — see CF-5).
- **Spec:** §26, §47 · **Files:** `src/database.ts`, `src/cache.ts`, `package.json`

**PA-18. Refactor `head.ejs` to Per-Page SEO Metadata**
- **Finding:** SEO audit (SEOptimer) — Usability F / On-Page A− — HIGH
- **Status:** ❌ Not started
- **Problem:** `views/_partials/head.ejs` hardcodes `<title>` ("Kurukoo — Wake up. Get going.") and `<meta name="description">` identically on every page; `<html lang="en">` is hardcoded despite `/gb/` and multilingual locales; no canonical, Open Graph, Twitter Card, JSON-LD, or hreflang tags exist. This duplicates title/description across all URLs (duplicate-content signal) and breaks locale targeting.
- **Fix:** (1) Refactor `head.ejs` to accept EJS locals (`title`, `description`, `canonical`, `ogType`, `ogImage`, `schemaJsonLd`, `robots`, `hreflang`, `lang`). (2) Wire every route to pass per-page values from `seo_pages` (§53.6), with sensible defaults. (3) Inject canonical, OG, Twitter Card, JSON-LD `<script type="application/ld+json">`, and hreflang `<link>` tags. (4) Set `<html lang>` dynamically per locale. (5) Add `og:image` defaults per country.
- **Spec:** §53.2.2, §32.6 · **Files:** `views/_partials/head.ejs`, all `views/*.ejs`, `src/index.ts` (route metadata)

**PA-19. Implement `robots.txt` + Multi-Sitemap Generation Pipeline**
- **Finding:** SEO audit (SEOptimer) — Links F — HIGH
- **Status:** ❌ Not started
- **Problem:** No `robots.txt` and no `sitemap.xml` exist anywhere in the project. Crawlers cannot discover the marketing site, Explore hub, 45 category pages, blog, or locale variants. This is the direct cause of the Links F grade.
- **Fix:** (1) Add env-aware `robots.txt` route (allow in prod, disallow staging/dev, reference sitemap). (2) Build a sitemap generation service producing a `sitemap.xml` index linking child sitemaps (`sitemap-pages.xml`, `sitemap-categories.xml`, `sitemap-locales.xml`, `sitemap-blog.xml`, `sitemap-programmatic.xml`). (3) Auto-regenerate on content/publish events; serve via `cacheGet()` (§47) with long TTL. (4) Add `<lastmod>`, `<changefreq>`, `<priority>` per URL class. (5) Submit to Google Search Console + Bing (§53.4).
- **Spec:** §53.2.1 · **Files:** new `src/services/seo/sitemap.ts`, `src/services/seo/robots.ts`, `src/index.ts`

---

### 52.3. Medium-Term — Needed for Scale (HIGH/MEDIUM)

These items are needed before the platform can scale beyond pilot. The technical specifications have been added to the blueprint (v5.52); implementation remains.

**PA-9. Build Living Memory Engine**
- **Finding:** H1 — HIGH
- **Status:** ❌ Not started
- **Problem:** The Living Memory Engine (§4.3) is fully specified in the blueprint (v5.52 added MMR algorithm pseudocode, decay formula, storage mapping, crystallize trigger, `ai_audit_log` schema) but has zero implementation. No MMR retrieval, no memory lifecycle cron, no `open_intentions` column, no `ai_audit_log` table, no Working Context inspector.
- **Fix:** Build in 4 phases per §4.3.6: (1) Bounded working context with MMR retrieval from `memory_profiles` and `messages` (token budgets: 1,024 FastText / 2,048 Groq), (2) memory lifecycle cron (decay, reinforcement, pruning, merge, crystallize), (3) open intentions integration with Opportunity Engine, (4) Working Context inspector admin panel. Create `ai_audit_log` table per §4.3.5 schema. Add `open_intentions` JSON column to `memory_profiles`.
- **Spec:** §4.3 (§4.3.2 MMR algorithm, §4.3.3 decay formula, §4.3.5 audit log schema, §4.3.6 implementation phases) · **Files:** new `src/services/memoryEngine.ts`, `src/database.ts`, `src/types.ts`

**PA-10. Implement Trust Score Formula**
- **Finding:** M1 — MEDIUM
- **Status:** ❌ Not started (`trust_score` column exists, `ratingService.ts` exists but uses simple average)
- **Problem:** The `trust_score` column exists (REAL DEFAULT 5.0) but the calculation is a simple average, not the multi-factor model specified in §15.1 (v5.52).
- **Fix:** Implement the trust score formula from §15.1:
  ```
  trust_score = base(5.0)
    + (avg_rating - 3.0) * 0.5        // max ±1.0
    + min(completed_jobs / 100, 1.0)   // max +1.0
    + verified_provider ? 0.5 : 0      // verification bonus
    - disputes * 0.2                   // dispute penalty
    + min(account_age_days / 365, 0.5) // max +0.5
  Range: [0.0, 8.0]
  ```
  Recalculate on a daily cron job. Store in `memory_profiles.trust_score`.
- **Spec:** §15.1 · **Files:** `src/services/ratingService.ts`, new `src/services/trustScore.ts`

**PA-11. Build Full WebRTC Implementation**
- **Finding:** M2 — MEDIUM
- **Status:** ❌ Not started (`webrtcSignalling.ts` is a 12-line stub)
- **Problem:** `webrtcSignalling.ts` is a basic in-memory `Map<string, string[]>` for room management. No SDP exchange, no ICE candidate handling, no data channels.
- **Fix:** Implement per §32.11 (v5.52 technical spec): (a) WebSocket signalling protocol, (b) STUN/TURN server configuration, (c) SDP offer/answer exchange, (d) ICE candidate handling, (e) data channel message format for IoT commands, (f) connection cleanup on disconnect.
- **Spec:** §32.11 · **Files:** `src/services/webrtcSignalling.ts`

**PA-12. Build Full IoT Bridge Implementation**
- **Finding:** M3 — MEDIUM
- **Status:** ❌ Not started (`iotBridge.ts` is a 19-line stub; `mqtt` dependency exists in `package.json`)
- **Problem:** `iotBridge.ts` is minimal. No MQTT broker connection, no device discovery, no command flow.
- **Fix:** Implement per §32.12 (v5.52 technical spec): (a) MQTT broker configuration, (b) device discovery protocol, (c) command message format, (d) state sync, (e) security (per-device auth, TLS).
- **Spec:** §32.12 · **Files:** `src/services/iotBridge.ts`

**PA-13. Create `config/blocklist.json`**
- **Finding:** M4 — MEDIUM
- **Status:** ❌ Not started (no `config/` directory exists)
- **Problem:** `complianceFilter.ts` exists but the Layer 1 blocklist file (`config/blocklist.json`) does not exist. The v5.52 developer note in §17 clarifies storage guidance.
- **Fix:** Create `config/blocklist.json` with initial regex patterns for prohibited content (fraud, illegal goods, hate speech). Wire `complianceFilter.ts` to load from this file. Alternatively, store in database (admin-managed) per §17 developer note.
- **Spec:** §17 · **Files:** `config/blocklist.json` (new), `src/services/complianceFilter.ts`

**PA-20. Build Programmatic SEO Engine + GEO/llms.txt**
- **Finding:** SEO gap — MEDIUM
- **Status:** ❌ Not started
- **Problem:** Kurukoo's discoverable surface is programmatic (3 countries × 45 categories × ~774 LGAs = thousands of rankable long-tail pages, plus provider profile pages). None are generated, and there is no `llms.txt` (Jeremy Howard 2024 standard) for AI inference-time crawlability or GEO optimization for Google AI Overviews / ChatGPT search / Perplexity.
- **Fix:** (1) Build template-driven landing-page generator (category × city/LGA × country) with AI-assisted unique copy via Groq through `lib/router.ts` (§21.2) and a human-review queue to prevent thin/duplicate content. (2) Generate public provider profile pages with `LocalBusiness` + `AggregateRating` schema. (3) Add `llms.txt` (root markdown: H1 title, blockquote summary, `## Docs`/`## Optional` link sections) and `.md` variants of key pages. (4) Implement GEO patterns (E-E-A-T, entity/sameAs, citable statistics/HowTo, structured data). (5) Respect crawl budget (priority/freq in sitemaps); AI generation behind Groq free-tier + hard quota (§49).
- **Spec:** §53.2.4, §53.2.5 · **Files:** new `src/services/seo/programmatic.ts`, `src/services/seo/geo.ts`, `src/services/seo/llmsTxt.ts`

---

### 52.4. Low Priority — Future Work (LOW)

These items are acknowledged gaps for future development. They do not block any current phase.

**PA-14. MCP Server Specification**
- **Finding:** L1 — LOW
- **Status:** ❌ Not started (alignment note only, reclassified to "Future" in v5.52)
- **Problem:** The blueprint mentions MCP (Model Context Protocol) as an alignment note but has no MCP protocol implementation, tool schemas, or server code.
- **Fix:** If MCP is desired, create a dedicated spec with tool schemas, transport, and auth model. Until then, this remains "Future" — not "Adopt Now."
- **Spec:** §4 note · **Files:** N/A (specification work first)

**PA-15. Kokoro-Engine Workflow Specification**
- **Finding:** L2 — LOW
- **Status:** ❌ Not started (alignment note only, reclassified to "Future" in v5.52)
- **Problem:** The blueprint mentions Kokoro-Engine workflows (composing tool calls into named, versioned workflows) but it's conceptual only. `skill_flows.question_set` JSON arrays are the seed but not generalized into workflow graphs.
- **Fix:** Create a dedicated technical spec if this pattern is desired. Until then, remains "Future."
- **Spec:** §4 note · **Files:** N/A (specification work first)

**PA-16. Complete Notification Delivery Confirmation Loop**
- **Finding:** L3 — LOW
- **Status:** ⚠️ Partially implemented
- **Problem:** `pushNotifications.ts` exists but the delivery confirmation loop (§13.3) needs verification. The spec says every critical push has a unique `event_id`, PWA service worker sends `POST /api/push/confirm/{eventId}`, with a 90-second fallback.
- **Fix:** Verify the `/api/push/confirm/{eventId}` endpoint exists and works. Verify the 90-second fallback timeout logic. Add logging for unconfirmed deliveries.
- **Spec:** §13.3 · **Files:** `src/services/pushNotifications.ts`, PWA service worker

**PA-17. Implement Catalog Scraper**
- **Finding:** M7 — MEDIUM
- **Status:** ❌ Not started
- **Problem:** The blueprint (§9) describes a background job using Groq/FastText pipeline to extract products from WhatsApp Business catalogue URLs, stored in `skills.business_products` (JSON array). No URL fetching, no product extraction. `skills` table has no `business_products` column.
- **Fix:** (1) Add `business_products` TEXT column to `skills` table. (2) Implement the scraper as a background cron job that fetches catalogue URLs, extracts product names/prices using Groq, and stores results. (3) Integrate with the Agent Network soft-claim merge flow.
- **Spec:** §9 · **Files:** new `src/services/catalogScraper.ts`, `src/database.ts`

---

### 52.5. Consistency Fixes

These are minor inconsistencies between the blueprint, code, and supporting files that should be resolved alongside the priority items above.

| ID | Finding | Issue | Fix | Files | Status |
|----|---------|-------|-----|-------|--------|
| CF-1 | X1 | Package version mismatch: `package.json` says `5.38.0`, blueprint title says `v5.53` | Update `package.json` version to match blueprint | `package.json` | ❌ |
| CF-2 | X2 | `types.ts` `MemoryProfile` interface has 9 fields vs. 25+ in blueprint | Expand interface to match §2.1 schema (resolved by PA-2) | `src/types.ts` | ❌ |
| CF-3 | X3 | `tradeEngine.ts` calls `addCredits()` (old name) instead of `addPoints()` | Replace with `addPoints()` (resolved by PA-1) | `src/services/tradeEngine.ts` | ❌ |
| CF-4 | M5 | §8 subscription tier table has broken separator row (`\|------\|----------\|------------_-----\|`) | Correct underscore to dash (resolved in v5.52) | `BLUEPRINT.md` §8 | ✅ |
| CF-5 | H5 | §5 `provider_presence` uses PostgreSQL GIST spatial index; SQLite doesn't support GIST | Use bounding-box lat/lng range queries in SQLite dev (resolved in v5.52 developer note) | `src/database.ts`, `src/services/nearbyPulse.ts` | ✅ |

---

### 52.6. Definition of Done

An action item is considered complete when:

1. **Code change implemented and committed** — the fix described in the item's "Fix" section is fully implemented in the referenced files.
2. **TypeScript compilation passes** — `npx tsc --noEmit` exits with 0 errors (strict mode, NodeNext ESM).
3. **All existing E2E tests pass** — `npx tsx tests/run-blueprint.ts` shows 100/100 passing.
4. **New tests written** (where applicable) — unit or integration tests covering the new functionality.
5. **§52 summary table updated** — the item's status marker changed from ❌ to ✅ with the completion date noted.
6. **§50 implementation status updated** — the relevant entry in "Current Implementation Status" (§50) is updated to reflect the new status (⚠️ → ✅ or ❌ → ✅/⚠️).

---

## 53. SEO Management System

> **Developer note:** This section was added in v5.54 after a SEOptimer audit of `utilityapp.ai.studio` returned an overall **B** with **Usability F** and **Links F**, driven by a shared `head.ejs` that hardcodes identical title/description/lang on every page and the complete absence of `robots.txt`, `sitemap.xml`, canonical, Open Graph, Twitter Card, JSON-LD, and hreflang tags. SEO had previously been explicitly out of scope ("voice/USSD/app-first, not a discoverable website"); the public marketing site (`/`, `/explore/[slug]`, `/blog`, `/gb/`) is now a real discoverable surface that requires a managed, audited, AI-assisted SEO control plane. This system lives in the Admin Console (§38) and covers all SEO needs for the ecosystem in 2026/2027, including Generative Engine Optimization (GEO) for AI Overviews / answer engines.

### 53.1 Scope & Surface Inventory

The SEO Management System governs **only the crawlable, public web surface**. The PWA (single-screen chat), `/admin/*`, `/api/*`, `/webhook/*`, and `/ussd` routes are explicitly excluded (already served `no-store`).

**Managed surfaces:**
- Marketing homepage and locale variants: `/`, `/ng/`, `/gh/`, `/gb/`.
- Explore Hub: `/explore` + 45 category pages `/explore/[slug]`.
- Programmatic landing pages: `/[country]/[category]/[city-or-lga]` (generated, §53.2.4).
- Public provider profile pages: `/p/[provider-slug]` (generated, LocalBusiness schema).
- Content: `/blog/[post]`, `/help/[article]`, `/legal/[doc]`, `/about`, `/pricing`, `/careers`, `/contact`, `/api/docs`.

**Excluded surfaces:** PWA dashboard, all `/api/*`, `/admin/*`, `/webhook/*`, `/ussd`, in-app chat.

### 53.2 The Five-Layer SEO Model

#### 53.2.1 Technical SEO Infrastructure

- **`robots.txt` (env-aware, admin-editable):** Allow all in production; `Disallow: /` on staging/dev; reference the sitemap index. Served from `seo_settings` (§53.6) so changes need no deploy. Rules validated before save.
- **Sitemap pipeline:** A `sitemap.xml` **index** links child sitemaps by URL class: `sitemap-pages.xml` (static marketing + locale), `sitemap-categories.xml` (45 categories × locales), `sitemap-blog.xml` (CMS posts), `sitemap-programmatic.xml` (city/LGA + provider pages). Each URL carries `<lastmod>` (from content updatedAt), `<changefreq>` (per class), and `<priority>` (homepage 1.0, category 0.8, blog 0.6, programmatic 0.5). Auto-regenerated on publish/content-change events; served via `cacheGet()` (§47) with a long TTL and `Cache-Control: public, max-age=3600`.
- **Canonical URL management:** Every managed page emits `<link rel="canonical">`. Defaults to the page's own absolute URL; overridable per page in `seo_pages` to consolidate duplicates and the locale-variant set. Self-referential canonical is the default; cross-locale variants use hreflang (below), not canonical.
- **hreflang / international targeting:** Emit the full locale alternates set with `hreflang="en-NG"`, `hreflang="en-GB"`, `hreflang="en-GH"`, plus `ha`, `yo`, `ig`, `pcm` variants where content exists, and `hreflang="x-default"` pointing to `/`. The `<html lang>` attribute is set dynamically per page (fixes the current hardcoded `en`).
- **301/302 redirect manager + 404 monitor:** Admin-editable redirect rules (`seo_redirects`, §53.6) applied as middleware before route matching; regex and exact-path support. 404s are logged from request logs + Search Console coverage reports and surfaced in the dashboard with one-click "create redirect" or "mark as ignore".
- **`llms.txt` (Jeremy Howard 2024 standard):** A root-level `/llms.txt` markdown file (H1 project title, blockquote one-line summary, `## Docs` / `## Examples` / `## Optional` sections with markdown links and one-line descriptions) giving LLMs a concise, inference-time entry point. Key pages additionally expose a clean `.md` variant at the same URL with `.md` appended (e.g. `/explore/plumbing.md`). Auto-generated from the sitemap + page summaries; distinct from `sitemap.xml` (which lists human-crawlable URLs) — `llms.txt` curates the LLM-readable subset. Admin-editable with a preview.

#### 53.2.2 On-Page SEO (Per-Page Metadata)

- **Per-page metadata from `seo_pages` (§53.6):** `title` (≤60 chars), `meta_description` (≤155 chars), `slug`, `canonical`, `robots_directive` (`index,follow` default; `noindex` for thin/transitional pages), `og_title`, `og_description`, `og_image`, `twitter_card` type. Fallbacks computed from page content + brand when a row is absent. All editable in the Admin Console with no deploy.
- **SERP preview widget:** Live Google/Bing SERP preview with title/description truncation and pixel-width checks, shown beside each field in the admin editor.
- **Target keyword field + audit:** Each page may declare a `target_keyword`; the audit reports presence/position in title, H1, URL slug, first paragraph, and density. Multi-keyword support for locale variants.
- **Heading-structure audit:** Validates exactly one `<h1>` per page, logical H2→H6 nesting, no skipped levels, and keyword presence in H1/H2. **NEW (v5.56): Heading length checks** — H1 ≤60 chars, H2 ≤70 chars, H3 ≤60 chars, H4–H6 ≤50 chars. Over-length headings are flagged individually in the per-page health panel. Headings must be descriptive and natural, not keyword-stuffed (keyword stuffing in headings is a negative signal per Google's helpful content guidance).
- **Image alt-text manager + auto-generation + optimization:** Audit all images for missing/empty `alt`; bulk-edit alt text in admin. **NEW (v5.55): Auto-generation via Groq** — when an image is uploaded or found with missing/empty `alt`, the system automatically generates: (a) descriptive `alt` text (accessibility-focused, max 125 chars), (b) SEO-friendly filename (kebab-case, keyword-rich, e.g., `plumber-fixing-leak-lagos.jpg`), (c) `title` attribute (longer descriptive title for hover/SEO), (d) `meta` description (for Open Graph/structured data), (e) keywords (JSON array, 3-7 keywords for schema.org/Article keywords field). All auto-generated via Groq through `lib/router.ts` with a hard daily quota (§49 cost discipline). Human review queue in admin for auto-generated metadata before publish. Serve images as WebP/AVIF with responsive `srcset` and `loading="lazy"` (aligns with the Agent Decision Rules `next/image` rule). This remediates the Usability F mobile/alt findings and ensures no image ever has missing metadata.
- **Internal linking manager:** Detect orphan pages (zero inbound internal links), suggest contextual anchor-text links from related pages, and visualize the internal link graph. Managed links are tracked in `seo_internal_links` (§53.6). Targets the Links F finding.

#### 53.2.2.1 FAQ Content System (Visible FAQ Text + FAQPage Schema)

> **Developer note:** FAQ sections are one of the highest-impact on-page SEO levers for 2026. Google restricted FAQ rich results in 2023 to government/health authority sites, BUT FAQPage schema + visible FAQ text still drive: (a) **AI Overviews / answer-engine citations** — LLMs extract FAQ Q&A pairs as citable snippets (GEO, §53.2.5); (b) **Bing rich results** — Bing still shows FAQ rich results broadly; (c) **long-tail keyword capture** — each FAQ question targets a specific question-query the main page content may not rank for; (d) **dwell time / engagement** — visible FAQ blocks reduce bounce. Backlinko, Ahrefs, and Search Atlas all identify visible FAQ text + FAQPage schema as a top-5 on-page factor. **Both parts are mandatory — FAQ must exist as BOTH visible HTML text AND structured data.**

**Two-part requirement:**

1. **Visible FAQ text block on the page:** Each category page (`/explore/[slug]`), programmatic landing page (`/[country]/[category]/[city]`), provider profile page (`/p/[slug]`), and blog post (`/blog/[post]`) includes a visible FAQ section (3–8 Q&A pairs) rendered as HTML `<section>` with `<h2>Frequently Asked Questions</h2>` and `<details>`/`<summary>` accordion elements. Questions and answers are visible to users (not hidden) and indexable by crawlers. Google's guidance: FAQ content must be visible on the page for the schema to be valid.

2. **FAQPage JSON-LD schema (§53.2.3):** The same Q&A pairs are emitted as `<script type="application/ld+json">` with `@type: "FAQPage"` containing `mainEntity` array of `Question` → `Answer` objects. Already listed in §53.2.3 supported types; this section specifies the content generation and management.

**FAQ content generation:**
- **Auto-generation via Groq (via `lib/router.ts`):** For each category/programmatic/provider page, the system auto-generates 3–8 FAQ Q&A pairs based on: category/skill name, target location (city/LGA), common user questions (from anonymized `messages` intent analysis), and competitor FAQ analysis (top-ranking pages for the target keyword). Daily quota enforced (§49).
- **Human review queue:** Auto-generated FAQs go to an admin review queue before publish. Admin can edit, reject, or approve. Approved FAQs stored in `seo_faq_entries` (§53.6).
- **Per-page FAQ management:** Admin Pages Manager (§53.5) includes an FAQ editor per page: add/edit/delete Q&A pairs, reorder, toggle visibility. Changes update both the visible HTML and the JSON-LD in one action.
- **FAQ templates by page type:** Category page (e.g., "How do I find a [skill] in [city]?", "How much does [service] cost in [city]?", "Are [skill] providers on Kurukoo verified?"); Provider page (e.g., "Is [provider] verified?", "What services does [provider] offer?", "How do I book [provider]?"); Programmatic page (e.g., "Best [skill] in [city]?", "[skill] prices in [city]?", "How to hire a [skill] in [city]?").
- **FAQ ranking strategy:** Each FAQ question targets a specific long-tail query (e.g., "how much does a plumber cost in Ibadan" → FAQ: "How much does a plumber cost in Ibadan?"). The answer is 40–60 words, includes the target keyword naturally, and links internally to the category page or a relevant blog post. This captures question-based searches the main page content might not rank for.

#### 53.2.3 Structured Data (Schema.org / JSON-LD)

- **Centralized schema config + per-page injection:** A `seo_schema_templates` table (§53.6) holds reusable JSON-LD templates; pages compose one or more. Injected as `<script type="application/ld+json">` in `<head>` by the refactored `head.ejs` (PA-18).
- **Supported types:** `Organization` (site-wide, with `sameAs` → social/Wikidata), `WebSite` (with `potentialAction` SearchAction), `Service`, `BreadcrumbList` (auto-built from the route hierarchy), `FAQPage` (from help/CMS), `Article` (blog), `Product` (marketplace listings), `LocalBusiness` + `AggregateRating` + `Review` (provider profile pages), `HowTo` (guide content). Locale-aware where applicable.
- **Rich-results validation:** Admin "Test in Google" button calls the Rich Results Test API on the live URL; results (errors/warnings) cached and shown inline. Blocks publish on hard errors.

#### 53.2.4 Programmatic SEO (The Scale Engine)

- **Template-driven landing pages:** Generate `/[country]/[category]/[city-or-lga]` from the skills taxonomy (§16) × `provider_presence` LGAs × `memory_profiles.country`. Each page pulls live trust signals (verified provider count, completed jobs, avg rating) — the same data the Explore hub uses — so content is unique and dynamic, not thin boilerplate.
- **AI-assisted unique copy:** For each generated page, Groq (via `lib/router.ts`, §21.2 — never direct) produces a unique intro, FAQ, and local-context paragraph seeded from the category + location, to avoid duplicate/thin content across the matrix. All drafts enter a **human-review queue** before publish. Generation is batched, off-peak, behind a hard quota with auto-pause (§49).
- **Provider profile pages:** Public `/p/[provider-slug]` pages for verified providers, with `LocalBusiness` + `AggregateRating` schema, service list, service area, and a nofollow chat CTA (keeps link equity on the marketing site). Opt-out per provider; never exposes PII (masked per §41).
- **Crawl-budget controls:** Programmatic URLs carry lower `<priority>` and longer `<changefreq>` in `sitemap-programmatic.xml`; a daily cap on newly-exposed pages prevents crawl-budget shock. A toggle pauses generation per country/category.

#### 53.2.5 Generative Engine Optimization (GEO / AI Overviews — 2026/2027)

> **Developer note:** GEO targets citation/visibility in Google AI Overviews, ChatGPT search, and Perplexity, which increasingly answer user questions with synthesized text + citations rather than ten blue links. Traditional on-page SEO (§53.2.1–§53.2.2) remains necessary but is no longer sufficient.

- **E-E-A-T signals:** Author/organization entity, credentials, citations/references, and explicit `datePublished`/`dateModified` on all content. Provider pages surface real completed-job counts and verification status (trust, not claims).
- **Entity + knowledge-graph optimization:** Consistent `sameAs` links to Wikidata, Google Business Profile, and social; named entities for categories, cities, and skills so AI engines can ground Kurukoo in their knowledge graph.
- **Citable content patterns:** Statistics (e.g. "X verified plumbers in Ibadan"), clear definitions, step-by-step `HowTo` with structured data, comparison tables, and sourced quotes with visible references — the patterns the Princeton/IIT GEO research and Google's guidance identify as most likely to be quoted by generative models.
- **`llms.txt` as the LLM entry point:** The `/llms.txt` file (§53.2.1) and `.md` page variants are the primary lever for being correctly summarized by LLMs at inference time; the admin tooling generates and keeps them in sync with the canonical content.

#### 53.2.6 Content & Blog Engine (Topical Authority + Publishing Cadence)

> **Developer note:** Regular new content is a top-5 SEO factor per Backlinko, Ahrefs, and Search Atlas. Google's Gary Illyes: "Don't create low-quality and no-value-add pages." The blog system must produce consistent, high-quality, topically-clustered content — not random posts. Search Atlas's "Content Genius" and "Topical Maps" features inform this design.

**Topical authority model (pillar + cluster):**
- **Pillar pages:** Comprehensive, long-form (2,000–4,000 words) pages targeting a broad category keyword (e.g., "Plumbing Services in Nigeria", "Car Repair in Lagos"). These are the `explore/[slug]` category pages (§53.1) — already the highest-authority pages on the site.
- **Cluster content (blog posts):** Each pillar page has 8–15 supporting blog posts targeting long-tail subtopics (e.g., "How to Fix a Leaking Tap", "Cost of Replacing a Bathroom Pipe in Lagos", "Signs You Need a Plumber vs DIY"). Each cluster post internally links to the pillar page and to 2–3 other cluster posts (topical mesh).
- **Topical map:** Admin tool visualizes the pillar→cluster structure as a tree, showing which clusters are published, which are gaps, and internal link density. Search Atlas's "Topical Maps" feature is the reference pattern.

**Content calendar + publishing cadence:**
- **Target cadence:** 2–4 blog posts per week (8–16/month) across all categories, rotated to cover all 45 categories over a quarter.
- **Content calendar (`seo_content_calendar` table, §53.6):** Scheduled posts with: target keyword, target pillar page, planned publish date, status (`idea` → `briefed` → `drafting` → `review` → `scheduled` → `published`), assigned writer, content score.
- **AI-assisted drafting (Groq via `lib/router.ts`):** Given a content brief, Groq generates a first draft (1,500–3,000 words) with suggested headings, FAQ section, internal links, and meta. Daily quota enforced (§49). **All drafts go through human review before publish** — no fully-automated publishing (quality gate per Google's helpful content guidance).
- **Content briefs (`seo_content_briefs`, §53.6):** Each brief includes: target keyword, search intent (informational/transactional/navigational), recommended word count (based on top-10 ranking pages), suggested H2/H3 outline, focus terms (related/LSI keywords), internal link targets, FAQ questions to include, and competitor URLs to differentiate from.

**Content freshness & relaunch:**
- **Stale content detection:** The audit cron (§53.4) flags blog posts older than 6 months with declining traffic (from Search Console data). Candidates for update + relaunch.
- **Update & relaunch workflow:** Admin selects a stale post → Groq generates an updated draft with new information, updated screenshots, new internal links → review → publish with updated `dateModified` → re-submit to Search Console index. Backlinko reports this "update + relaunch" pattern can increase traffic to a post by 260%+.

**Content gap analysis:**
- **Keyword gap tool:** Admin enters a competitor URL → system queries `seo_keywords` for keywords the competitor ranks for but Kurukoo doesn't → prioritized content gap list with search volume and difficulty.
- **SERP gap analysis:** For each target keyword, the system analyzes the top-10 ranking pages and identifies content features they have that Kurukoo's page lacks (e.g., "competitor has a video", "competitor has 15 FAQs, you have 3", "competitor's page is 2,500 words, yours is 800").

**Content scoring (Search Atlas "Content Genius" pattern):**
- Each draft is scored 0–100 on: keyword presence/position, word count vs target, heading structure, FAQ inclusion, internal links, readability (Flesch reading ease), E-E-A-T signals (author, citations, dates). Score shown in the editor with specific improvement suggestions. **Target: ≥70 before publish.**

#### 53.2.7 The 30-Point SEO Audit Checklist (Consolidated)

> **Developer note:** This checklist consolidates all SEO optimization points from Backlinko, Ahrefs, and Search Atlas into a single auditable list. The automated crawl + audit cron (§53.4) checks every managed URL against these 30 points and writes results to `seo_audit_runs`. Each point maps to a `check` name. This is the "always-on SEOptimer/Search Atlas" for the Kurukoo ecosystem.

**Technical SEO (10 points):**

| # | Check | Target | Spec |
|---|-------|--------|------|
| 1 | `robots_txt` | Production: allow all; staging: disallow; references sitemap | §53.2.1 |
| 2 | `sitemap_index` | `/sitemap.xml` returns 200 with valid XML index + child sitemaps | §53.2.1 |
| 3 | `canonical` | `<link rel="canonical">` present on every page; self-referential default | §53.2.1 |
| 4 | `hreflang` | All locale variants + `x-default`; `<html lang>` dynamic | §53.2.1 |
| 5 | `redirects_404` | No broken internal links hitting 404; redirect rules active | §53.2.1 |
| 6 | `llms_txt` | `/llms.txt` reachable; key pages have `.md` variant | §53.2.1 |
| 7 | `core_web_vitals` | LCP < 2.5s, CLS < 0.1, INP < 200ms (mobile + desktop) | §53.4 |
| 8 | `mobile_responsive` | 360px viewport passes; 44px touch targets; no horizontal scroll | §32.6 |
| 9 | `https_ssl` | All URLs `https://`; no mixed content; valid SSL cert | — |
| 10 | `sitemap_submitted` | Search Console + Bing API connected; coverage > 90% | §53.4 |

**On-Page SEO (12 points):**

| # | Check | Target | Spec |
|---|-------|--------|------|
| 11 | `title_length` | ≤60 chars; keyword in first 30 chars; unique per page | §53.2.2 |
| 12 | `meta_description_length` | ≤155 chars; compelling; includes keyword; unique per page | §53.2.2 |
| 13 | `single_h1` | Exactly one `<h1>`; contains target keyword | §53.2.2 |
| 14 | `heading_hierarchy` | H1→H6 nesting valid; no skipped levels (no H2→H4) | §53.2.2 |
| 15 | `heading_length` | H1 ≤60; H2 ≤70; H3 ≤60; H4–H6 ≤50; descriptive not stuffed | §53.2.2 (v5.56) |
| 16 | `url_slug` | ≤75 chars; kebab-case; keyword-rich; lowercase; no stop words | §53.2.2 |
| 17 | `image_alt` | All `<img>` have non-empty `alt`; keyword-aware where relevant | §53.2.2 |
| 18 | `image_filename` | Kebab-case, keyword-rich (e.g., `plumber-fixing-leak-lagos.webp`) | §53.2.2 |
| 19 | `image_format` | WebP/AVIF; `loading="lazy"`; `width`/`height`; `srcset` responsive | §32.6 |
| 20 | `internal_links` | No orphan pages; contextual anchor text (not "click here"); ≥3 per page | §53.2.2 |
| 21 | `keyword_first_para` | Target keyword appears in first 100 words / first paragraph | §53.2.2 |
| 22 | `content_length` | Category 1,500+; blog 1,500–3,000; provider 500+; programmatic 800+ | §53.2.6 (v5.56) |

**Content SEO (8 points):**

| # | Check | Target | Spec |
|---|-------|--------|------|
| 23 | `faq_visible_schema` | 3–8 FAQ Q&A visible on page + FAQPage JSON-LD | §53.2.2.1 (v5.56) |
| 24 | `regular_new_content` | 2–4 blog posts/week; topical cluster strategy | §53.2.6 (v5.56) |
| 25 | `topical_authority` | Each category has pillar page + 8–15 cluster posts | §53.2.6 (v5.56) |
| 26 | `content_calendar` | Scheduled posts in `seo_content_calendar`; no gaps > 2 weeks | §53.2.6 (v5.56) |
| 27 | `content_briefs` | Each post has brief with keyword, word count, outline, focus terms, FAQs | §53.2.6 (v5.56) |
| 28 | `content_freshness` | Posts < 12 months old or updated; stale posts flagged for relaunch | §53.2.6 (v5.56) |
| 29 | `content_gap_analysis` | Quarterly gap report vs competitors; gaps prioritized in calendar | §53.2.6 (v5.56) |
| 30 | `eeat_signals` | Author entity; `datePublished`/`dateModified`; citations; credentials; `sameAs` | §53.2.5 |

**Scoring:** Each point is pass (1) / warn (0.5) / fail (0). The SEO Health Score (§53.4) is computed as `(total ÷ 30) × 100` → A (90+), B (80+), C (70+), D (60+), F (<60). The dashboard shows the per-point breakdown so admins know exactly which checks are failing.

### 53.3 International & Multilingual SEO

- **Country sitemaps:** One child sitemap per country (`sitemap-ng.xml`, `sitemap-gb.xml`, `sitemap-gh.xml`) under the index, with locale-appropriate `<lastmod>`.
- **hreflang matrix:** Maintained in admin; surfaces missing-translation gaps (e.g. a category page published for `/ng/` but not `/gb/`).
- **Locale keyword strategy:** Each locale carries its own keyword set and SERP competition notes; the rank tracker (§53.4) reports per-locale.
- **Compliance:** Any SEO tracking that sets cookies or collects analytics (Search Console auth, rank-checker probes) is opt-in and gated by locale — **NDPR (Nigeria)** and **UK-GDPR (GB)**. No PII is stored in any SEO table (§53.6); provider pages never expose phone numbers (masked per §41).

### 53.4 Monitoring, Reporting & Integrations

- **Google Search Console API:** Index coverage, top queries, pages, impressions, CTR, and click-through; pulled on a schedule and stored in `seo_rankings`/`seo_audit_runs` (§53.6).
- **Bing Webmaster API:** Parallel coverage and query data for Bing + Bing-powered engines.
- **Keyword rank tracker:** Daily, geo-scoped per country (NG/GB/GH) and per locale; stores rank, URL, search-volume estimate, and delta.
- **Backlink monitor:** New/lost backlinks, referring domains, and anchor text; flagged in the dashboard.
- **Core Web Vitals dashboard:** Field + lab data for **LCP, CLS, and INP** (INP replaced FID as a Core Web Vital in March 2024). Per-URL, with mobile vs desktop split and pass/fail against the §1.4 budgets (LCP < 2.5s, CLS < 0.1, INP < 200ms).
- **SEO Health Score:** A single A–F grade recomputed on a schedule (mirrors the SEOptimer grade shape) across technical, on-page, links, usability, and performance sub-scores; trended over time. This is the "always-on SEOptimer" for the whole ecosystem.
- **Automated crawl + audit cron:** A scheduled crawler audits every managed URL against the 30-Point SEO Audit Checklist (§53.2.7) — metadata presence/length, heading structure + length, canonical, schema validity, hreflang completeness, image alt, internal links, FAQ presence, content length, Core Web Vitals — and writes results to `seo_audit_runs`. **NEW (v5.56):** Also flags stale content (posts > 6 months with declining traffic) and orphan pages (zero inbound links). Runs off-peak; failures do not block serving.

### 53.5 Admin Console UI

Lives in the existing Admin Console (§38), new "SEO" section with role-gated access (admin/SEO manager):

- **SEO Dashboard:** Health score + sub-scores, top issues, indexed page count, top queries/CTR, Core Web Vitals summary, recent audit runs.
- **Pages Manager:** Table of all managed URLs with inline per-page SEO editor (title, description, slug, canonical, robots, OG, target keyword, schema) + SERP preview + per-page health panel.
- **Schema Manager:** Reusable JSON-LD templates, per-page schema assignment, Rich Results Test integration.
- **Redirect Manager:** 301/302 rules + 404 log with one-click redirect creation.
- **Sitemap & robots.txt Editor:** View/regenerate child sitemaps, edit `robots.txt` and `llms.txt` with preview + validation.
- **Keyword Research & Rank Tracker:** Keyword ideas (volume/difficulty), tracked keywords with daily rank + SERP features, per-locale.
- **Backlink Monitor:** New/lost links, referring domains, anchor text.
- **Content / AI SEO Generator:** Keyword → content brief → Groq draft (via router) → review queue → publish to CMS with auto-generated metadata + schema. **NEW (v5.56):** Includes content scoring (0–100), content calendar view, and topical map visualization.
- **FAQ Manager (NEW v5.56):** Per-page FAQ editor — add/edit/delete Q&A pairs, reorder, toggle visibility, auto-generate via Groq with review queue. Updates both visible HTML and FAQPage JSON-LD in one action.
- **Content Calendar (NEW v5.56):** Monthly calendar view of scheduled posts, status pipeline (idea → briefed → drafting → review → scheduled → published), content gap report, stale content alerts.
- **Topical Map (NEW v5.56):** Tree visualization of pillar → cluster content structure, showing published vs gap clusters and internal link density.
- **Search Console / Bing Settings:** OAuth connection management, property selection, sync status.

### 53.6 Data Model (New Tables)

All admin-editable, no deploy required (matches the §38 pattern). Stored in the primary database (PostgreSQL in prod / SQLite in dev per §26).

- **`seo_pages`** — per-URL overrides: `url_path`, `locale`, `title`, `meta_description`, `slug`, `canonical`, `robots_directive`, `og_title`, `og_description`, `og_image`, `twitter_card`, `target_keyword`, `schema_template_ids` (JSON array), `hreflang_overrides` (JSON), `updated_at`, `updated_by`.
- **`seo_redirects`** — `from_pattern`, `to_url`, `status_code` (301/302), `is_regex`, `created_at`.
- **`seo_keywords`** — `keyword`, `locale`, `country`, `search_volume`, `difficulty`, `tracked` (bool).
- **`seo_rankings`** — `keyword_id`, `url_path`, `rank`, `serp_features` (JSON), `checked_at`.
- **`seo_backlinks`** — `source_url`, `target_url`, `anchor_text`, `first_seen`, `last_seen`, `status` (active/lost).
- **`seo_schema_templates`** — `id`, `name`, `type` (schema.org type), `template` (JSON), `applies_to` (URL pattern).
- **`seo_audit_runs`** — `run_id`, `url_path`, `check`, `status` (pass/warn/fail), `detail` (JSON), `run_at`.
- **`seo_settings`** — singleton row: `robots_txt`, `llms_txt`, `default_og_image_ng`, `default_og_image_gb`, `default_og_image_gh`, `search_console_property`, `bing_property`, `cwv_budgets` (JSON), `health_score` (cached), `updated_at`.
- **`seo_faq_entries`** (NEW v5.56) — `page_url_path`, `question`, `answer`, `display_order` (int), `is_visible` (bool), `auto_generated` (bool), `review_status` (`pending`|`approved`|`rejected`), `created_at`, `updated_at`.
- **`seo_content_calendar`** (NEW v5.56) — `id`, `target_keyword`, `target_pillar_url`, `cluster_title`, `planned_publish_date`, `status` (`idea`|`briefed`|`drafting`|`review`|`scheduled`|`published`), `assigned_to`, `content_score` (int 0-100), `published_url`, `created_at`, `updated_at`.
- **`seo_content_briefs`** (NEW v5.56) — `id`, `target_keyword`, `search_intent`, `recommended_word_count` (int), `outline` (JSON: H2/H3 array), `focus_terms` (JSON array), `internal_link_targets` (JSON array), `faq_questions` (JSON array), `competitor_urls` (JSON array), `created_at`.
- **`seo_internal_links`** (NEW v5.56) — `source_url`, `target_url`, `anchor_text`, `link_type` (`contextual`|`navigation`|`footer`), `created_at`. Tracks managed internal links for the link graph visualization and orphan-page detection.

### 53.7 Performance, Cost & Governance Notes

- **Caching:** Sitemaps, `robots.txt`, `llms.txt`, and the health score are served via `cacheGet()` (§47) with long TTLs; invalidated on the publish/content-change events that regenerate them. Never cached for `/api/*`/`/admin/*` (already `no-store`).
- **Cost discipline (§49):** AI content/SEO generation goes through Groq free-tier via `lib/router.ts` with a hard daily quota and auto-pause on threshold; batched off-peak. Audit crawl is rate-limited and off-peak. Search Console/Bing API pulls are scheduled, not per-request.
- **Tight Integration Mandate (§1.4):** all SEO data reads/writes go through the existing database + cache layers; AI generation goes through the router; no new analytics vendors beyond Google Search Console + Bing; no PII in any SEO table; provider pages obey §41 masking; content obeys §17 blocklist.
- **No new npm packages without approval** (Agent Decision Rules §15). Likely candidates to propose: a sitemap builder, a structured-data validator, a Search Console client — each to be approved before addition.
- **Definition of Done:** sitemap + robots reachable in prod; every managed URL has unique title/description + canonical + hreflang; schema validates with zero hard errors; Core Web Vitals pass budgets on key templates; Health Score ≥ A− sustained.

---

## 54. National Events & Cultural Calendar System (v5.55)

> **Developer note (v5.55):** This section was added to address the need for all national days, festivals, and key events across Nigeria, Ghana, and the UK to be catered for with reminders for all users. Previously, only UK life-admin skills had "calendar reminders" (§35.2). This system adds a dedicated AI agent and reminder infrastructure for cultural events across all markets.

### 54.1 Scope

All national public holidays, religious festivals, cultural events, and major sporting/entertainment events across the three launch markets:

- **Nigeria:** Independence Day (Oct 1), Democracy Day (June 12), Workers' Day (May 1), Eid al-Fitr, Eid al-Adha, Christmas, Easter, New Year's Day, Boxing Day (Dec 26), New Yam Festival (variable), Lagos Carnival, Calabar Carnival (Dec), Ojude Oba Festival, Argungu Fishing Festival, Eyo Festival, Osun Osogbo Festival
- **Ghana:** Independence Day (March 6), Republic Day (July 1), Workers' Day (May 1), Eid al-Fitr, Eid al-Adha, Christmas, Easter, Homowo Festival, Aboakyir Festival, Panafest, Bakatue Festival, Hogbetsotso Festival
- **UK:** New Year's Day, Good Friday, Easter Monday, May Day (first Monday May), Spring Bank Holiday (last Monday May), Summer Bank Holiday (last Monday Aug), Christmas Day, Boxing Day (Dec 26), Bonfire Night (Nov 5), St George's Day (April 23, England), St Andrew's Day (Nov 30, Scotland), Burns Night (Jan 25), Diwali (variable), Eid celebrations (variable), Notting Hill Carnival (Aug), Chinese New Year (variable)

### 54.2 Data Model

New `national_events` table:
```sql
CREATE TABLE national_events (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,           -- 'ng' | 'gh' | 'gb'
  name TEXT NOT NULL,              -- 'Independence Day'
  type TEXT NOT NULL,              -- 'public_holiday' | 'religious' | 'cultural' | 'festival' | 'sporting'
  date TEXT,                       -- ISO date for fixed events: '2026-10-01'
  date_rule TEXT,                  -- For variable events: 'easter_minus_2' | 'lunar_eid' | 'second_monday_october'
  description TEXT,
  image_url TEXT,
  is_recurring BOOLEAN DEFAULT true,
  locale_relevance TEXT,           -- JSON array: ["en", "ha", "yo", "ig", "pcm"] or ["en-GB"]
  suggested_skills TEXT,           -- JSON array of skill tags relevant to event: ["event_planner", "caterer", "decorator"]
  created_at TEXT,
  updated_at TEXT
);
```

Events with `date_rule` are recalculated annually by the Cultural Calendar AI Agent. Lunar events (Eid) use a lookup table updated yearly from public sources.

### 54.3 Cultural Calendar AI Agent

A dedicated AI agent (managed via §38 AI Agent Management) with the following responsibilities:

1. **Calendar maintenance** — Adds new events, updates dates for variable holidays each year, removes obsolete events. Uses Groq through `lib/router.ts` to research and confirm dates.
2. **Contextual reminder generation** — Generates personalized reminders for users based on the event and their profile: "Tomorrow is Eid al-Fitr — need help finding a butcher or ingredients for your celebration?" Reminders are personalized based on `memory_profiles.behavior_patterns` (inferred religion, culture, past event-related requests).
3. **Service suggestions** — Suggests relevant services for each event: Independence Day → event planners, caterers, decorators, flag sellers; Valentine's Day → flower sellers, gift shops, restaurant bookings, delivery; Eid → butchers, grocery sellers, fabric sellers (for new clothes), tailors.
4. **Themed Daily Picks** — Creates Daily Picks (§33.1.6) themed around events. Each `daily_picks` record can reference an `event_id`. The placement algorithm prioritizes event-themed cards in the days leading up to the event.
5. **Intent creation from frontend** — The public website surfaces event-themed content on the homepage and Explore pages (e.g., "Valentine's Day is coming — get ready with Kurukoo" → links to relevant categories). This creates latent intent (user thinks "I should order flowers") without exposing other users' specific requests. The frontend displays upcoming events in a carousel or banner, driving users to relevant Explore categories.

### 54.4 Reminder Delivery

Reminders are delivered through multiple channels:
- **Daily Picks** — themed cards (sponsored slot can be an event-themed provider spotlight)
- **Push notifications** (FCM) — sent 1-3 days before the event
- **WhatsApp messages** — within the 24h window or using pre-approved template messages
- **PWA Discover panel** (§32.6) — event reminders appear in the sidebar Discover panel
- **Homepage banner** — for major events, a dismissible banner on the homepage

### 54.5 Personalization

The Cultural Calendar AI Agent personalizes reminders using:
- `memory_profiles.country` — only events for the user's active country
- `memory_profiles.behavior_patterns` — inferred religion/culture (e.g., if user frequently requests Islamic services, prioritize Eid reminders; if user requests Christian services, prioritize Christmas/Easter)
- `memory_profiles.inferred_roles` — if user is a provider in a relevant skill category, suggest they prepare for increased demand ("Eid is in 3 days — expect more butcher requests. Make sure your Go Live is ready.")
- `memory_profiles.preferences` — opt-out of specific event types (e.g., user can mute religious events they don't celebrate)

### 54.6 Admin Console

The admin console (§38) includes:
- **Events calendar view** — monthly calendar showing all events across all countries
- **Event CRUD** — add/edit/delete events, set dates or date rules
- **Reminder scheduler** — configure how many days before each event type reminders are sent
- **Themed Daily Picks manager** — pre-schedule event-themed Daily Picks
- **Cultural Calendar AI Agent status** — view agent activity, token usage, reminder delivery stats

---


## 55. Specialized Verticals: Car Parts Ecosystem & Security Personnel Staffing (v5.56)

> **Developer note (v5.56):** These two verticals were evaluated against the existing skills-based matching engine (§4, §10, §16) and confirmed as natively supported with targeted extensions. No new matching engine or separate app is required — both use the existing `find_worker` engine, `skills` table, `skill_flows` configuration, `memory_profiles`, escrow (§43), and the storefront product catalog (`skills.business_products`). What is new: (a) specific skill tags, (b) multi-leg orchestration patterns, (c) a duration-booking model for security, and (d) vetting requirements. All AI extraction goes through `lib/router.ts`.

### 55.1 Car Parts & Auto Upgrade Ecosystem

**Concept:** A car repairer, upgrader, or vehicle owner needs a specific part. Kurukoo matches the request to car parts sellers who have the part in their storefront catalog (`skills.business_products`), then orchestrates delivery from the seller to the buyer via the logistics/delivery skill — a **multi-leg sequential match** on the same engine (same pattern as the Delivery/Errands hybrid in §16.1).

**New skill tags (added to ECOSYSTEM.md §4 category 32 `automotive-mechanics`):**
- `car_parts_seller` — sells new/used/OEM car parts (storefront catalog required, Business tier)
- `panel_beater` — body work, dent removal, chassis straightening
- `spray_painter` — car respray, paint matching, custom paint
- `auto_electrician` — car electrical diagnostics, wiring, ECU
- `car_diagnostics` — OBD-II scanning, engine/computer diagnostics
- `car_upgrader` — performance mods, custom installations, aesthetic upgrades
- `tyre_dealer` — sells tyres (new/used), wheel alignment
- `battery_dealer` — sells car batteries, battery testing
- `engine_rebuilder` — engine overhaul, rebuild, swap
- `spare_parts_sourcer` — sources hard-to-find parts from key markets (Ladipo, Trade Fair, Cotonou, Dubai)

**The multi-leg flow:**

1. **User request (any channel):** "I need a front bumper for a 2012 Toyota Camry" or "I need brake pads for Honda Accord 2018, my mechanic is in Surulere."
2. **AI extraction (Groq via `lib/router.ts`):** Extracts `part_name`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `condition_preference` (new/used/OEM), `budget`, `buyer_location`, `urgency`.
3. **Leg 1 — Parts matching:** The `find_worker` engine queries `skills` for `car_parts_seller` within radius, AND queries `skills.business_products` (JSON array) for matching part name/vehicle compatibility. Results ranked by: catalog match confidence > proximity > rating > price. If no exact catalog match, the request becomes an **open gig** that parts sellers and `spare_parts_sourcer` providers can accept (sourcing from key markets).
4. **Parts seller card (inline in chat):** Shows seller name, part condition, price (Points + fiat), seller location, rating, photo. User taps "Order this part."
5. **Leg 2 — Delivery orchestration:** Once the part is confirmed, Kurukoo automatically initiates a second `find_worker` match for the delivery leg: skill `dispatch_rider` or `delivery_rider` (bike for small parts, van for large parts like engines/bumpers). Same sequential-match pattern as §16.1 hybrid tasks. Each leg charges its own lead fee.
6. **Optional Leg 3 — Installation/body work:** If the user also needs installation, body work, or upgrades, Kurukoo matches a third leg: `mechanic`, `panel_beater`, `spray_painter`, `auto_electrician`, or `car_upgrader` at the buyer's location or the workshop.
7. **Escrow (§43):** Parts payment held in escrow until delivery confirmation. Installation payment held separately until work completion. Each leg is an independent escrow transaction.

**Purchasing from key markets:** The `spare_parts_sourcer` skill covers providers who physically source parts from major auto parts markets (Ladipo Market Lagos, Trade Fair Complex, Mile 2, Cotonou, Dubai). When a user requests a rare part not in any catalog, the open gig reaches sourcers who quote a sourcing price + delivery timeline. This is a **procurement-as-a-service** flow.

**Body work & upgrades as service requests:** `panel_beater`, `spray_painter`, `car_upgrader`, `auto_electrician`, `engine_rebuilder` are standard `find_worker` skill matches — the user requests the service, the engine matches a nearby provider, and the standard escrow/rating flow applies. No multi-leg orchestration needed unless the user also needs parts sourced (then Leg 1 above runs first).

**Storefront integration:** Car parts sellers use the Business tier storefront (§9 catalog scraper, §32.6 storefront clarification). Products are stored in `skills.business_products` (JSON array) and surface conversationally — in response to parts requests, in Daily Picks (e.g., "Brake pads low? {Seller} has Honda Accord pads near you"), or when boosted/advertised. No public browseable directory.

**Revenue model:**
- Parts seller lead charge: 50 Points per matched lead (standard, §10).
- Delivery rider lead charge: 50 Points per accepted delivery.
- Installation provider lead charge: 50 Points per accepted job.
- Business tier subscription: ₦5,000/mo for parts sellers (storefront + sales analytics + priority placement).
- Sponsored Daily Picks: parts sellers can sponsor "part alert" cards (CPM/CPV).
- B2B data insights: aggregated parts demand heatmaps sold to importers/manufacturers (anonymized, §10.1).

**Compliance note:** Car parts are physical goods, not regulated services. No special licence required. However, used parts sellers must not misrepresent condition (new vs used vs OEM) — the `condition` field is mandatory in catalog entries and surfaced in the parts card. Disputes go through standard dispute resolution (§25).

### 55.2 Security Personnel & Close Protection Booking

**Concept:** A user needs a bodyguard, bouncer, security guard, or police-escorted detail for a specific duration — a day, a week, a month, or permanently. This is a **duration-based staffing** model, not a per-job gig. Kurukoo matches the request to vetted security providers (or licensed security firms for armed/police-escorted details), holds payment in escrow per period, and manages the booking lifecycle.

**New/restored skill tags (added to ECOSYSTEM.md §4 category 5 `emergency-dispatch`):**
- `bodyguard` — personal protection (close protection officer, unarmed or armed via licensed firm)
- `bouncer` — event/venue crowd control and door security
- `security_guard` — residential, commercial, or industrial site security
- `event_security` — event-specific security team coordination
- `close_protection_officer` — VIP/executive close protection
- `mopol_escort_arranger` — arranges MOPOL (Mobile Police) or police escort through licensed private security firms (NOT direct police booking)
- `security_consultant` — security assessment, risk analysis, security planning
- `cctv_installer` — CCTV/surveillance system installation
- `alarm_installer` — alarm system installation
- `crowd_control_specialist` — crowd management at large events

**Duration booking model:**

This differs from the standard per-job `skill_flows` model. A new `booking_type` field distinguishes:
- `per_job` (default — existing model): one-time task, lead charge per accepted job.
- `duration_booking` (new): staffed for a period, escrow released per completed period.

**`skill_flows` additions for duration bookings:**
- `booking_type`: `"duration_booking"`
- `duration_options`: JSON array — `[{"unit": "day", "min_price_pence": 15000}, {"unit": "week", "min_price_pence": 80000}, {"unit": "month", "min_price_pence": 300000}, {"unit": "permanent", "min_price_pence": 0, "note": "Placement fee model"}]`
- `min_personnel`: integer (e.g., 2 bouncers minimum for an event)
- `vetting_level`: `"standard"` (NIN + background) or `"enhanced"` (NIN + background + certification + licensed firm)

**The booking flow:**

1. **User request (any channel):** "I need 2 bouncers for my event on Saturday from 6pm to 2am" or "I need a bodyguard for 3 days next week" or "I need a security guard for my shop for a month."
2. **AI extraction (Groq via `lib/router.ts`):** Extracts `security_type` (bodyguard/bouncer/guard/event/escort), `duration` (day/week/month/permanent), `quantity`, `dates/times`, `location`, `armed_preference` (armed/unarmed), `budget`.
3. **Vetting gate:** If `armed_preference = armed` or `security_type = mopol_escort`, the match is restricted to providers tagged as licensed security firms (enhanced vetting). Individual freelancers can only match unarmed/standard vetting requests. This is a hard filter, not a ranking signal.
4. **Match:** `find_worker` engine queries `skills` for the security skill tag within radius, filtered by vetting level. For multi-personnel requests (e.g., 4 bouncers), the engine matches multiple providers and presents them as a team card.
5. **Security team card (inline in chat):** Shows each provider's name, photo, skill, vetting status (badge: NIN-verified, licensed firm, certification), rating, per-period price, CTA "Book team."
6. **Escrow (§43):** For duration bookings, total fee = `duration × per_period_price`. Escrow holds the full amount and releases per completed period (daily/weekly) on user confirmation. If the provider doesn't show or leaves early, the unearned portion is refunded. This protects both parties for multi-day commitments.
7. **Check-in/check-out:** For each period, the provider sends a check-in message ("On duty, arrived at location") and check-out ("Off duty, period complete"). The user confirms completion to release escrow for that period. Tracked in the `bookings` table `check_in_out_log` JSON array.
8. **Permanent placement:** For permanent/long-term bookings (1+ month), Kurukoo operates a **placement fee model**: the employer pays a one-time placement fee (lead charge, higher tier) and the ongoing salary is negotiated directly between employer and guard (off-platform). Kurukoo's role is vetting + matching, not payroll.

**Police escort arrangement:**
Kurukoo does NOT directly book individual police officers (legally and ethically complex — police are state employees). Instead, the `mopol_escort_arranger` skill tag represents **licensed private security firms** that are authorized to arrange MOPOL/police escorts through official channels (common in Nigeria for VIP transport, cash-in-transit, high-risk routes). The flow: (1) user requests "I need police escort for a trip to the East next week"; (2) AI matches to `mopol_escort_arranger` providers (licensed firms only, enhanced vetting); (3) the firm quotes a price (includes official police escort fee + firm coordination fee); (4) user confirms, escrow holds the amount; (5) firm arranges the escort through official police channels and confirms; (6) escrow released on completion. This keeps Kurukoo on the right side of the law (partnering with licensed firms, not circumventing police command) while serving a real market need.

**Vetting requirements:**
- **Standard (unarmed):** NIN verification (§15 KuruTrust), phone verification, minimum 3-star rating from prior jobs, no active disputes.
- **Enhanced (armed/police escort):** All standard requirements PLUS: verified security firm licence (PSCN — Private Security Companies Council of Nigeria registration), valid firearm permit (for armed guards), professional certification (close protection course, crowd control certification). Document uploads verified by admin before the `enhanced_vetted` flag is set. Only enhanced-vetted providers appear in armed/escort match results.
- **Background check:** For all security providers, Kurukoo queries the KuruTrust reputation system (§15) for prior complaints, disputes, or safety flags. Any unresolved safety flag disqualifies the provider from security matching.

**Revenue model:**
- Security provider lead charge: 50 Points per matched booking (standard).
- Licensed firm placement fee: 100–200 Points per placement (higher-value lead, reflects enhanced vetting cost).
- Business tier subscription: ₦5,000/mo for security firms (storefront for services, team management, bulk booking acceptance).
- Escrow: standard escrow fees apply (§43).
- Sponsored Daily Picks: security firms can sponsor "security alert" cards in high-crime areas.

**Compliance & liability:**
- Armed security and police escort are provided by **licensed firms**, not individual freelancers. Kurukoo is a matching platform, not the security provider. Terms of service must state this clearly.
- Liability for security incidents rests with the licensed firm and the individual guard, not Kurukoo (platform liability shield, same as §44 risk mitigations for other verticals).
- Kurukoo's role: vetting, matching, escrow, dispute resolution. Not operational security management.
- All security bookings are logged with: provider(s), duration, location, armed status, firm licence number (if applicable). Retained per §46 data retention policy.

> **Developer note:** The `bookings` table (referenced in §32.6 booking detail page) needs a `booking_type` column (`per_job` | `duration_booking`), `duration_unit` (`day`|`week`|`month`|`permanent`), `duration_count` (integer), `per_period_price_pence`, `vetting_level` (`standard`|`enhanced`), `firm_licence_number` (nullable, for enhanced bookings), and `check_in_out_log` (JSON array of `{period, check_in_at, check_out_at, confirmed_by}`). The `skill_flows` table needs `booking_type`, `duration_options`, `min_personnel`, and `vetting_level` columns. These are additive — existing per_job skills default to `booking_type = 'per_job'` and `vetting_level = 'standard'`, so no migration of existing data is needed.

---

## §55.3 Sports, Recreation & Community Engagement (NEW v5.57)

**Category 46 — Sports & Recreation** adds casual matchmaking, local league management, fan communities, and sports-related commerce to Kurukoo without building a single sport-specific subsystem. The same `find_worker` engine, `provider_presence`, `memory_profiles`, `messages`, `Points`, and Proactive Opportunity Engine that power the rest of the platform handle all sports use cases. The only additions are skill tags, skill_flows templates, and optional league data tables.

**Mandate compliance:** This section is fully compliant with all five §1.4 rules — see §55.3.6.

### 55.3.1 Pain Points Being Solved

| Pain Point | Who Feels It | Kurukoo Solution |
|---|---|---|
| **Finding players for casual games** | Boys/young men who want 5-a-side, 7-a-side, 11-a-side | AI matches nearby players by skill level, position, availability; creates group chat; optional pitch booking |
| **Organizing local leagues** | Organizers, team captains | Auto-schedule fixtures, track standings, send reminders, collect match fees via escrow |
| **Booking pitches/fields** | Players, organizers | Match to `pitch_booking_agent`, escrow holds booking fee, releases after confirmation |
| **Equipment coordination** | Players | "Who's bringing the ball?" — tracked in group chat; optional equipment rental via storefront |
| **Finding like-minded players** | Newcomers to an area | Proactive nudge: "3 football players active in your area" + match by inferred skill level |
| **Fan coordination** | Supporters | Kuru Circle for club supporters; watch-party coordination; match-day travel sharing |
| **Coaching/training** | Parents, young players | Match to `football_coach` / `sports_coach`; schedule sessions; pay via escrow |
| **Sports equipment commerce** | Players, parents | Parts-seller-style storefront for jerseys, boots, equipment; same catalog pattern as §55.1 |

### 55.3.2 Three Implementation Tiers

#### Tier 1: Casual Matchmaking (MVP — 2 weeks)

**User flow:**
1. **Request:** "I want to play football in Ikeja today at 5pm" (any channel)
2. **AI extraction (Groq via router):** sport=football, location=Ikeja, time=today 5pm, format=5-a-side (or asks if unclear)
3. **Match via `find_worker`:** Queries `skills` for `football_player` tag within radius, filtered by `is_available=1` and `last_active < 24h`
4. **Player card (inline):** Name, preferred position, skill level (beginner/intermediate/advanced), rating, distance, availability
5. **Group creation:** User taps "Create match" → Kurukoo creates a group chat, adds matched players, sends pitch booking link
6. **Pitch booking (optional):** Match to `pitch_booking_agent` or directly book via partner API
7. **Payment:** Match fee split equally → escrow holds → released after match confirmation
8. **Presence:** Players who accept get their presence updated to the pitch location

**New skill tags (add to ECOSYSTEM.md category 46):**
- `football_player` — casual player seeking games
- `football_organizer` — organizes local matches/leagues
- `pitch_booking_agent` — books and manages sports pitches
- `football_coach` — training sessions, youth coaching

**Revenue:**
- Match fee commission (5-10%)
- Lead charge for pitch booking agents (50 Points)
- Sponsored Daily Picks: "Football match in your area — 3 spots left"

#### Tier 2: League Management (Medium — 4 weeks)

**User flow:**
1. **League creation:** Organizer says "I want to start a 7-a-side league in Yaba" → AI creates league object
2. **Team registration:** Teams register via chat → captain + players added to `memory_profiles` with `team_id`
3. **Schedule generation:** AI generates fixture list based on team availability + pitch availability
4. **Match day:**
   - Morning: Kurukoo sends reminders to both teams + referee
   - Match: Players check in at pitch (presence update), score reported via chat
   - After match: Winning team gets Points bonus, standings updated, highlights posted to Daily Picks
5. **Standings table:** Auto-generated from match results, shown in chat or PWA
6. **Promotion/relegation:** AI suggests based on performance (optional)

**Revenue:**
- League registration fee (500 Points per team per season)
- Match fee commission (5%)
- Sponsored Daily Picks: league standings, match highlights

#### Tier 3: Fan Community & Sports Content (Future — Phase 2)

- **Fan clubs:** Kuru Circles for club supporters (e.g., "Arsenal fans in Lagos")
- **Watch parties:** "Watching the match at [bar]" → Kurukoo coordinates attendance
- **Sports alerts:** Match reminders, transfer news, injury updates (via Daily Picks or proactive nudges)
- **Merchandise:** Connect to storefront for jerseys, boots, equipment

### 55.3.3 Other Sports (Same Pattern)

| Sport | Pain Point | Kurukoo Solution | Skill Tag |
|-------|-----------|------------------|-----------|
| **Basketball** | Finding 5v5 games | Same as football matchmaking | `basketball_player` |
| **Tennis** | Finding hitting partners | `find_worker` for `tennis_partner` | `tennis_partner` |
| **Swimming** | Finding lane partners, booking pools | Presence for pool availability + booking | `swimming_partner` |
| **Gym** | Finding workout partners, gym booking | Same pattern | `gym_partner` |
| **Cycling** | Group rides, route planning | Presence + group creation | `cycling_partner` |
| **Running/Jogging** | Finding running partners | Proactive nudge: "3 runners active in your area" | `running_partner` |
| **Volleyball** | Beach volleyball games | Same as football | `volleyball_player` |
| **Martial arts** | Finding training partners, dojo booking | `find_worker` for `martial_arts_partner` | `martial_arts_partner` |

**Additional skill tags (category 46):**
- `sports_coach`, `personal_trainer`, `fitness_instructor`
- `sports_equipment_seller`, `jersey_customizer`, `sports_merch`

### 55.3.4 National Events & Cultural Calendar Integration

Sports events are integrated with §54 National Events & Cultural Calendar:
- **Local league fixtures** automatically populate the calendar
- **Match day reminders** sent via Daily Picks, push, WhatsApp, PWA sidebar
- **National team matches** (Super Eagles, etc.) trigger watch-party coordination
- **Festival tournaments** (e.g., Eid football tournaments, Christmas street football) surfaced as themed Daily Picks
- **Cultural sports events** (traditional wrestling, horseback riding in the North) added to `national_events` table

**Cultural Calendar AI Agent** (§54) handles:
- Maintaining the sports events calendar
- Generating personalized reminders based on user preferences + location
- Suggesting relevant services (pitch booking, equipment, transport to matches)
- Creating themed Daily Picks for major events

### 55.3.5 Revenue Model

| Revenue Stream | How It Works | Estimate |
|---|---|---|
| **Match fee commission** | 5-10% of match fee collected via escrow | ₦500–2,000 per match |
| **Lead charge for pitch booking** | 50 Points per matched booking | 50 Points |
| **League registration fee** | 500 Points per team per season | 500 Points |
| **Business tier for sports providers** | ₦5,000/mo for coaches, pitch owners, equipment sellers | ₦5,000/mo |
| **Sponsored Daily Picks** | "Football match in your area — 3 spots left" | CPM/CPV |
| **Equipment storefront** | Same as §55.1 car parts — commission on sales | 10-15% |

### 55.3.6 Mandate Compliance Checklist

| §1.4 Rule | How Sports/Recreation Complies |
|---|---|
| **1. Single memory profile** | Players, coaches, organizers, pitch owners all have one `memory_profiles` row. League membership, team assignments, match history update the same profile. |
| **2. Shared presence** | Players use `provider_presence` to show availability at pitches. Pitch owners update availability. Same presence layer as the rest of the platform. |
| **3. Conversation primary** | Match creation, league registration, score reporting, reminders — all happen in the unified conversation thread. PWA is a rich mirror. |
| **4. Points economic layer** | Match fees, lead charges, league registration, equipment purchases — all move the same Points balance. Visible and actionable in every channel. |
| **5. Proactive from same memory** | Daily Picks suggest matches based on user preferences, location, and past participation. Opportunity Engine nudges: "5 players needed for a match in your area." |

**Any feature that violates one of these five rules is considered incomplete.**

### 55.3.7 Football Club Formation & Local Meetup Coordination

**Concept:** Beyond casual matchmaking, Kurukoo enables the formation of formal football clubs, recurring local meetup groups, and community sports ecosystems. Boys and young men who meet informally to play football can register their group as a club, manage membership, schedule recurring matches, track performance, and grow into formal leagues. This is the social infrastructure layer for grassroots sports in Nigeria.

**Football Club Formation Flow:**

1. **Club creation:** A user says "I want to start a football club in my area" → AI extracts: club name, location, preferred format (5-a-side/7-a-side/11-a-side), trial/selection criteria.
2. **Club registration:** Kurukoo creates a `clubs` record linked to the founder's `memory_profiles.phone`. Club gets a unique ID and shareable link/code.
3. **Captain & squad management:** Founder becomes club captain. Adds members via phone number invite or WhatsApp share link. Each member gets a `memory_profiles` entry with `club_id` and `position` field.
4. **Club identity:** Club name, colors, home pitch, motto, social links — managed via chat ("Change my club's colors to red and white") or PWA settings.
5. **Trial/selection:** Clubs can set trial criteria (age range, skill level, availability). Kurukoo sends trial invites to nearby `football_player` profiles matching the criteria.
6. **Recurring matches:** Captain schedules weekly/bi-weekly matches. Kurukoo sends reminders to both teams, books pitch if needed, tracks attendance.
7. **Club wallet:** Collective Points balance for the club (sponsorship, match fees, tournament winnings). Captain controls disbursement.

**Local Meetup Coordination:**

- **Spontaneous games:** "5 players needed for a match in Ikeja now" → Kurukoo creates a temporary group, matches players within 30 mins, coordinates pitch access.
- **Recurring meetup groups:** "Every Saturday morning football at [pitch]" → Kurukoo creates a recurring event, sends weekly reminders, tracks attendance streaks, awards Points for consistency.
- **Pitch booking coordination:** Kurukoo matches to `pitch_booking_agent` or directly books via partner API. Group payment split via escrow.

**Community Sports Ecosystem:**

- **Fan clubs:** Kuru Circles for club supporters (e.g., "Arsenal fans in Lagos").
- **Watch parties:** "Watching the match at [bar/restaurant]" → Kurukoo coordinates attendance, group booking, transport.
- **Sports alerts:** Match reminders, transfer news, injury updates, league standings (via Daily Picks or proactive nudges).
- **Equipment storefront:** Same as §55.1 car parts — `sports_equipment_seller` providers list jerseys, boots, goals, bibs. Users order via chat. Delivery coordinated via `dispatch_rider`.

**Tournament Organization:**

- **Tournament creation:** Organizer says "I want to run a 7-a-side tournament in Yaba with 16 teams" → AI creates tournament bracket, manages registration, schedules fixtures.
- **Registration:** Teams register via chat → captain + squad added. Entry fee paid via escrow (split: 70% prize pool, 20% platform, 10% organizer).
- **Match day:** Kurukoo coordinates pitch bookings, referee assignment, score reporting, standings updates.
- **Prize distribution:** Winning team gets Points + cash prize (if entry fees collected). Automatically distributed via escrow.

**Sports-Specific AI Agents:**

- **Match scheduler agent:** Generates fixtures based on team availability + pitch availability. Handles rescheduling when matches are postponed.
- **Fixture generator agent:** Creates tournament brackets (round-robin, knockout, Swiss system) based on number of teams and format.
- **Standings tracker agent:** Auto-updates league tables from match results. Calculates points, goal difference, form. Surfaces in chat and PWA.
- **Results reporter agent:** Accepts score reports from both teams + referee. Validates consistency (both teams must agree or referee confirms). Updates standings and notifies all members.
- **Sports news agent:** Curates relevant sports news (local leagues, transfers, events) for Daily Picks based on user's club/team preferences.

**New skill tags (add to ECOSYSTEM.md category 46):**
- `football_club_founder` — creates and manages football clubs
- `match_organizer` — organizes casual matches and tournaments
- `team_captain` — leads a registered team/club
- `league_admin` — manages league operations (scheduling, standings, disputes)
- `pitch_manager` — owns/manages sports pitches for booking
- `sports_event_host` — organizes watch parties, sports events

**Revenue model (expanded from §55.3.5):**

| Revenue Stream | How It Works | Estimate |
|---|---|---|
| **Match fee commission** | 5-10% of match fee collected via escrow | ₦500–2,000 per match |
| **Lead charge for pitch booking** | 50 Points per matched booking | 50 Points |
| **League/club registration fee** | 500 Points per team/club per season | 500 Points |
| **Tournament entry fee cut** | 20% of entry fees (70% prize pool, 10% organizer) | 20% of entry fee |
| **Business tier for sports providers** | ₦5,000/mo for coaches, pitch owners, equipment sellers, club admins | ₦5,000/mo |
| **Sponsored Daily Picks** | "Football match in your area — 3 spots left", "League standings updated" | CPM/CPV |
| **Equipment storefront** | Same as §55.1 car parts — commission on sales | 10-15% |
| **Fan club subscriptions** | Premium fan clubs with exclusive content, early ticket access | ₦500–2,000/mo |
| **Sponsorship matching** | Brands sponsor clubs/leagues/tournaments via Kurukoo | 5-10% sponsorship fee |

---

This appendix records the proven low-cost distribution and marketing methods for the Nigerian market and how each is already supported (or easily supported) by existing Kurukoo systems. Internal only.

| Method | How Kurukoo Already Supports It | Notes |
| :--- | :--- | :--- |
| **WhatsApp Status / Broadcast** | Kurukoo's primary channel is WhatsApp. Broadcast lists and Status-style nudges use the existing WhatsApp Cloud API + FCM re-engagement. | Low-cost; respect 24h service window and opt-in rules. |
| **Agent networks (physical "Kuru Agents")** | §9 Agent Network + §1.6 Kuru Agent vision. Agents onboard providers, assist walk-ins, and earn commissions via the existing commission/lead-charge model. | Highest-leverage offline channel for informal-economy density. |
| **Referral with airtime/Points** | §22 Referral Programme: code generation, tracking, 200-Point rewards, Web Contact Picker sharing. Points (CBN-compliant) replace airtime redemption. | Frictionless one-tap sharing from the chat interface. |
| **Community groups (church, mosque, market associations)** | §32.5 Explore Hub + community board + Buying Circles (§20/§41.2). Group coordination and pooled demand run on the existing conversation engine. | Group bookings and skill-swap listings reuse the skills taxonomy. |
| **Local radio** | Referral codes and the *7000# shortcode / WhatsApp 7000 are radio-readable call-to-actions. No new system needed; radio drives traffic to existing entry points. | Pair with a memorable shortcode and a single WhatsApp number. |
| **Physical demos** | Kuru Hub walk-in locations (§28.1 future) and agent-assisted demos. Today, agents can demo the PWA/WhatsApp flow on-device for free. | Device demos convert informal-economy providers who distrust app stores. |

Each of these methods is designed to run on the existing architecture: WhatsApp channel, agent network, referral/Points, community/Explore Hub, shortcode entry, and on-device demos. No new distribution system is required to execute them.

### 55.3.8 Competitor Note (Nigerian Grassroots Football / Community Sports)

**Honest market observation:** Nigeria's grassroots football and community-sports space — casual pick-up games, local meetups, neighbourhood leagues, fan clubs — is **informal and WhatsApp-led**. Games are organized through WhatsApp groups, word-of-mouth, and physical pitch managers; there is **no verified dedicated app holding the market** the way dedicated apps do in the UK/global pattern (e.g., Footy Addicts, JustPlay, Playfinder). This is a fragmented, un-served informal gap.

**Positioning implication:** Kurukoo is **not** "another football app" that must be downloaded and is single-purpose. It is the only offer that does matchmaking + leagues + pitch booking + tournament organisation **inside the everyday conversation** on WhatsApp + USSD + PWA, with the Points economy, escrow, presence, and the field-videographer/content infrastructure (§36.1.3) already underneath. Because users already use Kurukoo for everything else, football/sports is an incremental use case on the existing engine — not a new category to bootstrap. No dedicated competitor can match the chat-first, zero-download, multi-service bundling.

### 55.4 Universal Vendor Product Ordering Flow

**Purpose:** A single, shared transaction flow that **every catalog-bearing skill** uses — roadside food vendors (suya, akara, small chops), bakeries, grocers, car parts sellers (§55.1), clothing, sports-equipment storefronts, and any provider that lists products. This deliberately avoids per-skill special-casing and delivers the §1.4 "one engine, not N parallel ones" mandate.

**Why this exists (the gap it closes):** The `order_food` intent (and equivalent product intents) currently **dead-ends** — the router recognises *"I want suya / I dey hungry"* and replies with a generic prompt (*"What would you like to order?"*) but never finds a vendor, shows a menu, or completes a transaction. Kitchen-side USSD ordering was bakery-only. This section specifies the shared flow that makes roadside-vendor, grocery, and parts ordering actually complete end-to-end, reusing existing plumbing.

**Flow (all channels):**
1. **Extract:** User requests a product ("5 sticks of suya", "NGK spark plug", "2 loaves of bread"). The AI router (Groq via `lib/router.ts`, FastText fallback) extracts item + quantity + location/request.
2. **Match:** `find_worker` queries providers whose `skills` entry matches the skill **and** whose existing `skills.business_products` JSON catalog contains the item (not just by skill tag).
3. **Product card:** Returns an inline card — item, unit price, vendor name, distance, rating — via the existing hybrid-chat card system.
4. **Escrow hold:** User confirms → escrow holds the payment (split: vendor portion + platform coordination cut). Reuses the §33.1 escrow state machine.
5. **Delivery (optional):** If dispatch is needed → match `dispatch_rider`/errand as a **second leg** (same multi-leg pattern as §16.1 Delivery/Errands and §55.1).
6. **Completion:** User confirms receipt (or delivery proof) → escrow releases to vendor (+ rider).
7. **Reorder signal:** Completed order writes a reorder signal back into the vendor's `memory_profiles` and the buyer's profile (proactive reorder nudges, §33 Opportunity Engine).

**Resource reuse (no new vendor-specific fields are required):** This flow builds entirely on existing `find_worker`, `skills.business_products` (the existing catalog field), `escrow`, `dispatch_rider`, and the `messages` conversation thread. It confirms that the car-parts vertical (§55.1) did **not** add vendor-specific database fields — it only added skill tags and documented this same shared workflow. The only genuinely new schema in the §55 additions is Security (§55.2, `booking_type`/`duration_unit`/`vetting_level`), which is legitimately required for duration-based staffing and applies to no other skill.

**Roadside/small-vendor specifics:** Price filtering, vendor verification status, "available now" presence, and Points-earning on purchase are reused from the existing profile/presence/Points systems. Endian vendor registration remains conversational (vendor states what they sell; Kurukoo builds/updates `business_products` through occasional chat questions — see §32.6 storefront clarification, chat-managed inventory, not a public directory).

**Mandate compliance:** Single memory profile (buyer & vendor are `memory_profiles` rows) ✅ · shared presence (vendor/`dispatch_rider` on `provider_presence`) ✅ · conversation is the only interface (ordering, confirmation, escrow release all in chat) ✅ · Points economic layer (purchase/lead/Points) ✅ · proactive from same memory (reorder nudges from profile history) ✅.

---

### 55.5 How-To Video Content & Channel Growth Engine

**Purpose:** Convert the existing How-To Guides / Resources (§32.6), blog, and SEO content (§53.2.6) into **video-ready explainer scripts**, render them into low-cost videos, distribute to external channels (YouTube primary, plus Shorts/Reels/TikTok and the PWA feed), **monetise the channel** once thresholds are met, and use the **Proactive Engine (§33) to grow subscriptions** through the everyday WhatsApp chat, Daily Picks, and push surfaces. This turns an internal documentation cost into a compounding, owned, monetisable content asset — and gives the proactive engine a measurable growth job.

#### 55.5.1 Script Generation (How-To Explainers)

**Source topics from:** existing How-To guides, blog posts, top-searched Explore intents, FAQ questions (§53.2.2.1), and new-vertical explainers (e.g., "How to order from a suya vendor" (§55.4), "How to book a bodyguard/escort" (§55.2), "How to find a football match or join a club" (§55.3), "How to set up your chat-managed storefront").

**Generation pipeline (AI via `lib/router.ts`, human-review gate — same rule as all AI content, §49 quotas):**
1. **Outline** — topic + target keyword + target audience (consumer/provider/business).
2. **Hook** — first 5 seconds (retention-critical; scripted explicitly).
3. **Step-by-step body** — one clear action per beat, plain Pidgin/English adaptation per locale.
4. **CTA** — end action ("Subscribe", "Open WhatsApp 7000", "Book now").
5. **On-screen cues + shot list** — text overlays, simple visuals, per-scene duration.
6. **Format split** — Shorts (≤60s, hook-led single idea) vs full-length (3–8 min, complete walkthrough).
7. **Captions/thumbnail text** — auto-derive caption file (SRT) and 2–3 thumbnail title options from the script.

**Storage:** new `how_to_scripts` table — `id`, `source_guide_id`, `title`, `target_keyword`, `audience_type`, `script_json` (outline/hook/body/CTA/cues/shot-list), `duration_target` (shorts/full), `captions_srt`, `thumbnail_options_json`, `status` (`draft → reviewed → approved → rendered → published`), `channel`, `published_at`.

#### 55.5.2 Low-Cost Production & Multi-Channel Distribution

- **Render path (cost-efficient):** TTS voiceover via the Kokoro-Engine (currently listed as "Future" — promoted to buildable here where it earns its keep), text-on-screen slides rendered from the shot list. No studio/set required; a single template renders a full explainer.
- **Channels:** YouTube (primary monetisation), YouTube Shorts, Instagram Reels / TikTok (cross-post for reach), and Kurukoo's own PWA feed / Daily Picks (owned, no platform risk).
- **SEO alignment:** each published video maps to a `seo_content_brief` / category page (§53.2.6) so the same topic has a written guide + an explainer video reinforcing one another (topical authority).

#### 55.5.3 Proactive Engine Driving Subscriptions (Growth)

Extend the Opportunity/Proactive Engine (§33) to surface personalised **video CTAs** from `memory_profiles.inferred_roles` + `behavior_patterns`:

- **WhatsApp chat:** after a completed task or after a user reads a How-To, an inline card — "🎬 Want this as a video? Subscribe to our channel" or "New explainer: [topic matching their behaviour/interest]".
- **Daily Picks:** interleave subscribe cards and a video carousel selected by inferred interests.
- **Push (FCM) / PWA feed / Discover:** same personalised video CTAs.
- **Points incentive (optional):** small Points reward for subscribing/watching (closed-loop economy only, never cash-outable — CBN-compliant, not a bribe for external value).
- **Measurement:** new `video_subscription_events` table — `phone_hash` (masked, §41 no PII), `surface` (whatsapp/daily_picks/push/pwa), `video_id`, `action` (view/subscribe), `points_awarded`. Lets us measure total channel growth and which proactive surface converts best, and feeds back into the proactive ranking.

#### 55.5.4 Monetisation

- **YouTube Partner Program:** full monetisation at **1,000 subscribers + 4,000 public watch-hours** (traditional) **or 1,000 subscribers + 10M public Shorts views in 90 days** (YPP for Shorts). Also **500 subs + 3 uploads/90 days + 3,000 watch-hours/90 days** (YPP fan-funding tier).
- **AdSense** once eligible, **membership/super-thanks** later, then **sponsor/brand placements** in popular explainers.
- **Kurukoo-native monetisation** (not dependent on YouTube): sponsor a how-to related to a Business-tier category; premium "pro" explainer libraries; embed videos in sponsored Daily Picks.

#### 55.5.5 Mandate Compliance & Data Rules

- Single memory profile ✅ (view/subscribe interest lives on the user's profile, stored masked).
- Conversation-first ✅ (all CTAs appear inside WhatsApp / Daily Picks chat, not a separate app).
- Points economic layer ✅ (optional rewarded viewing, closed-loop only).
- Proactive from same memory ✅ (tailored video recommendations from `inferred_roles`/`behavior_patterns`).
- No PII in external sync ✅ — analytics/tracking use `phone_hash`; never send emails/phone numbers to YouTube/Grade. No new npm packages without approval; AI generation through `lib/router.ts` with §49 quotas; high-frequency reads via `cacheGet()` (§47).

---

### 55.6 Agentic Commerce Showcase & Interactive UI/UX Transformation

**Purpose:** Shift Kurukoo's public frontend from static, text-heavy descriptions to a dynamic **"Show, Don't Tell" Agentic Experience**. Benchmarked against modern agentic commerce benchmarks (such as Swap Commerce's Agentic Storefront, `swap-commerce.com/storefront`), this specification codifies how Kurukoo showcases its multi-vertical AI agent in live interactive motion across all public web surfaces (Homepage `index.ejs`, Explore Categories `views/explore/*`, For You `for-you.ejs`, and Discover `discover.ejs`).

#### 55.6.1 Competitive Analysis: Swap Commerce vs. Kurukoo Agentic OS

1. **What Swap Commerce Does Right:**
   - **Visual Interactivity:** Embedded animated previews and live simulations of their personal shopping AI across the entire landing journey.
   - **Granular Micro-Step Explanations:** Visually decomposes how the AI understands natural language, filters catalogs, styles complete looks, and executes checkouts.
   - **Immediate Cognitive Tangibility:** Visitors grasp the core value proposition in seconds without reading dense architectural paragraphs.

2. **Kurukoo's Structural Advantages (Full-Stack Agentic OS):**
   - **Multi-Vertical Breadth:** Swap is restricted to single-merchant fashion/e-commerce catalogs; Kurukoo autonomously executes across 300+ skills (street food, car parts, security escorts, artisan services, UK life-admin, logistics).
   - **Multi-Leg Physical Orchestration:** Kurukoo does not just recommend a product; it chains catalog extraction → merchant verification → escrow hold → dispatch rider routing → physical proof-of-delivery → escrow payout.
   - **Channel Freedom:** True zero-download accessibility via WhatsApp (`7000`), USSD (`*7000#`), PWA, and SMS.
   - **Living Memory:** Cross-session, cross-channel contextual memory that personalizes suggestions based on real lifetime user behavior.

3. **Strategic Gap Addressed:** Kurukoo's backend capabilities are vastly more sophisticated than e-commerce shopping assistants, but its previous public presentation lacked interactive visual demonstration. §55.6 bridges this gap.

#### 55.6.2 The "Show, Don't Tell" Interactive UI/UX Architecture

The public interface incorporates four interconnected interactive visual systems:

1. **Interactive Hero Agent Simulator (`Module A`):**
   - Embedded interactive smartphone mockup in the primary hero viewport.
   - 4 one-tap scenario triggers:
     - *Street Food / Suya:* "Order 5 sticks of suya to Ikeja with live rider dispatch"
     - *Car Parts Multi-Leg:* "Toyota Corolla 2012 brake pad sourcing + mobile mechanic"
     - *Close Protection:* "Book 2 verified security escorts for Saturday event"
     - *UK Diaspora Support:* "Fund Enugu electricity meter & verify token"
   - Live visual step progression: `Extract Entity` → `Memory Check` → `Worker/Catalog Match` → `Escrow Lock` → `Dispatch Route`.

2. **Interactive Autonomous Execution Teardown (`Module B`):**
   - Animated visual breakdown illustrating the 5 internal layers of Kurukoo's agentic loop:
     1. *Colloquial & Dialect Understanding:* Natural Pidgin/English parsing via Router (`lib/router.ts`).
     2. *Living Memory Context:* Real-time retrieval of user habits from `memory_profiles`.
     3. *Autonomous Tool Calling:* Dynamic execution of `find_worker`, `check_inventory`, `escrow_lock`.
     4. *Physical Logistics Mesh:* Multi-leg routing connecting vendor to dispatch rider.
     5. *Closed-Loop Trust & Points:* Post-job rating and CBN-compliant Points accrual.

3. **Interactive Comparison Matrix (`Module C`):**
   - Dynamic comparison toggle highlighting the contrast between **Traditional Search/Classifieds** (15+ tabs, phone tag, manual rider search, fraud risk) vs. **Swap-style Storefronts** (single brand only) vs. **Kurukoo Agentic Commerce** (one conversational message, autonomous multi-leg fulfillment, escrow guarantee).

4. **Live Anonymized Pulse & Action Stream (`Module D`):**
   - Real-time ticker streaming anonymized platform transactions (e.g., *"Lagos: Agent matched dispatch rider for suya order in Yaba • 14s ago"*, *"London: Agent scheduled MOT renewal reminder • 48s ago"*) to provide social proof of platform density.

#### 55.6.3 Technical Implementation & Performance Guardrails

- **Zero Heavy Framework Dependencies:** Interactive simulators built using lightweight vanilla JavaScript (`public/js/agentic-showcase.js`) and Tailwind CSS utilities to maintain sub-100ms first contentful paint (FCP).
- **Parity with Live Engine:** Visual preview cards render using the identical DOM schema as `kurukoo-chat.js`, ensuring seamless transition when an anonymous visitor converts to authenticated WhatsApp/PWA chat.
- **Mandate & Security Compliance:** Single `memory_profiles` schema preserved; zero API keys exposed in browser; fully WCAG AA accessible and mobile-first (≥44px touch targets).

---

## Appendix: Version History
- v5.62: **Agentic Storefront & Interactive UI/UX Transformation (§55.6).** Benchmarked against next-gen agentic commerce platforms (e.g. Swap Commerce agentic storefront model). Added §55.6 codifying the "Show, Don't Tell" interactive agentic UI/UX transformation across the entire public web surface (Homepage, Explore Categories, For You, Discover). Details interactive Agent Action Simulators, step-by-step agentic execution teardowns (Intent Extraction → Living Memory Lookup → Catalog & Worker Match → Escrow Lock → Multi-Leg Dispatch), interactive traditional vs. agentic comparison matrices, domain-specific category simulators, and live anonymized agentic pulse tickers. Fully compliant with single memory profile, multi-channel mirrors (WhatsApp 7000, USSD *7000#, PWA), and Points economy. Created `AGENTIC_STOREFRONT_TRANSFORMATION_PLAN.md`.

- v5.61: **Deferred Request Protocol — Handling Unavailable Requests (§4.1.3).** Added §4.1.3 — a 5-state protocol (`requested` → `awaiting_match` → `partially_matched` → `fulfilled`/`abandoned`) that keeps users engaged when no provider is immediately available. States table, lifecycle transition table (trigger → from→to → action), and technical implementation (Open Intentions storage in `memory_profiles.open_intentions` with 7-day TTL, 2-hour re-evaluation cron, nightly expiration cron, proactive FCM+WA nudges, user controls: "Check again in X", "Expand to nearby LGAs", "Cancel", "Find alternative skill", fallback pathways after 3 days). Integrates with memory profile (readable by AI, feeds behavior_patterns, surfaces to Opportunity Engine §33, increments `deferred_attempts` for trust-score adjustment). Mandate-compliant (Rules 1, 3, 4, 5).

- v5.60: **How-To Video Content & Channel Growth Engine (§55.5).** Added §55.5 — automated explainer-script generation from existing How-To Guides/Resources (§32.6) and SEO content (§53.2.6); low-cost TTS (Kokoro-Engine promoted to buildable) + text-on-screen render path; multi-channel distribution (YouTube, Shorts, Reels/TikTok, PWA feed); YouTube Partner Program monetisation thresholds (1,000 subs + 4,000 watch-hours, YPP Shorts 1,000 subs + 10M Shorts views/90d, fan-funding tier 500 subs + 3 uploads/90d + 3,000 watch-hours); Proactive Engine (§33) driving subscriptions via WhatsApp chat, Daily Picks, push/PWA with optional closed-loop Points reward; new `how_to_scripts` and `video_subscription_events` tables (masked phone-hash analytics, no PII). Mandate-compliant (single profile, conversation-first, Points layer, proactive-from-memory). No features removed.

- v5.59: **Universal Vendor Product Ordering Flow + Sports Competitor Note (§55.4, §55.3.8).** Added §55.4 Universal Vendor Product Ordering Flow — a single shared transaction flow used by every catalog-bearing skill (roadside food [suya/akara], bakeries, groceries, car parts §55.1, clothing, storefronts) instead of per-skill special-casing; fixes the `order_food`/product intents that previously dead-ended after a generic prompt. Flow: extract (item+quantity+location) → `find_worker` match against `skills.business_products` → product card → escrow hold → optional delivery second leg via `dispatch_rider` → completion → escrow release → reorder signal. Reuses existing `business_products`, `find_worker`, `escrow`, `dispatch_rider`, `messages` — no new vendor-specific fields. Confirms the car-parts vertical (v5.56) added only skill tags, not schema. Added §55.3.8 Competitor Note — Nigerian grassroots football/community-sports is informal and WhatsApp-led with no verified dedicated app holding the market; positioning is chat-first/zero-download/multi-service bundling. Updated FRONTEND_PAGES.md and homepage_copy.md scrollable cards to route "Order Food"/"Get Groceries" through the shared flow. No features removed; no public-facing language changed.
- v1.0 to v5.15: OyaOrder > NaijaConnect > Xentrix design phases (all superseded)
- v5.16: Kurukoo Blueprint. First unified memory profile and skills schema
- v5.22: Kurukoo rebrand. Skill flow unification, 62 question sets
- v5.31: CBN compliance refactor. Points system replaces Credits. Airtime redemption removed. P2P credit transfers removed. NaijaCredits renamed to Points
- v5.33: Badges, contingency plans, admin console, Explore Hub, hybrid chat UI, caching strategy
- v5.33.1: IP licensing model deferred (removed for pilot). NaijaTrust renamed to KuruTrust
- v5.34: Final consolidation pass. All legacy names removed (NaijaTrust→KuruTrust, Xentrix→Kurukoo, Beam→liveCast, NaijaCredits→Points, Ajo→Circle). Seven contradictions resolved (airtime redemption, P2P credit resale, 50% IP fee, referral reward phrasing, Beam wording, 4-tab PWA nav, old tagline). Nineteen missing sections added from gap analysis: Competitive and Global Precedent, Diaspora and Returnee Positioning, Risks and Mitigations, Brand Architecture, Kuru Pulse, Personalised Quick Replies, Progressive Onboarding, Language Services and Dialect Mapping, i18n Architecture, Verified Artist Booking, Badges and Reputation, Contingency Plans, Admin Console, Explore Hub, Hybrid Chat UI, PWA Caching Strategy, Provider Operation Modes and Skill Dimensions, Agent Network, Anti-Bias and Fairness. Supporting file references removed.
- v5.37: Added §1.6 Founder-Inspired Operating Principles (Internal Only) — Jack Ma (informal-economy density, physical agent networks, soft-claim of offline businesses, trust via completed local jobs), Elon Musk (ruthless cost discipline on presence/location and AI, hard quotas, automatic pause of money-burning features, platform-as-long-term-infrastructure), Brian Chesky (personal/delightful living memory profile, strong post-job experience, quiet continuous profile improvement), Mark Zuckerberg (conversation graph and social/referral loops as first-class growth engines, frictionless sharing and group coordination). Integrated UK life-admin capabilities (MOT, bin-day, insurance, doctor, council-tax, energy-tariff, lost-pet, skill-swap) as /gb/ locale skills/constrained agents on the existing engine (§35.2). Clarified Trust Score as backend-only with public human signals only. Strengthened the long-term multi-agent horizon note (future, not current scope). Added Nigerian Market Success Patterns appendix (internal). No features removed; no public-facing language changed.
- v5.38: **Full UK Life-Admin Integration as Universal Skills.** Expanded §35.2 from 8 to 60+ UK life-admin skills, all with clean universal IDs (no country prefix). Each skill documented with category, required data, legal disclaimer, payment model, and fulfilment type. Added skill_flows configuration guidance, locale & feature flag control section (§35.2.3), Points economy note (§35.2.4), and Tight Integration Mandate compliance verification (§35.2.5). No new tables, no voting system, no country-prefixed skill IDs. Enabled via `memory_profiles.country` and feature flags scoped to `/gb/`. Same skills ready for other countries without renaming. Every skill obeys the Tight Integration Mandate — reads/writes the single memory profile, lives inside the unified conversation, uses the shared Points balance, and uses the shared presence/reminder infrastructure. No features removed; no public-facing language changed.
- v5.39: **Frontend Realignment & Unified Memory Profile Verification.** Verified complete alignment across all channels (WhatsApp Cloud API, USSD *7000#, and single-screen chat PWA). Reinforced 30-day progressive conversational onboarding, single-table `memory_profiles` architecture, conversational card-based interactions (`kurukoo-chat.js`), and public website landing page ("One number. One conversation. Wake up. Get going.") with real-time API integrations.
- v5.36: Added §1.5 Agreed Operating & Growth Principles (Internal Only). Consolidates the internal operating model into one section: Presence & Location Operating Model (default Pulse, stationary/mobile behaviour, precise-GPS/WebRTC gating, TTL cleanup, public-language rule), Channel Priority (WhatsApp primary, PWA rich mirror, native apps Phase 2/3 secondary, USSD fallback), Business & Provider Seeding Strategy (reuse existing memory_profiles + skills + provider_presence, source = "seeded" + soft-verified flag, stationary seeding from public data, Catalog Scraper / WhatsApp Business catalogue enrichment, soft-claim merge into live profile, Admin Console control), Cost & Intensity Controls (FCM always-on, WebRTC only on high-value moments, FastText ≥95%, free/open models preferred, aggressive Redis TTLs, AI-agent hard quotas + auto-pause), On-Demand vs Delayed Services (both modes supported end-to-end), Free UX Indicators (zero-cost trust signals), and Backend Systems Required for Frontend Alignment (unified conversation + memory + presence API, soft-claim flow, catalog enrichment, Points/lead-charge endpoints, admin controls, on-demand vs delayed flags). Strictly internal; no public-facing language changed. No features removed.
- v5.35: Added Tight Integration Mandate (§1.4 five irreversible rules + Builder & AI Agent Rules). Revised §2.1 memory-profile schema with provider_presence and user_behavior_signals tables and disciplined JSONB preferences. Added §5 Presence Trick-Bridge (cost-effective continuous presence) and hybrid FCM + short-lived WebRTC transport rules. Expanded WebRTC usage rules (high-value short-lived sessions only). Added "AI Agents as First-Class Users" major section with full backend management. Strengthened Redis hot-path role in Technology Stack and Caching Strategy. Separated Delivery vs Errands as distinct skill flows (§16.1). Expanded Universal Remote / IoT as first-class on-demand feature (§32.11). Added free UX & trust indicators (§6.2.4). Added on-demand vs delayed service modes (§4.2). Expanded Admin Console (§38) with live map, token dashboard, AI-agent management and caching controls. Added §49 Cost-Effective Operating Principles and end-of-document Cost-Effectiveness Note. No features removed.

- v5.56: **Specialized Verticals & SEO Expansion.** Added §55 Specialized Verticals: §55.1 Car Parts & Auto Upgrade Ecosystem (multi-leg orchestration on existing find_worker engine — parts seller catalog match via skills.business_products → delivery rider match → optional installation/body work match; 13 new automotive skill tags; spare_parts_sourcer for key-market procurement; per-leg escrow; storefront integration; revenue via lead charges + Business tier + sponsored Daily Picks + B2B parts demand insights). §55.2 Security Personnel & Close Protection Booking (duration-based staffing: day/week/month/permanent; standard vs enhanced vetting — enhanced requires licensed firm + PSCN registration + firearm permit for armed; police escort via licensed firms not direct police booking; per-period escrow release with check-in/check-out; permanent placement fee model; 10 security skill tags; bookings + skill_flows table extensions). Expanded §53 SEO: §53.2.2.1 FAQ Content System (visible FAQ text + FAQPage JSON-LD as dual ranking lever for AI Overviews/Bing rich results/long-tail capture; auto-generation via Groq with human review; per-page FAQ editor; FAQ templates; long-tail keyword targeting per question); heading length guidelines added to audit (H1 ≤60, H2 ≤70, H3 ≤60, H4-H6 ≤50); §53.2.6 Content & Blog Engine (topical authority pillar+cluster; content calendar 2-4 posts/week; AI drafting via Groq with human review gate; content briefs; content freshness/relaunch; content gap analysis; content scoring 0-100); §53.2.7 The 30-Point SEO Audit Checklist (Backlinko/Ahrefs/Search Atlas: 10 technical + 12 on-page + 8 content points, scored A-F). 4 new DB tables: seo_faq_entries, seo_content_calendar, seo_content_briefs, seo_internal_links. Admin Console expanded with FAQ Manager, Content Calendar, Topical Map. Audit cron expanded with 30-point checklist + stale content + orphan detection. ECOSYSTEM.md expanded: category 5 + 10 security skill tags; category 32 + 13 car parts skill tags. All AI generation through lib/router.ts with hard quotas. No features removed; no public-facing language changed.

- v5.54: **SEO Management System (§53).** Added a full developer-ready technical specification for an admin-side SEO management system covering the entire discoverable surface (marketing site, Explore hub, 45 category pages, programmatic category×city/LGA×country pages, provider profile pages, blog/help/legal). Five-layer model: (1) Technical SEO infrastructure — env-aware `robots.txt`, multi-sitemap index pipeline, canonical/hreflang management, 301/302 redirect + 404 manager, `llms.txt` (Jeremy Howard 2024 standard) + `.md` page variants; (2) On-page SEO — per-page title/description/slug/canonical/robots from a `seo_pages` table, SERP preview, keyword targeting, heading + image-alt audits, internal-link manager; (3) Structured data — centralized schema.org/JSON-LD config with per-page injection (Organization, WebSite, Service, BreadcrumbList, FAQPage, Article, Product, LocalBusiness, AggregateRating, Review, HowTo) and rich-results validation; (4) Programmatic SEO — template-driven landing pages + provider profile pages with AI-assisted (Groq via `lib/router.ts`) unique copy and a human-review queue; (5) Generative Engine Optimization (GEO) for 2026/2027 — E-E-A-T signals, entity/knowledge-graph optimization, citable content patterns, `llms.txt` as the LLM entry point. Plus international/multilingual SEO (NG/GB/GH + ha/yo/ig/pcm/en-GB, hreflang matrix, NDPR + UK-GDPR compliance for tracking), monitoring & integrations (Google Search Console API, Bing Webmaster API, keyword rank tracker, backlink monitor, Core Web Vitals dashboard with INP which replaced FID in March 2024, SEO Health Score mirroring the SEOptimer A–F grade, automated crawl/audit cron), a full Admin Console UI (§53.5/§38), and a new data model (`seo_pages`, `seo_redirects`, `seo_keywords`, `seo_rankings`, `seo_backlinks`, `seo_schema_templates`, `seo_audit_runs`, `seo_settings`). Added an inline developer note to §32.6 diagnosing the root cause of the SEOptimer Usability F / Links F grades (hardcoded `head.ejs` title/description/lang, no canonical/OG/Twitter/JSON-LD/hreflang, no `robots.txt`/`sitemap.xml`). Added 3 action items (PA-18 HIGH head.ejs refactor, PA-19 HIGH robots+sitemap, PA-20 MEDIUM programmatic+GEO/llms.txt) to the §52 roadmap. All AI generation goes through the router with hard quotas (§49); all high-frequency reads use `cacheGet()` (§47); no PII in SEO tracking; no new analytics tools beyond Search Console/Bing. No features removed; no public-facing language changed.

---

## Cost-Effectiveness Note (2026–2032)

The architecture is deliberately designed so that variable cost per interaction stays low while every feature remains available. The combination of Presence Trick-Bridge, hybrid transport, FastText primary classification, free/open models, Redis hot paths and strict AI quotas allows the full feature set to operate at city scale and beyond without cost explosion. Revenue continues to be driven by token/lead fees, subscriptions, sponsored Daily Picks, B2B insights and later Super Agent services.

---

*End of Kurukoo Final Consolidated Blueprint v5.62*


## 21b. Autonomous Agent Runtime

> **Principle.** Kurukoo's intelligence is persistent and goal-directed. Conversation is one way to interact with the agent; it is not the boundary of the agent's existence. Kurukoo may continue authorised work across time and events while remaining bounded by user authority, policy, evidence, permissions, and the canonical Economic Request lifecycle.

### 21b.1 Definition and current implementation status

| Capability | Status | Boundary |
|---|---|---|
| Persistent `agent_goals` and concise `agent_goal_events` | **IMPLEMENTED** | Goals are owned by one phone/profile, optionally linked to one conversation and one canonical Economic Request. |
| Goal sources | **IMPLEMENTED / PARTIAL** | Conversation and deferred-request event re-entry are implemented. Reminder, proactive, provider, contributor, QR, and configured external events remain future event adapters that must call the same runtime. |
| Bounded planning and state evaluation | **IMPLEMENTED** | The runtime observes current canonical request state and selects a safe outcome: waiting, needs-user, completed, cancelled, or blocked. It does not expose hidden reasoning. |
| Tool registry and permission model | **IMPLEMENTED** | Read-only request, bounded memory, and reminders tools plus a guarded low-risk request re-check are allowed. Arbitrary SQL, files, shell, HTTP, credentials, admin access, payment, escrow release, dispatch, account deletion, and emergency notification are unavailable. |
| Memory integration | **IMPLEMENTED** | Tools use existing Living Memory bounded working context; no second memory store is introduced. |
| Economic Request and storefront | **IMPLEMENTED** | A goal observes or safely re-checks the canonical request/storefront only. Quote, payment, escrow, dispatch, fulfilment, rating, and dispute boundaries remain authoritative. |
| Waiting and worker re-entry | **IMPLEMENTED** | Due goals and due deferred intentions are processed by the existing background-service composition when `KURUKOO_AGENT_ENABLED=true`. |
| Proactive, reminder, provider, contributor, QR, channel event adapters | **BACKEND DEPENDENT** | Existing systems remain authoritative; each event source needs a deliberate adapter and preference/evidence review before it may wake a goal. |
| Autonomous network coordination | **FUTURE** | Any future agent-to-agent message must preserve identity, capability, request context, authorization, timestamp, and evidence, and must never enable arbitrary execution. |

### 21b.2 Goal, autonomy, and user authority

The runtime uses a minimal lifecycle: `active`, `waiting`, `needs_user`, `blocked`, `completed`, `cancelled`, `failed`, and `expired`. It derives request truth from the canonical Economic Request rather than duplicating payment, provider, or fulfilment state. A user may stop follow-up from the conversation inspector.

Autonomy levels are explicit: `observe`, `suggest`, `assist`, `act_with_confirmation`, and `act_within_permission`. Natural-language requests do not grant unlimited authority. A request to find a provider or taxi may create an objective, but it cannot authorize a charge, escrow release, dispatch, emergency contact notification, security change, or account deletion.

### 21b.3 Operational loop and evidence

The runtime follows: **observe owned state → retrieve bounded context → select an authorised tool → execute a domain service → record concise evidence → update goal state → wait, ask, or complete**. Events record an action, result, tool, evidence reference, and state transition; they do not store chain-of-thought, secrets, OTPs, payment credentials, raw audio, or unnecessary private memory.

A goal can wait when matching, quote, provider, fulfilment, or user-confirmation evidence is outstanding. Re-entry is cooldown-limited and action-limited. Retries are bounded and duplicate goal events use idempotency keys. Configurable safeguards are `KURUKOO_AGENT_ENABLED`, `KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE`, `KURUKOO_AGENT_MAX_RETRIES`, `KURUKOO_AGENT_MAX_CONCURRENT_GOALS`, `KURUKOO_AGENT_COOLDOWN_SECONDS`, and `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK`.

### 21b.4 Convergence and user experience

Text, Web Voice, QR contextual entry, and future configured channels converge on the same conversation and request identity. They do not create separate voice, QR, WhatsApp, Telegram, provider, referral, payment, or marketplace agents. The existing inspector presents a compact **Current objective** card with only evidence-backed activity and a **Stop follow-up** control; Kurukoo never pretends an activity completed unless the underlying service reports it.

### 21b.5 Production requirements

The runtime is feature-flagged off by default. Production activation requires an always-running Kurukoo application worker, policy-reviewed event adapters for each external source, notification preference checks, provider/connector evidence, and configured channel or push adapters before any external delivery claim. The default server worker is suitable for the present SQLite deployment; horizontally scaled production deployment requires a shared queue/lease before multiple worker replicas process the same due goal.

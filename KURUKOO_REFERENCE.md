# Kurukoo v5.41 — Technical Reference Guide

## Architecture Overview
- **Backend:** Node.js, Express 4, TypeScript (`src/index.ts`, `src/database.ts` → `kurukoo.sqlite` via `sql.js`).
- **Entry:** root `index.ts` validates env then bootstraps `src/index.js` (the Express app).
- **Frontend PWA:** Vanilla HTML/CSS/JS (`public/dashboard.html`, `public/js/kurukoo-primary-chat.js`, `public/js/kurukoo-workspace.js`).
- **Public Website:** EJS templates (`views/index.ejs`, `views/pricing.ejs`, `views/explore/index.ejs`, `views/explore/category.ejs`, …) with shared partials (`views/_partials/*`).
- **AI Intent Pipeline:** Regex → FastText (`models/kurukoo_intent.bin`, `src/services/fastTextService.ts`) → Groq (`src/services/groqService.ts`, Llama-3.1-8B-Instant) → Template fallback (`src/services/intentRouter.ts`).
- **Environment Variables:** `KURUKOO_PAY_PROVIDER`, `CREDIT_ECONOMY_ENABLED`, `DB_PATH`, `GROQ_API_KEY`, `WHATSAPP_TOKEN`, etc. (see `.env.example`).
- **Unified Messaging:** all messages across WhatsApp, PWA, and USSD are logged to the `messages` table.

## Core Economic Architecture
- `src/services/skillFlows.ts` is the canonical economic skill authority: skill → category → requirements → capabilities → shared Economic Request lifecycle.
- All economic categories use the same consumer flow: **conversation → intent → requirement capture → discovery → availability → quote → explicit confirmation → payment/escrow where applicable → fulfilment → completion → rating/dispute/Points/Memory**.
- Requirements are skill/category configuration, not separate product systems. Rides, food, keke/okada, repairs, cars, tickets, workers, products and creator/artist booking all use the same request machinery.
- Category-specific capabilities are composed onto the shared lifecycle only when the real-world transaction requires them (for example tracking for transport, evidence for repairs/vehicles, or contract/representation verification for creator bookings).

## Creator / Artist Rule
- **Artist/celebrity booking is not a privileged economic system.** `verified_artist` is a canonical `events-entertainment` skill.
- `src/services/artistBookingService.ts` is a policy adapter for genuinely artist-specific requirements: creator/artist identity and representation verification, event requirements, technical rider, travel requirements and negotiated terms.
- Matching, availability, quoting, customer confirmation, payment/escrow, fulfilment and dispute handling remain shared platform capabilities.
- A profile is never proof of availability or representation. Consumer booking requires verified representation, confirmed availability/terms and explicit customer confirmation before money/escrow is committed.
- Specialized artist admin tooling is permitted for provider verification/compliance and operations, but must not create a separate consumer booking experience or lifecycle.

## Core Data Architecture (Blueprint §4 Tight Integration Mandate)
- `memory_profiles` — single source of truth per phone (name, location, country, Points balance, tier, encrypted preferences/behavior, trust_score, grace_leads, verified_provider).
- `skills` — multi-skill tags per profile (source explicit|inferred, operation_mode, verified_artist, booking_mode, rating, jobs_completed).
- `skill_flows` — per-skill question sets, post-match action, payment model, fulfilment instructions, plus canonical requirements/capabilities derived from `skillFlows.ts`.
- `economic_requests` — universal economic request state and lifecycle; category-specific flows must project into this model rather than creating parallel economic state machines.
- `messages` — unified conversation history across channels.
- `provider_presence` / `user_behavior_signals` — real-time presence + learned signals.
- `ai_agents` — first-class AI agent users (mirrored into memory_profiles + skills).
- `privacy_bridge` — proxy-number mappings for number masking (§41).
- `escrow` — held funds with `created_at` for cooling-off timers (§43).
- **No category should introduce a parallel consumer identity or economic request system.**

## Key Internal vs External Terminology Mappings (v5.41)
| User-Facing (UI / Copy) | Internal (Code / DB) |
|---|---|
| Kurukoo App | PWA (`public/dashboard.html`) |
| Balance / Points & Top-ups | `memory_profiles.points_balance`, `pointsEngine.ts` |
| Kurukoo Circle | `money_circles`, `src/services/moneyCircle.ts` |
| Kurukoo Pulse / "Go Live" | `src/services/nearbyPulse.ts`, `pulse_sessions` |
| Kurukoo Pay | `wallet_balance_minor`, reload modal, `directWallet.ts` |
| Daily Picks | `src/services/dailyPicks.ts`, `success_stories` |
| Verified Artist | `skills.verified_artist`, `src/services/artistBookingService.ts` — a canonical economic skill, not a separate booking system |
| AI Agents | `ai_agents`, `src/services/aiAgentService.ts` |
| Privacy Bridge | `privacy_bridge`, `src/services/privacyBridge.ts` |
| Work Toggle | `memory_profiles.is_available` |

## Admin Console (`public/admin/*`)
13 pages: `ai-agents`, `commissions`, `content`, `dashboard`, `login`, `marketing`, `partnerships`, `pricing`, `referrals`, `revenue`, `social`, `users`, `analytics` — backed by `/api/admin/*` routes.

Artist/celebrity admin pages are operational tooling for verification, compliance and provider management. They do not define a separate consumer economic architecture.

## Build
- `npm run dev` → `tsx index.ts`
- `npm run build` → `tsc && npm run copy:public` (copies `public/`, `views/`, `locales/` into `dist/`)
- `npm run lint` → `tsc --noEmit` (passes with 0 errors under strict/NodeNext)

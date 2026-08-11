# Kurukoo Homepage Copy — Marketing Reference

**Version:** 2.1
**Date:** 2026-08-11
**Status:** Aligned with the verified homepage implementation and its no-fabrication preview policy
**Owner:** Kurukoo Brand  
**Blueprint reference:** §32.6 (v5.55), FRONTEND_PAGES.md

---

## Overview

This document records the current homepage copy reference for `kurukoo.ai.studio`. Future material brand changes require review; implementation must not present invented providers, distances, availability, activity, transactions, or social proof as live data.

**Positioning:** Kurukoo is a multi-sided utility product that uses conversational AI to deliver on-demand SaaS tools straight to the informal economy. It is built around the warm, highly personal positioning of a trusted neighbor who knows everyone in the area and is always ready to assist.

**Tone:** Bold, warm, human, neighborly. No engineering jargon. No "loyalty tokens." Avoid overly corporate SaaS speak, while clearly communicating that under the hood, Kurukoo is a powerful multi-sided utility.

---

## Header / Navigation

> **Updated to match live `nav.ejs`.** The previous version had an outdated 3-link nav. The live site uses a 7-item nav with a Platform mega-dropdown.

| Item | Label | Notes |
|---|---|---|
| Logo | Kurukoo | Wordmark + icon |
| Nav link 1 | Features ▼ | Public feature and service entry links |
| Nav link 2 | How It Works ▼ | Public explanation and role-oriented journey links |
| Nav link 3 | Discover ▼ | Nearby Pulse discovery surface |
| Nav link 4 | Earn ▼ | Earning and skills entry links |
| Nav link 5 | Resources ▼ | Educational content library, API docs, legal, and blog |
| Nav link 6 | Blog | Public articles |
| Right side | User account | Login entry point |
| CTA button | Start Chatting | Primary action. Opens the existing channel/onboarding gateway. |

> **Developer note:** The public navigation and onboarding gateway use controller-bound event listeners, not inline click or submit handlers. Visual styling remains in shared stylesheets.

---

## Hero Section

**Headline:**  
The trusted neighbor who knows everyone.

**Subhead:**  
Meet Kurukoo — a conversational utility that helps you find trusted people, get everyday things done, offer your skills, and discover useful opportunities nearby.

**Primary CTA:**  
[Start chatting] (links to `/chat`)

**Secondary CTA:**  
[Dial *7000#]

**Trust line (small, under CTAs):**  
⭐ Built for everyday coordination • No app download required • Privacy first

---

## Role Priming Section (3 Cards)

**Section headline:**  
What do you want to do today?

**Section intro:**  
One conversation. Every role. No profile switching, no new apps. Kurukoo is like that reliable, connected neighbor who knows every plumber, okada rider, and shopkeeper in town — always ready to assist you or find you some good work.

---

### Card 1 — Consumer

**Headline:**  
Request a service

**Body:**  
Need a ride, repair, delivery, food, a worker, or something else? Tell Kurukoo what you need and let the conversation fill in the details.

**CTA button:**  
Request a service

**Pre-filled chat prompt (on click):**
> "Hi, I need help with [tell me what you need]"

---

### Card 2 — Provider

**Headline:**  
Offer your skills

**Body:**  
Ride, repair, cook, build, deliver, design, teach, sell or help. List your skills once and let Kurukoo help people find you.

**CTA button:**  
Offer your skills

**Pre-filled chat prompt (on click):**
> "Hi, I want to offer my skills. I do [your skill]"

---

### Card 3 — Business

**Headline:**  
Grow my business

**Body:**  
Turn your products and services into a discoverable local offering without forcing you into a complicated dashboard.

**CTA button:**  
Grow my business

**Pre-filled chat prompt (on click):**
> "Hi, I want to grow my business on Kurukoo"

---

## Living Profile Section (3 Cards)

**Section headline:**  
A helper who learns a little more every day.

**Subhead:**  
No forms. No questionnaires. Kurukoo learns from every conversation and gets smarter every time you come back.

---

### Card 1 — A Friend Who Remembers

**Headline:**  
Your profile lives and grows

**Body:**  
Whether you're ordering dinner, booking a carpenter, or offering your own skills, everything links to a single secure profile. It remembers your favorite spots, typical rates, and trusted people just like a real neighbor.

---

### Card 2 — Natural Conversations

**Headline:**  
Just talk. No menus. No buttons.

**Body:**  
Speak or type naturally in English, Pidgin, or local phrases. Your neighborhood guide understands your intent, coordinates deals, and handles the complicated math behind the scenes.

---

### Card 3 — Proactive Opportunities

**Headline:**  
Always looking out for you

**Body:**  
Always looking out for you. It surfaces timely alerts, nearby mobile vendors, and earning opportunities matching your skills — right when you need them.

---

## Nearby Pulse Section (Map Preview)

**Section headline:**  
See how nearby help can work

**Subhead:**  
When you choose to share an approximate area, Kurukoo can help surface relevant people, services and opportunities. Exact locations stay private.

**Map preview element:**  
Illustrative, non-live map preview on the homepage; the full discovery experience is available at `/discover`.

**Illustrative request pins:**
- 🍊 Food request
- 🔧 Repair request
- 🛵 Ride request
- 🤖 Kurukoo guide

> The preview must be visibly labelled illustrative and must not present names, distances, availability, ratings, provider counts, transactions, or activity as live data without a real source.

**CTA button below map:**  
[Explore the full map →] (links to `/:country/discover`)

**Privacy notice (small, below CTA):**  
Illustrative preview. When active, exact locations remain private and you control when you go live.

---

## "What Can You Do on Kurukoo?" Section (Scrollable Cards)

**Section headline:**  
Everything you need, one conversation away

**Subhead:**  
Swipe through what Kurukoo can do for you. Tap any card to start.

**Card design:**  
Horizontal scroll on mobile (swipeable, snap-scroll), grid on desktop (4-6 columns). Each card: emoji icon, title, subtle border, tap effect.

**Cards (grouped for scannability; rendered as one continuous scroll set):**

| # | Title | Icon | Links to | Group |
|---|---|---|---|---|
| 1 | Order Food | 🍜 | Explore: food ($55.4 flow) | Everyday Food |
| 2 | Get Groceries | 🛒 | Explore: groceries ($55.4 flow) | Everyday Food |
| 3 | Get Errands Done | 🏃 | Explore: errands | Everyday Home |
| 4 | Logistics & Delivery | 📦 | Explore: logistics | Everyday Home |
| 5 | Send Parcels | 📮 | Explore: logistics | Everyday Home |
| 6 | Fuel Delivered | ⛽ | Explore: errands | Everyday Home |
| 7 | Get a Ride / Mobility | 🛵 | Discover: mobility layer | Everyday Home |
| 8 | Home Services (plumbing, electrical, cleaning) | 🏠 | Explore: repairs-maintenance | Home & Repairs |
| 9 | Generator / Appliance Repairs | 🔧 | Explore: repairs-maintenance | Home & Repairs |
| 10 | Solar Installation | ☀️ | Explore: solar-energy | Home & Repairs |
| 11 | Auto Repair & Car Parts | 🚗 | Explore: automotive-mechanics | Home & Repairs |
| 12 | Access Health & Care | 🏥 | Explore: health-medical | Health, Money & Safety |
| 13 | Money Circle (Ajo/Esusu) | 💰 | Explore: finance-tax | Health, Money & Safety |
| 14 | Emergency Services / SOS | 🚨 | Explore: emergency-dispatch | Health, Money & Safety |
| 15 | Security & Close Protection | 🛡️ | Explore: emergency-dispatch (security) | Health, Money & Safety |
| 16 | Neighborhood Safety Alerts | 🚔 | Explore: community | Health, Money & Safety |
| 17 | Find Work / Gigs | 💼 | Explore: gigs | Earning, Building & Community |
| 18 | Sell Locally | 🏪 | Explore: classifieds ($55.4 flow) | Earning, Building & Community |
| 19 | Reach Customers / Advertise | 📢 | Explore: reach-reference | Earning, Building & Community |
| 20 | Cover Events / Get Paid | 🎥 | For You: Contributor | Earning, Building & Community |
| 21 | Sports, Matches & Clubs | ⚽ | Explore: sports-recreation | Earning, Building & Community |
| 22 | Community / Groups (Kuru Circles) | 👥 | Explore: events-entertainment | Earning, Building & Community |
| 23 | Get Price Alerts | 💲 | Explore: price-check | Info, Alerts & Entertainment |
| 24 | Check Key Services (NIN, CAC) | 📋 | Explore: government | Info, Alerts & Entertainment |
| 25 | Check Exam Results (JAMB/WAEC/NECO) | 🎓 | Explore: education-learning | Info, Alerts & Entertainment |
| 26 | Reload Airtime & Data | 📱 | Explore: communication | Info, Alerts & Entertainment |
| 27 | Universal Remote (TV/Devices) | 📺 | Resources guide | Info, Alerts & Entertainment |
| 28 | Know What's Happening / Events | 📅 | Discover: events layer | Info, Alerts & Entertainment |
| 29 | Hawkers Near You | 🥭 | Explore: cravings | Info, Alerts & Entertainment |
| 30 | Prayers & Spiritual | 🤲 | Explore: spiritual | Info, Alerts & Entertainment |

> **Developer note:** Cards are algorithmically ordered per user if logged in, based on `memory_profiles.inferred_roles` and `behavior_patterns`. For anonymous users, default order as listed above. Each card links to an Explore category page containing a chat UI that can onboard or assist the user.
>
> **Ordering-flow note:** The "Order Food", "Get Groceries", "Sell Locally", and parts/equipment cards all terminate in the **shared Universal Vendor Product Ordering Flow** (§55.4, BLUEPRINT) — extract (item+quantity+location) → `find_worker` match against `skills.business_products` → product card → escrow hold → optional `dispatch_rider` second leg → completion → escrow release → reorder signal. Cards must never be wired to a per-skill stub; the same flow serves suya vendors, bakeries, grocers, car-parts sellers, and storefronts.

---

## "Your Day with Kurukoo" Section (Timeline — replaces pricing)

**Section headline:**  
From morning move to evening chop

**Subhead:**  
One conversation can help coordinate the day without asking you to juggle apps or tabs.

**Illustrative timeline (6 moments, vertical on mobile, horizontal scroll on desktop):**

| Time | Moment | Example prompt |
|---|---|---|
| 🌅 6:30 AM | Wake up | "Need a lift this morning? Tell me where you are heading." |
| 🍲 12:00 PM | Lunch break | "Looking for lunch? Tell me what you would like to order." |
| 🔧 2:00 PM | Get it fixed | "Describe the repair and your area. I can help start the search." |
| 💰 4:00 PM | Hustle time | "Want to offer a skill? Tell me what work you do." |
| 📦 6:00 PM | Send it | "Share the pickup and delivery areas to coordinate a parcel." |
| 🌙 9:00 PM | Wind down | "Set up tomorrow’s request whenever you are ready." |

**CTA below timeline:**  
[Start your day with Kurukoo →]

> **Developer note:** This section replaces the previous pricing table on the homepage. The homepage's job is to sell the experience, not the price. The pricing page (`/:country/pricing`) remains accessible from the nav for users who want pricing details.

---

## How It Works Section (Teaser)

**Headline:**  
How Kurukoo works

**Subhead:**  
Three simple steps. No downloads. No complicated setup.

| Step | What happens | Visual |
|---|---|---|
| 1 | You send a message: "I need a plumber" | Phone → WhatsApp message |
| 2 | Kurukoo finds a trusted provider nearby, coordinates payment and delivery | Kurukoo matches + escrow |
| 3 | The job gets done. You confirm. Everyone gets paid. | Checkmark + payment release |

**CTA:**  
[See How It Works in detail →]

---

## Why Kurukoo Section (Brief)

**Headline:**  
Why Kurukoo?

**Body:**  
The world is moving to super apps — one app for everything. But in Africa, data is expensive, phones are basic, and downloading ten different apps is not an option. Kurukoo flips the model: one conversation replaces all of them. WhatsApp, USSD, or PWA — same conversation, same profile, same memory. Your payment is held in escrow until the job is done. 1 Point = ₦1. No expiry. Works on any phone.

> **Developer note:** The previous 5-differentiator cards (One Conversation, One Profile, Kurukoo Guarantee, Points That Matter, Works on Any Phone) have been absorbed into the Living Profile, Nearby Pulse, "What Can You Do?", and "Your Day with Kurukoo" sections above. This brief paragraph serves as a transition into Social Proof. If individual differentiator cards are still wanted, they can be added as a compact accordion below this paragraph.

---

## Social Proof Section

**Status:** Not rendered on the current homepage.

> Do not add testimonials, customer counts, city coverage, earnings, response times, provider counts, ratings, or a “live activity” feed without verified source data, explicit consent where required, and a live rendering contract.

---

No testimonials, customer counts, city claims, earnings stories, response-time examples, or activity-feed copy is approved for the current homepage. Add any future social proof only after a verified source, rendering contract, consent review, and brand approval are documented.

---

## Final CTA Section

**Headline:**  
Ready to get going?

**Subhead:**  
Open WhatsApp. Send a message. That's it.

**Primary CTA:**  
[Open WhatsApp Chat]

**Secondary CTA:**  
[Try on USSD *7000#]

**Small print:**  
No download. No registration form. No credit card. Just start.

---

## Footer

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| **Kurukoo** | **Discover** | **Resources** |
| Wake up. Get going. | Explore Categories | User Guides |
| utilityapp.ai.studio | Discover Map | Provider Guides |
| | For You | Business Guides |
| | Nearby Pulse | API Docs |

| Column 4 | Column 5 | Column 6 |
|---|---|---|
| **Product** | **Legal** | **Connect** |
| How It Works | Terms of Service | Contact Us |
| Pricing | Privacy Policy | Careers |
| Help Centre | Cookie Policy | Partners |
| | | Advertise |

| Column 7 |
|---|---|
| **Channels** |
| WhatsApp: 7000 |
| USSD: *7000# |
| PWA: kurukoo.com |

| Social | |
|---|---|
| Twitter / X | @kurukoo |
| Instagram | @kurukoo |
| LinkedIn | Kurukoo |

**Newsletter signup (optional):**  
> "Get updates about new features and provider stories."  
> [Email input] [Subscribe]

---

## Copy Guidelines

1. **Never use:** "loyalty tokens," "utility platform," "credit," "points system" as separate from Kurukoo.
2. **Always use:** "Points" with capital P. "Kurukoo Guarantee." "One profile. Every hustle."
3. **Tone:** Confident but not arrogant. Human but not slang-heavy. Clear but not dumbed-down.
4. **Length:** Headlines max 8 words. Body copy max 2 sentences per paragraph. Mobile-first.
5. **Accessibility:** All CTAs must work on feature phones (USSD) and smartphones (WhatsApp/PWA).
6. **No inline styles:** All visual styling must use CSS classes from shared stylesheets. No `style="..."` attributes in production HTML. See FRONTEND_PAGES.md §Responsive Design Mandate.
7. **Images:** All images must have `alt` text (auto-generated via §53.2.3 if missing), `loading="lazy"`, `width`/`height` attributes, and WebP/AVIF format with responsive `srcset`.
8. **Responsive:** All sections must work at 360px viewport first. Test at 360px, 768px, and 1024px breakpoints.

---

## File Structure

- `homepage_copy.md` — this document (v2.0)
- `how_it_works_copy.md` — detailed How It Works page content
- `FRONTEND_PAGES.md` — complete page registry for the entire ecosystem (all public, PWA, and admin pages)
- `pricing_copy.md` — pricing page content (to create)
- `explore_copy.md` — explore hub content (to create)
- `BLUEPRINT.md` — master technical blueprint (§32.6 for page architecture)

---

*Last updated: 2026-08-11 | Version 2.1 | Blueprint v5.55*

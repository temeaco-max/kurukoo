# Kurukoo Advertising and Monetisation Placement Architecture Audit

**Audit date:** 2026-08-13
**Scope:** Existing PR #31 convergence branch only.
**Decision:** `adManager` remains Kurukoo’s sole canonical paid-campaign and placement authority. No parallel ad, topic-ad, chat-ad, opportunity-ad, forum-ad, or second commercial targeting engine is justified.

## Existing owners and reusable capability

| Existing owner | Reusable responsibility | Current gap to close |
|---|---|---|
| `src/services/adManager.ts` | Campaign persistence; active/paused/completed state; canonical category and keyword matching; placement-source/disclosure fields; bounded credits budget/spend. | No reusable placement catalogue, device/surface eligibility, frequency cap, safety-exclusion policy, event ledger, occupancy, creative lifecycle, or provider-neutral fallback resolution. |
| `src/routes/adminRoutes.ts` + `public/admin/marketing.*` | Authenticated Admin Control Room campaign creation, pause/activation, category selection, and marketing/commercial evidence display. | Does not expose inventory, placement occupancy, placement assignment, aggregate events, or placement reporting. |
| `src/services/affiliateService.ts` + `affiliateRoutes.ts` | Evidence-backed merchant/offer activation, mandatory disclosure, owner-hashed click events, verified conversion evidence, and aggregate metrics. | Affiliate offers are workspace-only; no canonical placement fallback can select an eligible offer by permitted public category/context yet. |
| `src/services/commercialMetrics.ts` | Truthful reporting boundary: campaigns/budgets are not advertising revenue; impressions/clicks were intentionally unmeasured. | Must consume real placement event evidence rather than estimate ad performance. |
| `src/services/opportunityEngine.ts` | Existing Daily Picks sponsored panel projection from active disclosed campaign records; user action/dismissal state. | It is intentionally a private owner-scoped suggestion surface, not a general public inventory engine. It must remain separate from personal suggestions and should reuse—not replace—placement eligibility. |
| `src/services/intentRouter.ts` | Existing sponsored suggestion payload alongside non-private intent suggestion cards. | Raw private chat text currently drives matching. New canonical placement policy must prevent third-party commercial placement in the private message stream and permit only explicit, clearly separated safe-adjacent commerce cards based on a narrow approved context. |
| `src/routes/publicRoutes.ts` + Explore views | Existing Explore category campaign injection and labelled sponsored cards. | It is hand-wired to Explore and has no shared slot/cap/exclusion/event model. |
| `src/services/productSourcing.ts` + `economicParticipants.ts` | Evidence-backed provider product listings and canonical Economic Request seller/offer linkage. | Must not be converted into ad inventory. It may be a context source or organic result, never a paid-placement authority. |

## Current real projections

| Surface | Current commercial state | Treatment in convergence |
|---|---|---|
| Explore and category pages | Active campaigns render as disclosed cards after category cards. | Migrate to canonical placement resolution; preserve clear separation and no provider/quote assertions. |
| Authenticated Daily Picks | One dedicated disclosed campaign panel separated from personal suggestions. | Preserve as a safe owner-scoped sponsorship placement; apply shared campaign/placement eligibility and caps. |
| Authenticated External offers | Disclosed evidence-backed affiliate offers with recorded visit clicks. | Reuse affiliate owner as fallback for explicitly affiliate-enabled safe slots only. |
| Chat | Intent router can attach sponsored suggestions, but no ads belong in message content. | Remove any direct private-query commercial targeting from the general chat path; only explicit safe-adjacent commercial contexts may request a placement. |
| Homepage, Resources, Topics, Discover, provider pages | No canonical reusable placement projection. | Add only approved public-content placement slots. No fake campaigns, blank boxes, or programmatic code without a configured provider. |
| Request, safety, auth, payment, account, private media, voice, moderation, admin operational pages | No placement. | Permanent advertising exclusion surfaces. |

## Safety and truth constraints

1. **Private/sensitive exclusion:** no placement based on raw messages, Memory, safety, medical, legal, financial, emergency, moderation, authentication, payment, voice, attachment, export, or deletion context. No commercial item is rendered inside the chat message stream.
2. **Disclosure:** every result states `Sponsored`, `Advertisement`, `Promoted`, or the affiliate disclosure supplied by the canonical affiliate owner. It must never resemble a Kurukoo response, verified-provider fact, price, stock, booking, payment, delivery, fulfilment, or safety instruction.
3. **Provider neutrality:** programmatic demand is an unconfigured adapter state until actual provider credentials, review, and policy controls exist. It produces no placeholder, no simulated advertiser, and no paid-delivery assertion.
4. **Measurement truth:** exposure/click records are aggregate, placement-scoped, and cannot contain raw message, Memory, or personal profile data. Event counts are evidence, not revenue or conversion unless the appropriate canonical billing/conversion owner records it.
5. **Frequency and density:** at most one resolved placement per slot and deterministic page/session cap. No adjacent clusters, no hero-CTA competition, no private-workspace operational panels.

## Implementation decision

Extend `adManager` additively with a compact placement catalogue and event ledger. It will resolve only campaign records that are active, disclosed, budget-eligible, placement-eligible, and safe for a caller-provided public/shared context. It may then select a relevant existing affiliate offer only for an explicitly affiliate-enabled placement. It will otherwise resolve **nothing**. Existing admin routes/control room, Explore, Daily Picks, and the affiliate commercial boundary will be extended rather than duplicated.

The first safe catalogue should cover public Explore/category inline, public Resources/article inline/end, public Topics inline/end, public Discover feed, public provider-related promotion, authenticated Daily Picks sponsorship, authenticated External Offers affiliate context, and a **chat-adjacent explicit commerce result slot only**. The latter is never a private conversation/message-stream placement and has no access to raw free-form chat text.

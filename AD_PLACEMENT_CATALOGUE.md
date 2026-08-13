# Kurukoo Canonical Advertising Placement Catalogue

**Status:** Implementation contract for the existing `adManager`.
**Scope:** A placement is a reusable, configured projection point. It is not an ad-network integration, content-ranking system, provider directory, inventory owner, Topic feature, or chat message.

## Lifecycle

> **Campaign → embedded creative → canonical targeting → placement eligibility → disclosure → measured visible impression/click → bounded delivery-unit budget → aggregate reporting.**

The existing campaign record remains the campaign and its current title, description, image, CTA, disclosure, source, and evidence fields remain its embedded creative. A future separate creative record, if justified by genuinely multiple reviewed creatives, must remain in `adManager`; it is not required to make the current bounded placement lifecycle truthful.

| Rule | Contract |
|---|---|
| Canonical owner | `src/services/adManager.ts` owns the placement catalogue, campaign assignment, eligibility, frequency, aggregate event evidence, and provider-neutral programmatic boundary. |
| Campaign eligibility | Active campaign; active placement assignment; correct source; canonical category/keyword match where permitted; within delivery-unit budget; required disclosure; no safety exclusion. |
| Fallback order | **Direct/sponsored campaign → eligible affiliate offer → configured programmatic adapter → no card.** Programmatic is disabled by default and never supplies invented content. |
| Budget truth | Delivery-unit budget is a cap on measured campaign exposures, not advertising revenue, billed spend, settlement, or a payment confirmation. A zero budget cannot serve an active campaign. |
| Event truth | A visible in-viewport event may be recorded as an `impression`; an explicit CTA interaction may be recorded as a `click`. Event counts are aggregate evidence, not viewability certification, conversion, commission, or fiat revenue. |
| Identity/privacy | Events retain only a server-hashed opaque browser-session value, placement/campaign reference, device class, canonical category, and timestamp. No phone, profile, raw query, message, Memory, topic body, attachment, voice, or request text is retained in advertising metrics. |
| Frequency | Per-campaign and per-placement session caps are deterministic. A visitor can always receive no placement. |
| Disclosure | `Sponsored`, `Advertisement`, `Promoted`, or the existing affiliate disclosure is rendered before or with every card. |

## Placement catalogue

| Placement ID | Surface and position | Formats/devices | Sources allowed | Context allowed | Limit and exclusions |
|---|---|---|---|---|---|
| `home_inline` | Public homepage below primary request explanation; never hero CTA | Responsive native/banner; all devices | Direct, affiliate, future programmatic | Public generic/category only | 1/session; never competes with Start Chat CTA. |
| `explore_inline` | Public Explore list after meaningful organic category content | Native/banner; all devices | Direct, affiliate, future programmatic | Canonical category | 1/session; never adjacent to another card. |
| `category_inline` | Public Explore category page after organic category content | Native/banner; all devices | Direct, affiliate, future programmatic | Canonical category | 1/session; category must be eligible. |
| `discover_feed` | Public Discover/Nearby feed after organic results | Native card; all devices | Direct, affiliate | Public category and coarse declared country only | 1/session; no precise location, no Radar map overlay, no provider-result styling. |
| `topic_inline` | Public Topic list/content interval | Native/banner; all devices | Direct, affiliate, future programmatic | Public Topic canonical category only | 1/session; no public body/text transmission, no sensitive category. |
| `topic_end` | Public Topic detail end, after editorial/community content | Related native; all devices | Direct, affiliate | Public Topic canonical category only | 1/session; no reply/messaging placement. |
| `resource_inline` | Public resource/article after meaningful editorial content | Native/banner; all devices | Direct, affiliate, future programmatic | Public resource canonical category only | 1/session; no policy/legal/security guide placement. |
| `resource_end` | Public resource/article end | Related native; all devices | Direct, affiliate | Public resource canonical category only | 1/session; no duplicate with inline slot. |
| `provider_related` | Public provider profile below organic provider facts | Related native; all devices | Direct, affiliate | Provider skill category only | 1/session; never labelled/provider-styled as an organic provider, never affects verification. |
| `workspace_daily_picks_sponsor` | Authenticated Daily Picks dedicated sponsored panel, separate from personal suggestions | Native card; all devices | Direct only | Safe canonical request/interest category only; no raw intent | 1/day/session; excluded for safety, sensitive, payment, dispute, or account workflows. |
| `workspace_external_offer` | Authenticated External Offers panel | Affiliate card; all devices | Affiliate only | Explicit country/category filter | Existing affiliate disclosure/click owner; no campaign duplication. |
| `chat_commerce_result` | Explicit, outside-message commerce result area only | Native card; all devices | Direct, affiliate | Canonical non-sensitive skill/category selected by the user’s structured flow; never raw query | 1/session; no general chat, message stream, voice, safety, emergency, health/legal/financial, payment, or active request fulfilment. |

## Permanent no-ad conditions

There is no configured placement for authentication/OTP, login, administrative operations, account/security/privacy/export/deletion, chat message stream, private attachments, voice/call, messages/conversations, safety/emergency, health/legal/financial-sensitive flow, payment/escrow/quote/dispute/fulfilment, provider verification, moderation/reporting, task submission, or error/security pages. A placement request for an unknown, inactive, or excluded identifier resolves to an empty result.

## Context contract

Context is a narrow object controlled by the caller:

```ts
{
  placementId: string;
  category?: CanonicalEconomicCategory;
  country?: ISO_3166_1_alpha_2;
  device?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: opaque_random_browser_session;
  safeContext?: 'public_content' | 'workspace_sponsor' | 'explicit_commerce_result';
}
```

The resolver rejects arbitrary keywords for public/user-facing calls. It accepts only canonical categories and coarse country values. The only internal keyword-compatible projection retained is existing `adManager.matchAdCampaigns` compatibility for current controlled server flow; new placements will use the narrower category-aware resolver. The resolver never forwards context to an external advertiser or provider.

## Provider-neutral external boundary

`KURUKOO_PROGRAMMATIC_AD_PROVIDER=none` is the default and means there is no programmatic card, SDK, remote script, or fabricated placeholder. The implementation may expose a provider-neutral `programmatic_unconfigured` diagnostic state only to the administrator. A provider can be activated only after a real account, policy review, consent/privacy assessment, domain verification, approved format configuration, and acceptance/error callback contract are supplied. Overlay formats—including anchors, vignettes, and side rails—are intentionally absent from this launch catalogue.

## Measurement and commercial models

Current supported **measurement** is impression and click evidence for direct placements and existing affiliate click/conversion evidence. Current supported **commercial models** are disclosed direct/sponsored delivery-unit budgets and existing affiliate revenue-share evidence. CPM/CPC/CPA/fixed-sponsorship labels may be stored as campaign pricing intent, but Kurukoo cannot claim collected advertising revenue, settled spend, conversion, or commission unless its existing payment/affiliate conversion owners have corresponding verified evidence.

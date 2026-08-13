# Advertising Placement Research Notes

**Date:** 2026-08-13
**Purpose:** Translate proven publisher patterns into Kurukoo’s existing commercial architecture without importing a separate advertising stack.

| Source | Verified finding | Kurukoo consequence |
|---|---|---|
| [Google AdSense Program policies](https://support.google.com/adsense/answer/48182?hl=en) | Publishers must not use deceptive implementations, artificially inflate impressions/clicks, or place units where they can be confused with navigation; sites must remain easy to navigate. | Every commercial projection requires explicit disclosure, an unambiguous visual boundary, canonical impression/click accounting, and no incentives or simulated engagement. |
| [Google AdSense side rail guidance](https://support.google.com/adsense/answer/16531757?hl=en-GB) | Side-rail overlays are desktop-only, configurable, experimentally deployable, and can exclude defined page areas. Google documents separate in-page, overlay, and intent-driven format families. | Kurukoo should model format/device eligibility and safety exclusions as placement metadata. It must not render provider-specific overlay code unless a real provider is configured; private chat, safety, auth, payment, and other protected surfaces are excluded. |
| [FCM note retained separately](./FCM_EXTERNAL_CONTRACT_NOTES.md) | External capabilities need bounded, truthful acceptance/evidence states rather than fabricated delivery claims. | The same truthfulness principle applies to programmatic provider integration: unconfigured providers produce no invented campaign or paid-ad state. |

## Extracted safe patterns

The adaptable pattern is one canonical placement catalogue with responsive format metadata, explicit disclosure, frequency caps, contextual matching based only on permitted public/shared or request-owned commercial context, and deterministic fallbacks. A placement is not an ad network and is not guaranteed to render. The ordered projection policy should be: **eligible direct sponsorship → disclosed affiliate/native opportunity → configured provider-neutral programmatic adapter → no placement**.

Private messages, raw memory, safety flows, emergency work, authentication/OTP, payment confirmation, dispute/moderation, account deletion/export, attachments, voice, and any sensitive context are excluded categorically. Commercial cards must sit outside the assistant message stream and never resemble an assistant answer, verified-provider statement, payment state, or emergency instruction.

## Sources

1. [Google AdSense Program policies](https://support.google.com/adsense/answer/48182?hl=en).
2. [Google AdSense: About side rail ads](https://support.google.com/adsense/answer/16531757?hl=en-GB).

## Local direct-sold and community-placement findings

| Source | Verified finding | Kurukoo adaptation |
|---|---|---|
| [Nairaland targeted ads](https://www.nairaland.com/howtoplaceads) | The public workflow separates creative upload, approval, prepaid credit, relevant-section placement, automatic pause on credit exhaustion, and reports for spend/clicks/impressions. One creative can have multiple placements; full sections leave placements pending. | Reuse Kurukoo campaign approval/status, payment truth boundaries, ad campaign records, and commercial metrics. Add placement data and eligibility instead of a distinct “section ads” engine. Do not claim paid spend or credit settlement until the current canonical payment adapter confirms it. |
| [Nairaland rate inventory](https://www.nairaland.com/adrates) | It exposes finite, category-specific inventory and rate variation by demand. | Treat placement occupancy and priority as canonical metadata. Kurukoo may support direct sponsorship/category pricing only where campaign budget and payment evidence exist; no hard-coded rate card or simulated inventory is justified today. |
| [Reddit for Business](https://www.business.reddit.com/) | The platform frames advertising around users’ expressed topic/conversation interest and provides performance measurement for campaigns. | Use only permitted public/shared content context such as public Topic categories, Resources, public Discover category, and provider/product category. Never expose raw private conversation, Memory, safety, health/legal context, or personal attributes to advertisers. |

## Design decision from research

Kurukoo’s placements will be **provider-neutral projections** of the existing commercial campaign/opportunity/affiliate systems. Direct-sold sponsorship may use the existing campaign lifecycle; affiliate fallback uses only already-disclosed affiliate offers; programmatic integration remains an unconfigured adapter boundary unless the operator supplies the actual provider account and policy review. The placement service must emit no card when no eligible, configured, and disclosed commercial record exists.

Additional sources:

3. [Nairaland: How to Place Targeted Ads](https://www.nairaland.com/howtoplaceads).
4. [Nairaland: Estimated Advert Rates](https://www.nairaland.com/adrates).
5. [Reddit for Business](https://www.business.reddit.com/).

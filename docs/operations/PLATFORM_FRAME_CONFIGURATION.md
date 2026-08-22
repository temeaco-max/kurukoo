# Platform frame configuration

The following deployment variables activate the newly converged capability adapters. Empty means the adapter remains fail-closed or local-only.

## Provider communications

```text
FF_WEBRTC=false
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_URL=
TURN_SERVER_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TRICKBRIDGE_BASE_URL=
TRICKBRIDGE_API_KEY=
KURUKOO_PROVIDER_GPS_INTERVAL_MS=15000
```

WebRTC is the preferred provider-session transport for realtime text/data/events and, where browser/app capabilities and relay conditions permit, voice/video. `KURUKOO_PROVIDER_GPS_INTERVAL_MS` controls the sparse provider GPS sampling window; Trickbridge can preserve/aggregate movement between meaningful samples.

`TWILIO_*` enables real outbound masked calling through the existing provider communication session. Kurukoo still owns the communication-session state; Twilio supplies transport and is a fallback when direct WebRTC voice is unavailable or not suitable. Masked voice is arrival-gated for provider jobs.

`TRICKBRIDGE_*` enables the optional external provider-tracking bridge. Without it, the canonical provider session still records location locally and can use the existing WebRTC signalling boundary when enabled.

## Catalogue sources

Provider/business/WhatsApp/store sources are registered as unverified declarations. Verification is derived from the source authority and must not be self-assigned by an authenticated user. Affiliate sources are operator-controlled.

## Agent network commerce

POS/field agents are roles in the canonical party/commercial network. Points top-ups create a payment intent through the existing payment authority and are credited only after a verified payment webhook/evidence authority. Agent commission is recorded in the existing commercial ledger and can accumulate toward an OPay, Moniepoint or approved manual payout adapter.

```text
customer/provider/business
        ↓
agent-assisted Points sale
        ↓
verified settlement
        ↓
Points credit
        ↓
commission accrual
        ↓
agent payout request
```

Provider lead charges are attached to the actual provider-match/acceptance event in the Economic Request dispatch path; completion/review confirms the outcome without a second lead debit.

## Discover category monetisation

`/api/discover/category/:category` composes canonical inventory, category-targeted sponsored placements and agent-network availability. Sponsored inventory remains labelled and uses the existing Ad Manager counters.

## AI

The current AI router remains the canonical orchestration layer. Do not add another gateway for Groq, Gemini, OpenRouter or Mistral. Provider adapters are capacity sources selected using inference task/complexity, provider health, quotas, free/included capacity where known, rate limits, latency and cost/budget context.

`KURUKOO_AI_FREE_FIRST=true` means eligible free/included hosted capacity is considered before paid Mistral reasoning. An environment-level Mistral primary setting does not bypass the automatic capacity broker; an explicit caller/provider preference may select Mistral. When a provider's included allowance is exhausted, its configured PAYG policy determines whether it remains eligible.

## Mobile

The Expo client parity registry must be updated whenever any capability becomes consumer-visible. New server capabilities are represented as `commerce-network`, `catalogue`, and `provider-communications` so native screens can be built later without a backend contract rewrite.

## Completion evidence

Repository readiness does not imply real-world provider activation. Live WebRTC relay interoperability, Twilio masking, Trickbridge tracking, payment webhook settlement, OPay/Moniepoint payout delivery and AI provider credentials must be verified in staging/production using the actual deployment configuration before being shown as live in user-facing surfaces.
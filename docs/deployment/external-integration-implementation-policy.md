# External Integration Implementation and Activation Policy

**Status:** Locked repository policy.

**Owner:** Kurukoo canonical service boundaries.

**Purpose:** Separate repository implementation completeness from external activation evidence for every planned integration.

## Non-negotiable rule

Kurukoo must implement the canonical adapter or interface, state lifecycle, user and operator readiness UX, authorization boundary, unavailable/error/recovery behaviour, feature flag, deterministic contract, observability projection, configuration documentation and activation checklist **before** an external provider is available. The absence of a credential, device, webhook, provider approval, OAuth client, GPU or account is never a reason to replace an integration with a fake success state or a misleading connect button.

A provider credential is configuration evidence only. It is not proof of a delivered message, authorized file operation, completed payment, verified provider, connected device, trained model, fulfilled dispatch or production activation.

## Required readiness dimensions

Every integration in `externalIntegrationReadiness` reports the same dimensions.

| Dimension | Meaning |
|---|---|
| `IMPLEMENTED` | A canonical repository adapter or explicit non-implementation state exists. |
| `CONTRACT_TESTED` | Deterministic repository tests cover the lifecycle boundary. |
| `MOCK_VERIFIED` | Local deterministic fixtures or mocks verify expected request, response and unavailable behaviour. |
| `CREDENTIAL_READY` | Required configuration is present without exposing values. This is not live evidence. |
| `LIVE_VERIFIED` | Independently observed provider evidence has been recorded through the canonical boundary. |
| `FEATURE_FLAG_STATE` | The effective feature state from the canonical flag registry. |
| `PRODUCTION_ACTIVE` | The integration has approved live evidence and is explicitly active. |

Until independent evidence is introduced, `LIVE_VERIFIED=false` and `PRODUCTION_ACTIVE=false` by design. No implementation may infer either state from environment variables, a UI click, a mock result or a provider name.

## Canonical projection and UI

`src/services/externalIntegrationReadiness.ts` is the read-only readiness projection. It composes existing adapters, pilot readiness and the feature registry; it does not create a new execution architecture or call an external provider. The public `/channels` page uses the projection for all source, channel, AI, payment, infrastructure and operation cards. The authenticated operator endpoint is `GET /api/admin/external-integrations`.

The UI must render the current user state, all readiness dimensions, canonical boundary, recovery guidance and activation checklist. Unregistered source adapters are shown as **Not implemented**, with no fake connect action. Implemented adapters with missing secrets are shown as **Credentials required**. Configured but unverified adapters are shown as **Live verification required**. A provider is not shown as production-active until evidence is independently recorded.

## Current integration inventory

| Category | Integrations | Current repository policy |
|---|---|---|
| Owner sources | Google Drive, Google Sheets, Notion, Outlook, OneDrive | Drive has a canonical owner-scoped adapter and managed fallback. Sheets has an independent owner-scoped, read-only OAuth and bounded-range adapter. Notion has an owner-scoped public OAuth and bounded shared-page search adapter. Outlook and OneDrive share one owner-scoped Microsoft Graph OAuth authority with separate feature gates and least-privilege delegated read scopes. |
| Channels | WhatsApp, Telegram, SMS, USSD, email, FCM, voice | Canonical channel/voice boundaries, unavailable states and deterministic contracts exist. External delivery remains disabled until evidence. |
| Payments | Stripe, mobile money | Canonical payment and failure boundaries exist. Sandbox is never settlement proof. |
| AI and training | MCP, Gemini, Mistral, **Mistral Voxtral TTS**, Groq, OpenRouter, Hugging Face | Provider-neutral routing and diagnostics remain canonical. Mistral Voxtral TTS is a separate saved-voice adapter that requires an API key, approved model, saved `voice_id`, `hosted_mistral` and `mistral_tts` flags; it never converts a user audio artifact into a voice clone. OpenRouter is an explicit-model, feature-gated final hosted failover candidate. Hugging Face Jobs is separate from hosted inference availability. |
| Infrastructure | WebRTC, MQTT/IoT, voice | Foundations remain fail-closed until relay/broker/provider and real-device evidence exist. |
| Operations | External dispatch, provider verification, maps/geolocation | Canonical request, evidence and privacy boundaries exist; operations activate only through approved provider evidence and consent. |

## Activation lifecycle

1. Implement and contract-test the canonical adapter while the integration is disabled.
2. Render its truthful unavailable, error, retry and recovery states in the relevant user and operator surfaces.
3. Configure credentials through deployment secrets only; do not commit values or expose them to browser state, logs or telemetry.
4. Enable the explicit feature flag only after the configuration review.
5. Run a controlled provider smoke test using a test account, test device or approved non-billing preflight where applicable.
6. Verify the inbound webhook, callback, device receipt, artifact identifier, signed payment event, broker acknowledgement or other independent evidence through the canonical boundary.
7. Verify idempotency, retry, cancellation/revocation and user-visible recovery.
8. Record live evidence through the applicable canonical service, then approve production activation.

## Per-domain evidence requirements

| Integration family | Minimum live evidence before production activation |
|---|---|
| Drive and object storage | Owner authorization, provider file ID, open, reference-only deletion, separately confirmed external deletion and revocation. |
| Google Sheets sources | Owner authorization using `spreadsheets.readonly`, bounded range read, denied-source handling, token refresh, owner isolation, revocation and independent provider response evidence. |
| Notion sources | Owner authorization for only pages/data sources chosen in Notion, bounded shared-page search, denied-page/re-authorization handling, local and provider revocation, owner isolation and independent provider response evidence. |
| Outlook and OneDrive sources | Microsoft owner authorization using separate `Mail.ReadBasic` and `Files.Read` delegated scopes, PKCE, bounded `$select`/`$top` lists, token refresh, denial/re-authorization handling, local revocation, owner isolation and independent Graph response evidence. |
| Messaging and email | Signed callback, controlled send/receive, duplicate/replay handling, delivery-failure handling and logout/revocation where relevant. |
| FCM and voice | Authenticated device/session, provider acceptance, physical-device receipt or real audio result, timeout/disconnect and text fallback. |
| Payments and KYC | Test and production configuration, signed webhook, reconciliation, retry/idempotency, refund/dispute process and operator escalation. |
| Hosted AI | Actual selected provider/model diagnostics, success/failure classification, quota/timeout handling, retention review and canonical fallback evidence. For OpenRouter, also verify the explicit model, returned upstream attribution metadata where available, and no-charge/credit failure behaviour. For Mistral Voxtral TTS, verify the saved approved voice, actual audio bytes and provider/model attribution, 403 moderation handling, bounded-prompt rejection, timeout/error recovery to text, and no fabricated fallback audio. |
| Hugging Face Jobs | Scoped token, cost approval, remote GPU preflight, job lifecycle, immutable artifact, benchmark against base model and registry review. |
| WebRTC and MQTT | Approved relay/broker, owner/device identity, consent, authorization, real device lifecycle, reconnect/revocation and operational monitoring. |
| Dispatch and verification | Explicit connector authorization, attributable provider evidence, cancellation/escalation and no claimed completion without evidence. |

## Configuration rules

All external integration flags default to `false` in `.env.example`. Credentials and feature flags are separate. The required configuration variables and prerequisites remain documented in `.env.example`, `external-adapter-readiness.md`, the canonical feature registry and each adapter’s activation checklist.

## Contract coverage

`npm run test:external-integration-readiness` verifies all **26** registered planned integrations, all required readiness dimensions, unavailable states, credential-ready-but-unverified states, feature-flag state, the public Channels projection and the authenticated admin audit boundary. `npm run test:mistral-tts` verifies the dedicated Voxtral TTS feature gates, configured saved voice only, 300-word/2,000-character input boundary, documented non-stream audio endpoint, base64 response validation, canonical provider/model attribution and absence of a synthetic audio fallback. `npm run test:google-sheets-source` verifies least-privilege owner OAuth, encrypted tokens, bounded reads, non-content audit records, isolation and revocation. `npm run test:notion-source` verifies public OAuth state binding, basic token exchange, encrypted tokens, bounded shared-page search, non-content audit, isolation and revocation. `npm run test:microsoft-graph-source` verifies separate Mail.ReadBasic/Files.Read scope requests, CSRF/PKCE state, encrypted tokens, bounded field-selected reads, refresh-ready lifecycle, non-content audit, owner isolation and truthful local revocation. `npm run test:hosted-provider-failover` verifies explicit OpenRouter model selection, credential-plus-flag eligibility, request/response attribution, failover, and deterministic fallback. All run in the all-domain suite and CI.

## Live verification

When a real credential becomes available, do not change a readiness boolean manually. Enable the relevant flag, perform the controlled smoke test, observe independent provider evidence, and use the existing adapter and canonical evidence path to record the result. Until that happens, the integration must remain disabled or live-verification-required and the UI must say so.

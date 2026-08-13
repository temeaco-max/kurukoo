# Kurukoo Final Launch-Hardening Matrix

**Audit branch:** `integration/main-convergence-audit`  
**Baseline:** `b4a3a18`  
**Audit starting head:** `8fb4f2e`  
**Classification target:** **REPOSITORY READY / EXTERNAL INTEGRATIONS REQUIRED**

This matrix records the final implementation audit against the current repository. It deliberately distinguishes server-side boundaries and truthful fallback behaviour from capabilities that require a real provider, commercial agreement, regulatory approval, or production deployment configuration.

## Capability classification

| Capability | Classification | Evidence and boundary |
|---|---|---|
| Conversation-first web entry | **IMPLEMENTED** | Homepage and chat route into one conversation surface; text remains available when optional integrations are absent. |
| Progressive identity | **IMPLEMENTED** | Guest session, name/phone/OTP progression, HttpOnly session, logout, and guest-to-user continuity are covered by auth contracts. |
| FastText intent classification | **IMPLEMENTED** | FastText/rule fallback classifies intent; it does not become a second fulfilment engine. |
| Canonical skill flows | **IMPLEMENTED** | Requirements and category capabilities converge on shared skill definitions. |
| Economic Request lifecycle | **IMPLEMENTED** | Requests use canonical state transitions from qualification through quote, payment boundary, fulfilment, completion, cancellation, failure, and dispute. |
| Discovery and provider matching | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Matching uses active skills, availability, location constraints, and evidence-backed provider verification; real supply is required for meaningful results. |
| Provider verification and public profiles | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | `unverified`, `pending`, `verified`, `failed`, `expired`, and `suspended` states are evidence-gated and expiry-aware. The existing `/p/:providerSlug` projection returns no identity, location, skills, rating, or phone data unless the same canonical evidence gate is currently satisfied. |
| Trust Score | **IMPLEMENTED** | Formula and append-only evidence ledger exist; Trust Score is not identity, KYC, payment, availability, or certification. |
| Voice-to-conversation continuity | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Gemini Live session boundary, ephemeral credentials, rate limits, timeout, transcript handoff, and text fallback exist; a provider key and quota are required. |
| QR contextual entry | **IMPLEMENTED** | Signed opaque QR context, tamper/expiry validation, bounded metadata, idempotent activation, referral attribution, and no scan-time request/Points side effects. |
| Referrals and Points | **IMPLEMENTED** | Attribution survives guest migration and duplicate activation is controlled; rewards remain subject to legitimate Points rules. |
| Bounded autonomous runtime | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Persistent owned goals, bounded tools, plans, retries, cooldowns, cancellation, worker re-entry, visibility, and disabled mode exist. It cannot authorize payment, custody, emergency delivery, arbitrary shell, or arbitrary network access. |
| Reminders | **IMPLEMENTED** | Existing reminder service, workspace, persistence, worker cadence, and lifecycle operations are present. External delivery is not implied. |
| Living Memory | **IMPLEMENTED** | User-owned memory surfaces and privacy/deletion boundaries are retained; internal retrieval structures are not exposed as user-facing facts. |
| Request workspace | **IMPLEMENTED** | Workspace projections mirror canonical Economic Request state rather than inventing a second lifecycle. |
| Cart and saved items | **INTENTIONALLY UNAVAILABLE** | The workspace has no persisted Cart, saved-item, or saved-provider authority. Cart is not advertised and the retained compatibility route clearly directs users to the canonical conversation-to-Economic-Request flow without claiming inventory, pricing, reservation, payment, delivery, or fulfilment. `/saved` is labelled External Offers and projects only disclosed evidence-backed affiliate records. |
| Storefront and known offers | **IMPLEMENTED** | Product/service offers, seller participation, indicative versus confirmed price semantics, and request linkage remain subordinate to Economic Request. |
| Execution connector boundary | **IMPLEMENTED** | Explicit connector authorization, capability checks, participant ownership, idempotency, evidence, and failure handling are enforced. |
| Web Chat channel | **IMPLEMENTED** | Web Chat is the live channel in the current no-credential configuration. |
| WhatsApp, Telegram, SMS, USSD, email, FCM | **EXTERNAL-INTEGRATION-DEPENDENT** | Adapters and truthful unavailable states exist; provider credentials, callback registration, approval, and delivery evidence are required. |
| Stripe payment adapter | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Fail-closed intent creation, raw-body signature verification, replay protection, amount/request metadata, and webhook boundaries exist. |
| Regulated escrow and payout | **EXTERNAL-INTEGRATION-DEPENDENT** | The internal escrow ledger is evidence only; regulated custody, settlement, KYC/AML, and payout contracts are intentionally not implemented. |
| Safety and emergency coordination | **IMPLEMENTED** | Safety routes, contacts, check-ins, and emergency distinctions exist. Kurukoo does not claim that an emergency contact or service was notified without delivery evidence. |
| PWA/offline shell | **IMPLEMENTED** | Manifest, service worker, cached shell, offline page, and dynamic-data exclusion exist. Offline economic transactions are not promised. |
| Public terminology and design tokens | **IMPLEMENTED** | Public-facing copy uses Kurukoo terminology, canonical CTAs, Space Grotesk/Inter tokens, SVG icon primitives, touch-target rules, and no inline template styles. |
| Advertising surfaces | **IMPLEMENTED BUT COMMERCIAL-EVIDENCE-DEPENDENT** | The canonical `ad_campaigns`/`adManager` owner now has disclosed keyword and canonical-category targeting, paused/completed exclusion, protected Admin Marketing controls, FastText-routed chat placement, and Explore section projection. A campaign record, local credit spend, or rendered placement is not proof of billed media, measured delivery, provider verification, inventory, availability, price, booking, payment, delivery, or fulfilment. Active advertiser inventory, invoicing/collection, third-party delivery, and independently measured performance remain deployment-dependent. |
| Daily Picks and proactive prompts | **IMPLEMENTED BUT EVIDENCE-DEPENDENT** | The existing owner-scoped opportunity engine projects deferred-intention follow-up, disclosed active advertising, and quality-gated public Topic context. The legacy fabricated product/price/delivery fallback was removed. Production personalization, sponsorship, and re-engagement remain dependent on eligible configured source inputs; Daily Picks do not invent inventory, price, provider availability, delivery, rewards, or community activity. |
| Discover and Network | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Contextual routes and entity types exist; meaningful nearby supply and activity require real data. |
| Development profile | **IMPLEMENTED** | External providers disabled or sandboxed; deterministic fallbacks and local storage are available for controlled testing. |
| Controlled pilot profile | **IMPLEMENTED BUT DEPLOYMENT-DEPENDENT** | Enable only selected real integrations, with their credentials, callback verification, quotas, and evidence monitoring. |
| Production profile | **EXTERNAL-INTEGRATION-DEPENDENT** | Requires complete provider infrastructure, compliance, secrets management, monitoring, backups, and operational contracts. |
| Distributed scale | **DEFERRED UNTIL SCALE** | PostgreSQL, Redis/distributed limiting, durable queues, object storage/CDN, and multi-instance coordination are triggers, not prerequisites, for the current cheap single-instance pilot. |

## Verification changes made in this pass

The final audit found and fixed a genuine verification-boundary gap. The admin provider-verification route previously wrote `memory_profiles.verified_provider = 1` directly after checking profile fields and ratings. It now requires an explicit `evidenceRef` and delegates the state transition to the shared provider verification lifecycle.

Canonical discovery now requires an active `provider_verifications.state = 'verified'` record with a non-empty evidence reference and a valid expiry. The legacy profile flag is no longer sufficient. Connector-backed execution and compatibility order finalization use the same evidence-gated predicate. AI agents receive a deliberate platform-registry evidence reference when mirrored into provider identity; this is not inferred from a user profile.

The fallback AI responses were also hardened. When the external model is unavailable, Kurukoo no longer invents provider availability, prices, live market updates, reminder persistence, dispatch, payment, or fulfilment. It routes the user toward the canonical conversation flow and states the missing confirmation boundary.

## Launch profiles

| Profile | Safe operating posture | Required controls |
|---|---|---|
| **Development** | Use local SQL.js/SQLite, Web Chat, FastText/rule fallback, and external integrations disabled or sandboxed. | Non-production `NODE_ENV`, non-production test secrets, `OTP_DEBUG` only for local tests, and no real customer data. |
| **Controlled pilot** | Run one controlled instance and enable only the selected payment, voice, channel, or verification integration. | Production `JWT_SECRET`, `MEMORY_ENCRYPTION_KEY`, `QR_CONTEXT_SECRET`, provider keys, HTTPS callbacks, quotas, logs without sensitive payloads, backups, and an owner-operated incident path. |
| **Production** | Full configured infrastructure and compliance posture. | Verified external contracts, regulated payment/settlement model where applicable, KYC/AML process, monitoring, retention policy, backups, rate limiting, deployment secrets management, and tested rollback. |

## External requirements deliberately not faked

Real Stripe collection requires Stripe server credentials and a registered HTTPS webhook. Regulated custody and payout require an approved provider and compliance contract. KYC requires an authoritative verifier or documented human-review evidence process. WhatsApp, Telegram, SMS, USSD, email, FCM, inventory, provider availability, dispatch, and emergency notification require their own provider credentials, approvals, callback contracts, and delivery evidence.

## Deferred scaling triggers

Do not add Redis, PostgreSQL, Kubernetes, queues, CDN, or microservices merely to claim production readiness. Introduce them when the pilot requires multiple concurrent writers, distributed rate limiting, durable work independent of the application process, high-volume asynchronous processing, large media storage, or multi-instance coordination. The current single-instance pilot is intentionally bounded and documented in `BUILD_STATUS.md`.


## Controlled pilot certification update

The certification pass classifies Kurukoo as **CONTROLLED PILOT READY** only for an invited, supervised Web Chat Assisted Pilot. The safe profile keeps production payment, regulated escrow, external execution, outbound channels, emergency notification, and autonomous agents disabled unless each external, commercial, legal, and human-operational gate is approved.

New repository controls in this pass are production fail-closed validation for `JWT_SECRET` and `MEMORY_ENCRYPTION_KEY`, the default-disabled `KURUKOO_EXTERNAL_EXECUTION_ENABLED` kill switch, service-level self-referral rejection, and redaction of phone numbers, peer lists, and transaction amounts from standard logs. Detailed scenario evidence and remaining activation requirements are recorded in `PILOT_CERTIFICATION_MATRIX.md`; the operator procedure is in `PILOT_OPERATING_GUIDE.md`; compliance decisions are in `PILOT_COMPLIANCE_CHECKLIST.md`.

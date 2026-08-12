# Kurukoo Controlled Pilot Compliance Checklist

> This checklist is an operational and legal-readiness aid, not legal advice and not a statement of UK GDPR, GDPR, Nigerian NDPR, KYC/AML, payment, safeguarding, or emergency compliance. A qualified adviser and the responsible business must make the applicable decisions.

## Classification

| Classification | Owner |
|---|---|
| **Repository** | Can be verified or fixed in the Kurukoo codebase. |
| **External provider** | Requires a processor, payment provider, messaging provider, verification provider, hosting provider, or callback contract. |
| **Legal/business decision** | Requires a documented decision by the business and qualified advisers. |
| **Human operational process** | Requires trained people, ownership, review, escalation, or evidence handling. |

## Checklist

| Topic | Control or decision | Classification | Pilot status / required evidence |
|---|---|---|---|
| Privacy notice | Explain identity, phone, location, conversation, request, memory, referral, Points, provider, payment metadata, voice transcript, and QR attribution processing. | Legal/business decision | Required before inviting testers. |
| Lawful basis and purpose limitation | Choose and document the lawful basis for each processing purpose; do not treat product functionality as a lawful basis by itself. | Legal/business decision | Required adviser review. |
| Data minimisation | Collect only fields needed for the current conversation, request, authentication, fulfilment boundary, safety instruction, or audit. | Repository + legal/business decision | Repository ownership scopes and bounded metadata exist; review product fields. |
| Access control | Verify ownership for conversations, requests, memory, notifications, referrals, Trust Score, disputes, agent goals, and exports. | Repository | Tested in security and route suites. |
| Encryption and secrets | Provide high-entropy `JWT_SECRET`, `MEMORY_ENCRYPTION_KEY`, `QR_CONTEXT_SECRET`, admin secrets, and provider secrets through managed secret storage. | Repository + human operational process | Production startup now fails closed for missing JWT or memory secret. |
| Memory privacy | Obtain user-facing consent or preference for personalisation, provide retrieval and deletion controls, and define retention. | Repository + legal/business decision | Controls exist; policy and wording require review. |
| Data export | Define export format, identity verification, response time, and exclusions for third-party or legally retained records. | Repository + human operational process | Authenticated export route exists; operational SLA required. |
| Deletion and retention | Define deletion exceptions, order/audit retention, backups, legal holds, and restoration implications. | Legal/business decision + human operational process | Repository deletion and purge paths exist; policy required. |
| Processor contracts | Sign data-processing agreements with hosting, AI, voice, email, SMS, WhatsApp, Telegram, payment, KYC, analytics, and backup providers actually used. | External provider + legal/business decision | Not complete while providers are unconfigured. |
| Cross-border transfers | Identify where UK, Nigerian, or other user data is processed and approve transfer mechanisms. | Legal/business decision + external provider | Required before external AI, voice, messaging, or payment activation. |
| UK GDPR / GDPR | Confirm territorial scope, rights process, controller/processor roles, DPIA need, breach process, and supervisory authority contact. | Legal/business decision | Not certified by this repository pass. |
| Nigerian NDPR | Confirm applicability, privacy policy, data protection officer/process, rights, breach handling, and cross-border requirements. | Legal/business decision + human operational process | Not certified by this repository pass. |
| Security incident response | Define severity, containment, notification, evidence preservation, user communication, and recovery owners. | Human operational process + legal/business decision | Pilot guide provides technical shutdown; business incident plan required. |
| Payment compliance | Choose payment collection, refunds, chargebacks, custody, settlement, currency, tax, and merchant-of-record model. | External provider + legal/business decision | Stripe adapter exists; regulated settlement/escrow model not supplied. |
| KYC/AML | Define who must be verified, evidence accepted, review/expiry, sanctions screening, monitoring, and escalation. | External provider + legal/business decision + human operational process | Provider lifecycle is evidence-gated; verification operation not connected. |
| Provider verification | Require authoritative evidence reference and reviewer ownership; define expiry, suspension, appeal, and re-verification. | Repository + human operational process | Lifecycle and expiry worker pass; evidence-review operation required. |
| Advertising disclosure | Label sponsored placements, affiliate relationships, paid ranking, and provider incentives clearly. | Legal/business decision + repository | Content and placement review required for pilot campaigns. |
| Communications consent | Define opt-in, opt-out, quiet hours, transactional versus marketing messages, and proof of consent for each channel. | Legal/business decision + external provider | Channel adapters unconfigured; policy required before activation. |
| Emergency disclaimers | State that Kurukoo is not emergency services and does not contact anyone unless delivery evidence exists. | Repository + legal/business decision | Safety responses include explicit non-notification and non-emergency-service wording. |
| Children and safeguarding | Decide whether children may use the service, age thresholds, guardian consent, provider safeguarding, escalation, and prohibited requests. | Legal/business decision + human operational process | Required before broad or family-facing pilot. |
| Voice and biometric risk | Determine whether voice transcripts, voiceprints, or inferred sensitive data are processed and disclose provider processing. | External provider + legal/business decision | Gemini Live is optional; legal/provider review required before activation. |
| Accessibility | Test keyboard, screen reader, contrast, touch targets, reduced motion, captions/transcripts, and language support. | Repository + human operational process | Existing frontend audits pass; human accessibility review still required. |
| Disputes and consumer protection | Define cancellation, refunds, cooling-off, dispute evidence, provider response, escalation, and rate/review treatment. | Legal/business decision + human operational process | Repository lifecycle exists; business policy required. |
| Tax and accounting | Determine invoices, VAT/GST, Nigerian/UK tax treatment, Points accounting, provider payouts, and records. | Legal/business decision + external provider | Required before real collection or settlement. |
| Records and audit | Define retention and access for evidence, payment webhooks, disputes, provider reviews, safety actions, and admin changes. | Human operational process + legal/business decision | Append-only evidence and audit paths exist; retention policy required. |

## Release gate

The controlled Web Chat Assisted Pilot may proceed only after the business confirms the applicable privacy notice, terms, emergency disclaimer, tester consent, incident owner, data-request owner, database backup, HTTPS domain, production secrets, and disabled external capability states. Production money, regulated escrow, external execution, outbound channels, and autonomous agent operation remain blocked until their respective external, legal, commercial, and human-operation checklists are signed off.

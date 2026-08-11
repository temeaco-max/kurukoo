# Kurukoo Security Audit Status

**Date:** 2026-08-11  
**Blueprint:** `BLUEPRINT.md` v5.62  
**Current main:** `a940503976db3a364f2eabcb82ff3d7ddf51c00e`

## Current status

| Area | Status | Current implementation |
|---|---|---|
| JWT authentication | ✅ | JWT secret is required; browser OTP flow keeps the token in an HttpOnly cookie rather than returning it to page JavaScript. |
| Header/phone auth bypass | ✅ | Authenticated routes use the canonical authenticated identity. |
| Admin authorization | ✅ | Admin surfaces use admin authentication rather than ordinary user identity. |
| Secret scanning | ✅ | CI includes a secret-scan job. |
| Webhook signatures | ✅ | Channel webhook validation is implemented where the provider supports it. |
| Payment fail-closed behaviour | ✅ | Production cannot silently use the sandbox payment provider. |
| Sandbox mutation isolation | ✅ | Sandbox economic mutations are restricted to non-production use. |
| Demo provider isolation | ✅ | Demo provider seeding is development-only. |
| Economic request ownership | ✅ | Customers can only access their own economic requests. |
| Economic lifecycle authorization | ✅ | Customer routes are restricted to customer-owned transitions; provider/system transitions remain in service orchestration. |
| Provider verification semantics | ✅/⚠️ | Matching requires an explicit verification flag. Real-world verification evidence/expiry/revocation adapters remain to be integrated. |
| Location matching | ✅/⚠️ | Provider matching applies the supplied location against stored service-area fields. Precise geospatial/radius matching requires real geocoding/presence data and is not fabricated. |
| Escrow semantics | ✅/⚠️ | The local escrow ledger is created only after a trusted payment reference marks the request paid. Real regulated/PSP escrow remains an external integration. |
| Monetary quote semantics | ✅ | No fake/default monetary quote is generated. Provider-listed rates are labelled indicative; final quotes must be confirmed. |
| Attachment security | ⚠️ | Authenticated, size-limited uploads exist; production object storage, malware scanning, signed access URLs and retention controls remain recommended before high-volume media use. |
| Distributed rate limiting/presence | ⚠️ | Single-instance controls are present. Redis becomes necessary when multi-instance coordination is introduced. |
| Database scale | ⚠️ | SQL.js is retained as the cost-effective single-instance launch database. PostgreSQL is a scale trigger, not a mandatory premature migration. |
| Real PSP | ❌ | Production PSP credentials/contracts are still required. The code fails closed rather than pretending a payment succeeded. |
| External identity/provider verification | ❌ | Production verification adapters/evidence workflows still require external integrations. |

## Economic truth rules

The following are now non-negotiable:

1. A database escrow row is **not** proof that money is held.
2. A provider record is **not** proof that the provider is verified.
3. A provider profile is **not** proof of current availability.
4. A listed starting rate is **not** a confirmed quote.
5. A successful database transition is **not** proof that an external fulfilment event occurred.
6. A sandbox payment is never a production payment.

User-facing language must reflect these distinctions.

## Remaining security work

1. Integrate and certify a real PSP before enabling production payment/escrow claims.
2. Integrate provider/identity verification with auditable evidence, expiry and revocation.
3. Move chat media to protected object storage with malware/content scanning and signed access when production volume warrants it.
4. Add cross-channel behavioural security tests for web, WhatsApp, Telegram, SMS, USSD and email.
5. Introduce Redis-backed distributed rate limiting/presence only when multi-instance deployment requires it.

## Operator actions

If real credentials were ever committed to Git history, rotate them in the relevant provider consoles and treat the historical values as compromised until rotation is confirmed. Code-level secret scanning cannot revoke a credential.

## Implementation rule

Before implementing a security or platform capability, inspect the current repository and confirm whether an existing canonical implementation already provides it. Extend the canonical implementation instead of creating a parallel service or route.

# Provider Supply Registry

**Status:** Architecture and controlled administrative boundary implemented.
**Data policy:** No scraping, bulk import, or Nigeria provider seeding is included in this change.
**Core rule:** A public business listing is **not** a Kurukoo provider account, is **not** verified, and cannot receive a coordination request until it passes separate claim, evidence, capability, availability, and activation gates.

## Why this boundary exists

Kurukoo needs to represent real-world supply before every business has joined the product. Storing public business data directly in `memory_profiles` would collapse three different concepts into one record: public information, a claimed business relationship, and an evidence-verified Kurukoo provider account. The Provider Supply Registry keeps those concepts distinct.

> **Supply registry presence creates discovery work for operators; it does not create customer-facing provider eligibility.**

The registry has no path that writes a public listing into `memory_profiles`, `skills`, `provider_verifications`, Economic Request participants, provider coordination invitations, payment, dispatch, or fulfilment state.

## Canonical model

| Record | Purpose | Authority | What it cannot assert |
|---|---|---|---|
| `provider_supply_entities` | Public or operator-recorded real-world business/entity supply | Source/provenance record | Kurukoo membership, provider verification, available capability, payment, dispatch, or fulfilment |
| `provider_supply_provenance` | Source-by-field evidence and retrieval context | Provenance record | That the source is current, claimed, or independently verified |
| `provider_supply_claims` | A Kurukoo account’s request to claim a registry entity | Claim review evidence | Business verification or provider network activation |
| `provider_verifications` | Authoritative provider identity/verification lifecycle | Evidence-backed verification state | Capability, availability, payment, dispatch, or completion |
| `memory_profiles` and `skills` | Claimed Kurukoo account and declared capability | Account/capability data | Registry provenance, business claim approval, or verification evidence by themselves |

## Registry lifecycle

```text
Discovered / Imported
        ↓
Invited or Claim Requested
        ↓
Claimed
        ↓
Verification Pending
        ↓
Registry Verified
        ↓
Active
```

The registry lifecycle is deliberately separate from provider discovery. “Registry Verified” means the supply record has passed the operator’s registry review stage. It does **not** grant customer coordination eligibility. Activation additionally requires all of the following at the moment of activation:

1. An approved claim connecting the registry entity to a Kurukoo account.
2. Current, evidence-backed `provider_verifications.state = verified` for that account.
3. At least one available declared capability in `skills`.
4. A successful revalidation performed by the activation boundary.

Even after activation, payment, dispatch, external notification delivery, arrival, fulfilment, and payout remain independent evidence-gated boundaries.

## Provenance rules

Every import has a source type, retrieval timestamp, source confidence, and a provenance record. Public website and public directory imports require an HTTP/HTTPS source URL. The service stores a hash of the asserted field value in provenance history so operator review can distinguish a source record from a later edited value without treating raw historical content as trusted data.

| Source type | Required data | Registry interpretation |
|---|---|---|
| `public_website` | Source URL and retrieval time | Publicly listed information only |
| `public_directory` | Source URL and retrieval time | Directory record only; no membership or verification implication |
| `manual_operator` | Operator-originated record | Requires later independent review before claim or activation |
| `provider_claim` | Authenticated claimant and claim record | Claim request only; not proof of business ownership |

## API boundaries

| Endpoint family | Actor | Scope |
|---|---|---|
| `POST /api/supply-registry/entities/:id/claim` | Authenticated user | Request a claim for one registry entity; returns `provider_verified: false` |
| `GET/POST /api/supply-registry/admin/entities` | Authenticated administrator | List or import provenance-bearing supply entities |
| `GET /api/supply-registry/admin/entities/:id` | Authenticated administrator | Read entity and its provenance records |
| `POST /api/supply-registry/admin/claims/:id/review` | Authenticated administrator | Approve or reject a claim; approval requires an evidence reference |
| `POST /api/supply-registry/admin/entities/:id/transition` | Authenticated administrator | Advance only through the constrained registry state graph |
| `POST /api/supply-registry/admin/entities/:id/activate` | Authenticated administrator | Revalidate separate claim, provider verification, and available capability before activation |

There is intentionally no public supply-search route and no automatic invitation or external outreach route in this implementation. The next seeding pass must be designed as a source-specific, consent-aware import workflow and must not treat this registry as permission to scrape, contact, or market to listed businesses.

## Relationship to provider coordination

Provider coordination remains an authenticated request loop for **evidence-verified Kurukoo providers**. The Supply Registry only prepares a clean, provenance-bearing path to reach that condition.

```text
Public business listing
        ↓
Provider Supply Registry + provenance
        ↓
Claim request and operator review
        ↓
Kurukoo account + separate verification evidence
        ↓
Capability and availability configuration
        ↓
Registry activation
        ↓
Canonical provider discovery
        ↓
Internal coordination invitation
```

## Acceptance checks

The registry regression proves that a public-source entity requires a source URL, remains absent from `memory_profiles` and provider discovery after import, retains provenance, supports an evidence-backed claim review, blocks activation before separate provider verification and capability configuration, and becomes discoverable only after those independent gates are satisfied. It also asserts that activation confirms neither payment nor dispatch.

## Seeding decision

**NO-GO for provider scraping or bulk Nigerian business import.** The implemented registry is the prerequisite, not an import authorization. Before any seeding, Kurukoo needs a source allowlist, terms/permissions review, field minimisation and retention policy, duplicate-resolution policy, geographic normalisation policy, import review queue, opt-out/removal process, claim/QR invitation design, and a controlled sample dataset approved by an operator.


## Controlled Nigerian acquisition safeguards

The registry is now operationally useful for a controlled Nigerian pilot without becoming a web scraper. Every import must identify an approved source policy, use an allowed source type, remain within the bounded batch limit, carry an import batch ID, preserve source retrieval time and field provenance, and pass the Nigeria-only geography normalizer. The importer never fetches a source URL; it records provenance supplied by an operator and rejects unapproved sources before persistence.

The review lifecycle is distinct from provider verification. Imported records start as `review_required` and are not public listings until an operator records review evidence. A reviewed record receives a freshness deadline from the approved source policy. Overdue records become `stale`; closed or source-removed records become `removed`. Stale records are excluded from the public current-supply projection. Review evidence does not mean KYC, membership, provider verification, availability, payment readiness, or fulfilment.

Duplicate detection compares normalized business name, website domain, public business phone, address, state, and LGA. It creates a non-destructive `possible_duplicate` candidate with matching signals and confidence. The system never automatically merges or deletes a record. An operator must record an explicit merge or reject decision while retaining the provenance of all source records.

Public supply is a separate projection. It may show a reviewed, current record as **Publicly listed business**, with source/freshness, services, location, and opening hours where available. It must show **provider verification false**, **availability unknown**, and **price unknown** unless separate authoritative state exists. Public supply cannot receive a coordination invitation. Only a linked Kurukoo account that passes the existing evidence-backed verification, capability, freshness, and activation gates may enter provider coordination.

Operator-issued claim invitations are opaque, expiring, and stored by token hash. Issuing one records an internal event and returns a claim token for a deliberate operator-controlled handoff. It does not send WhatsApp, SMS, email, push, or any other external message. A claim is authenticated, evidence-reviewed, and remains separate from provider verification.

No real Nigerian seed records were added in this pass. Test fixtures use non-real example URLs solely to exercise boundaries. Future seed data must be approved by an operator, sourced from a policy-approved public business source, field-minimized, provenance-bearing, reviewed for duplicates and geography, and explicitly labelled when facts are unavailable. The registry must never fabricate a provider, address, opening hours, price, availability, source URL, coordinate, review, payment, dispatch, or fulfilment result.

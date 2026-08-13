# Manual Nigerian Public-Supply Onboarding Procedure

**Pilot scope:** Start with no more than 1–2 states, 2–3 LGAs/localities, a few supported categories, and 10–30 manually reviewed **publicly listed businesses**. This procedure does not authorize scraping, bulk ingestion, automatic contact, invented business data, or a claim that any business is a Kurukoo partner.

## State separation

| State | What it means | What it does not mean |
|---|---|---|
| Publicly listed business | A provenance-bearing public record was manually reviewed for display or operator research. | Verified provider, available provider, contacted business, partner, quote, payment, dispatch, fulfilment. |
| Claimed record | A claimant used an operator-issued, expiring claim invitation. | Identity verified, capability approved, provider active. |
| Verified provider | An operator reviewed identity/evidence under the verification policy. | Available now, suitable for every skill or area, booked, paid, fulfilled. |
| Capability approved | The verified provider may be considered for an approved skill. | Coverage of every locality or current availability. |
| Fresh availability | The provider made a current, scoped availability declaration. | Opening hours, appointment, dispatch, response, or fulfilment. |
| Provider response / quote | The provider explicitly responded to an internal invitation with a bounded quote. | Customer acceptance, payment, booking, external contact, fulfilment. |
| Customer quote acceptance | The customer accepted a selected provider quote and request entered `awaiting_confirmation`. | Paid, escrowed, dispatched, fulfilled, completed. |

## 1. Prepare the operator-controlled sample

The supply reviewer first writes down the chosen state, LGA/locality, categories, maximum record count, retrieval period, source types, allowed public fields, retention period, and opt-out/removal owner. The reviewer obtains a source-policy decision before recording any business. The source policy must identify whether the source terms permit the intended manual use; a public webpage being visible is not itself approval to use it.

Each operator should use a separate authenticated admin account. The reviewer must never add personal contacts, login credentials, private notes, unverifiable reviews, invented coordinates, inferred hours, invented rates, or a “verified” label to a public-supply record.

## 2. Record the public listing

For every proposed public business, enter only the following evidence-backed information.

| Field | Required handling |
|---|---|
| Source | Approved source-policy identifier, source URL, and retrieval date/time. |
| Public identity | Exact public business name; retain spelling as displayed. |
| Public service description | Short public description only; no inferred skill claim. |
| Geography | State and LGA/locality only when public evidence supports it; no invented coordinates. |
| Public address | Public business address only if necessary and source-supported. |
| Opening hours | Optional source text labelled as public listing information, never availability. |
| Public phone/domain | Only if the source policy and privacy review permit it; never treat it as a provider login or verified identity. |
| Review evidence | Reviewer, date, source reference, duplicate decision, and reason. |

The record starts in the appropriate review state. It must not enter provider discovery, coordination, payment, execution, or fulfilment from public-listing data.

## 3. Make and record a duplicate decision

Search the existing registry before activation using normalized business name, address, permitted public phone, domain, and locality. Similar spelling, a different domain, a different opening-hours string, or a second source does not justify two operational providers.

| Duplicate outcome | Required action |
|---|---|
| Same public business | Preserve both sources/provenance and associate or merge only through the existing operator-reviewed duplicate flow. |
| Uncertain match | Mark for review; do not activate as a second active provider candidate. |
| Distinct business | Record the differentiating evidence and continue the manual review. |
| Stale, closed, removed, or opt-out | Mark stale/removed under the registry lifecycle and ensure it cannot be treated as current provider supply. |

## 4. Claim and verification workflow

If the pilot lead chooses to invite a business to claim a listing, an authenticated operator issues an expiring claim invitation through the existing registry control. No automatic email, SMS, WhatsApp, scraping, or outreach is authorized by this procedure. The operator records the manual contact method and business-consent basis outside ordinary public display fields.

A successful claim creates a claim-review item only. The verification reviewer checks the required identity/evidence references and records the decision. Claiming does not grant verification; verification does not grant capability; capability does not grant geography; geography does not grant availability; and availability does not grant coordination or payment.

## 5. Activate pilot coordination only after every gate

The provider may be enrolled for the controlled pilot and become eligible for a particular request only after the existing canonical gates are true: active pilot account, current evidence-backed verification, approved capability, matching service area, and fresh provider-owned availability. The provider may then receive an **internal** invitation. The operator must not say that external notification was delivered unless the appropriate adapter reports delivery evidence.

## 6. Ongoing review, removal, and opt-out

Review public records on the pilot cadence defined by the source policy and earlier when an operator learns that a business closed, moved, opted out, was claimed by another party, or is disputed. Record the reason and evidence for stale, suspended, removed, or duplicate decisions. A stale/suspended state must prevent new eligibility and any later selection/acceptance revalidation must fail safely.

A public business or claimant asking for correction/removal receives an operator case reference and a recorded response. Do not delete provenance needed for the audit trail unless the retention/privacy policy requires deletion; do remove the record from public/coordination projection as the applicable policy requires.

# Final Controlled Human Pilot Red-Team Findings

**Scope:** Repository-level assessment for a small supervised Nigerian Web Chat pilot. The findings distinguish a fixed code defect from a required deployment, legal, human-operations, or external-provider control.

## Classification

| Finding | Severity | Repository bug? | Fixed? | External dependency? | Pilot blocker? |
|---|---|---:|---:|---:|---:|
| Partial-string provider service-area matching could treat a declaration such as `Ike` as eligibility for `Ikeja`. | P0 | Yes | Yes | No | No after regression |
| SQL lexical comparison did not reliably expire ISO-8601 accepted invitations in the provider queue, allowing a visibly stale quote state even though downstream selection rechecked expiry. | P0 | Yes | Yes | No | No after regression |
| Repeat quote acceptance returned an error after the first canonical acceptance rather than idempotently returning `awaiting_confirmation`. | P1 | Yes | Yes | No | No after regression |
| Public listing, claim, verification, capability, geography, fresh availability, response, selected quote, acceptance, payment, and fulfilment are distinct state authorities. | P0 | No | N/A | Human review required | No, provided the manual procedure is followed |
| Provider verification and availability must be rechecked at response, selection, and acceptance; suspension or stale availability blocks the transition. | P0 | No | Covered | No | No |
| Provider/customer queue and response ownership requires server-side authenticated identity. | P0 | No | Covered | No | No |
| Payment/escrow/dispatch/fulfilment/external execution must remain disabled for the first human pilot. | P0 | No | Configuration required | Yes | Yes if activated without separate approval |
| Internal notification must not be presented as external delivery; unconfigured channels must stay not connected. | P0 | No | Covered | Adapter and receipt required | No with adapters disabled |
| Safety guidance must not claim emergency contact, emergency-service, provider, or rescue delivery without external receipt. | P0 | No | Covered | External policy and delivery contract required | No with delivery disabled |
| Autonomous agents must remain disabled; LLM text is not authoritative economic/provider/payment/fulfilment evidence. | P0 | No | Covered | Optional model provider | No with agents disabled |
| Production payment, regulated escrow, external channel delivery, emergency delivery, and real fulfilment have no approved external operating evidence. | P0 | No | Intentionally disabled | Yes | Yes if represented or enabled |
| Production HTTPS, secret-manager, WAF/IP rate limits, monitoring, domain cookie checks, and quota/cost alerts are deployment controls not verifiable from this repository alone. | P1 | No | Checklist added | Yes | Yes before invitations |
| Backup restore has a repository runbook but needs a real deployment-volume rehearsal and named owner. | P1 | No | Runbook added | Yes | Yes before invitations |
| Human test outcomes, real Nigerian provider evidence, consent, source terms, legal retention policy, and operator rota cannot be fabricated in a repository test. | P1 | No | Procedures added | Yes | Yes before invitations |
| Real-device offline, poor-network, multi-tab, mobile-browser, and accessibility observations require the invited cohort and deployed domain. | P2 | No | Test script added | Yes | No, but observe and stop on harm |
| Scale-out, multi-instance storage, managed queue, advanced fraud controls, and public-production operations are outside the intentionally single-instance pilot scope. | P3 | No | Deferred | Yes | No for the bounded pilot |

## Fixed repository defects

The provider-coordination authority now normalizes and token-compares declared service areas rather than using unsafe substring matching. It also evaluates ISO-8601 invitation expiry with SQLite timestamp semantics, exposes expired accepted invitations as expired in the provider queue, and returns the already canonical `awaiting_confirmation` request for a repeated customer quote-acceptance request without adding a second acceptance event.

## Evidence from this pass

The existing provider supply registry, controlled supply acquisition, provider coordination, Stripe boundary, notification queue, native assistance, agent runtime, conversation-first authentication, dispute lifecycle, and execution-boundary suites were run as the red-team baseline. The expanded provider-coordination regression now covers partial-service-area denial, expired accepted-quote visibility and selection denial, provider suspension before acceptance, and repeat-acceptance event idempotency.

## Conservative conclusion before deployment gates

No repository-solvable P0 or P1 remains known after the fixes in this pass. The repository may reach **GO WITH CONDITIONS — controlled human pilot** only after every mandatory deployment, recovery, supply, consent, and operator item in the pilot materials is completed and evidence is recorded. It is not public-production ready.

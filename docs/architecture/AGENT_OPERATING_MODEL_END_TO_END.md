# Agent Operating Model — End-to-End Completion Contract

This contract turns the locked Agent Operating Model into an implementation checklist. It references existing owners; it does not create new ones.

## Canonical chain

`conversation → context assembly → Agent → goal/run → model routing → capability → policy → authorization → canonical request/execution → participant → evidence → outcome → notification/brief → conversation continuation`

## Completion gates

1. **Context gate:** the Agent run identifies conversation, owner, objective and object context where applicable.
2. **Reasoning gate:** model selection is cost-aware and records the chosen route; bounded tasks may use a local/cheap SLM and complex tasks may escalate.
3. **Capability gate:** selected action exists in the canonical capability registry/tool fabric.
4. **Policy gate:** risk and confirmation requirements are derived from canonical policy, not model prose.
5. **Authorization gate:** execution requires the authenticated owner and applicable approval/connector authorization.
6. **Request/execution gate:** economic or physical work enters its canonical lifecycle; non-economic work still uses its canonical executor.
7. **Participant gate:** the participant is a governed human, provider, internal agent, external agent, or machine; declaration does not imply availability or authorization.
8. **Evidence gate:** completion is not verified without the canonical evidence boundary.
9. **Outcome gate:** the Agent Run records completed/failed/blocked/awaiting states with correlation identifiers.
10. **Continuation gate:** the outcome can return to the existing conversation, task/request, notification, or Agent Brief without losing context.
11. **Persistence gate:** durable state is routed through the canonical persistence abstraction and is restart/multi-process safe in PostgreSQL mode.
12. **Truth gate:** repository, runtime, and real-world verification remain separate and explicit.

## No-fabrication rule

A contract may prove repository implementation and a controlled runtime may prove a local/external journey. Neither alone proves a real provider, carrier, payment rail, device, voice model, delivery, or autonomous asset. Those remain explicitly blocked/unverified until the external boundary produces evidence.

## Cost rule

Do not call a stronger model merely because it is available. Prefer the least capable model that satisfies the task, while escalating when complexity, ambiguity, policy, or user value justifies it. Model routing must never change authorization or execution policy.

## Outcome telemetry

Where run telemetry is collected, prioritize completion and verification, latency/time, model/cost route, intervention, failures, evidence quality, and user satisfaction. Token count and conversation length are secondary diagnostic metrics.

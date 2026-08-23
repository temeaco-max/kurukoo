# Kurukoo Agent Operating Model — Locked Principles

This is the locked architectural companion to the existing Agent Operating Model. It does not replace existing owners.

## Canonical chain

`User → Conversation/Context → Kurukoo Agent → Job/Goal/Agent Run → Model Routing → Capability/Skill → Policy/Guardrail → Authorization/Approval → Canonical Request/Execution → Participant → Evidence → Outcome → Memory/Notification/Agent Brief → Conversation continuation`

## Locked rules

- `/chat` remains the single primary user-facing Agent surface; `/agents` is directory/runtime infrastructure.
- Agent reasoning never becomes authority for payment, identity, safety, authorization, provider eligibility, execution completion, or evidence verification.
- Turn, session, object, Memory, Agent Run, and system state remain distinct context classes.
- Skills/capabilities describe actions; knowledge/context describes reference material; neither grants authority.
- Use the smallest suitable model for bounded subtasks and stronger models for difficult/open-ended reasoning; model choice never bypasses deterministic controls.
- Agent-to-Agent interoperability is protocol-neutral: internal agents and external agents use the existing governed participant/capability boundary; A2A/MCP/HTTP/webhooks may be adapters, not new Kurukoo authorities.
- Delegated work carries structured IDs/constraints separately from natural-language instructions.
- Meaningful runs remain observable through the existing Agent Goal/Event ledger; no second Agent Run database.
- High-risk/economic/identity/safety/external actions require explicit authorization/approval; delegation cannot bypass them.
- Evidence, not model confidence or agent prose, determines verified completion.
- Outcome telemetry matters more than token or conversation volume: completion, verification, cost, time, intervention, failure, evidence quality, satisfaction.
- Behaviour should remain attributable to Agent/capability/policy/connector versions where versioning exists.
- Durable state uses the canonical persistence owner; local SQL.js compatibility does not constitute Cloud Run durability.

## Locked conceptual layers

1. **Agent identity:** Agent Card / governed description.
2. **Job and run:** goal, context, delegated work, actions, approvals, evidence, outcome.
3. **Context assembly:** turn, session, object, Memory, run, system state.
4. **Model routing:** heterogeneous, cost-aware selection.
5. **Governed execution:** capability → policy → authorization → request → participant → execution → evidence.

## Forbidden duplication

Do not add another Agent Runtime, Job database, capability registry, request lifecycle, feature-specific messaging/call/notification/Memory store, or direct external-agent execution path that bypasses canonical policy and evidence.

## Completion criterion

The operating model is broadly complete only when a representative user objective can traverse the canonical chain end-to-end in repository contracts and available runtime evidence, with every unavailable external dependency remaining truthfully blocked rather than simulated as live.

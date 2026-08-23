# Kurukoo Agent Operating Model — Locked Principles

This is the canonical architectural lock for the existing Agent Operating Model. It extends existing Agent Runtime, capability, request, policy, participant, execution, evidence, Memory, Notification, Agent Brief and external-agent owners; it does not create parallel authorities.

## Canonical chain

User → Conversation/Context → Kurukoo Agent → Job/Goal/Agent Run → Model Routing → Capability/Skill → Policy/Guardrail → Authorization/Approval → Canonical Request/Execution → Participant → Evidence → Outcome → Memory/Notification/Agent Brief → Conversation continuation.

## Locked rules

- `/chat` is the primary user-facing Agent surface; `/agents` remains directory/runtime infrastructure.
- Agent reasoning never becomes authority for payment, identity, safety, authorization, provider eligibility, execution completion or evidence verification.
- Turn, session, object, Memory, Agent Run and system state remain distinct context classes.
- Skills/capabilities describe actions; knowledge/context describes reference material; neither grants authority.
- Prefer the smallest suitable model for bounded work and escalate for complex/open-ended reasoning. Model choice never bypasses deterministic controls.
- Agent-to-Agent is protocol-neutral. Internal and external agents are governed participants; A2A/MCP/HTTP/webhook integrations are adapters, not new Kurukoo authorities.
- Delegated work carries structured identifiers and constraints separately from natural-language instructions.
- Meaningful runs remain observable through the existing Agent Goal/Event ledger. No second run database.
- High-risk/economic/identity/safety/external actions require explicit authorization/approval; delegation cannot bypass them.
- Evidence, not model confidence or agent prose, determines verified completion.
- Outcome telemetry prioritizes completion, verification, time, cost, intervention, failures, evidence quality and user satisfaction.
- Durable state uses the canonical persistence owner; PostgreSQL is the shared durable target and SQL.js remains local/lightweight compatibility mode.

## End-to-end completion criterion

A representative user objective must traverse the canonical chain from intent through context, Agent Run, model routing, capability, policy, authorization, request/execution, participant, evidence, outcome, notification/brief and conversation continuation. External prerequisites remain truthfully blocked until real evidence exists.

## Forbidden duplication

No second Agent Runtime, Job store, capability registry, request lifecycle, feature-specific messaging/call/notification/Memory store, social-agent framework, or direct external-agent execution path that bypasses canonical authorization/evidence may be introduced.

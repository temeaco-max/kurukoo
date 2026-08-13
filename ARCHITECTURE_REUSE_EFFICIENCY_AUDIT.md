# Kurukoo Architecture Reuse and Cost-Efficiency Audit

**Assessment date:** 2026-08-13
**Scope:** Verification of `pasted_content_33.txt` against the current PR #31 head, `integration/main-convergence-audit`.

## Executive conclusion

The attached assessment has the **right corrective principle**: Kurukoo should be completed by understanding and extending the existing composition, not by repeatedly creating a new entity, role, opportunity, memory, provider, or agent architecture. The current codebase is a conversation-first coordination system whose canonical high-impact lifecycle is the Economic Request and whose bounded actions are projected through chat and related surfaces.

However, the assessment overstates several connections as though they are all currently active, and it contains one incorrect branch-history figure. The corrected implementation rule is therefore:

> **Inspect the current canonical owner, route, persistence, and regression before adding anything. Extend it only where the required boundary is absent. A new service, table, worker, or field is an exception that requires evidence that no existing authority can own the responsibility.**

## What is verified as active canonical composition

| Layer | Verified implementation evidence | Correct interpretation |
|---|---|---|
| Conversation and identity | `chatRouter`, `chatConversationService`, authenticated chat routes, guest continuity, and public chat shell are mounted from `src/index.ts`. | Chat is the primary interaction surface; it is not a second request engine. |
| Cheap routing before expensive inference | `fastTextService.ts`, `intentRouter.ts`, and `unifiedAiEngine.ts` use FastText classification, rule/fallback behavior, response caching, quotas, SmolLM2, and Groq selection. | FastText remains a core cost-control primitive. It must not be displaced by a new LLM-first intent architecture. |
| Memory and working context | `memoryProfile.ts`, `livingMemoryEngine.ts`, `unifiedAiEngine.ts`, `agentToolRegistry.ts`, and request routes use the memory boundaries. `agentToolRegistry` calls `buildWorkingContext()`. | Durable profile and selected working context are already separate responsibilities. No new memory layer is justified. |
| Capability and lifecycle | `skillFlows.ts` owns Economic Request creation and transitions. `economicRequestRouter`, `agenticStorefront`, `artistBookingService`, `economicParticipants`, `orderFinalizer`, and provider coordination create or progress the same canonical request type. | Categories, skills, flows, and specialist services must continue to compose around the shared request lifecycle. |
| Provider and network coordination | Provider verification, presence, discovery, and provider coordination are separately mounted and share the request lifecycle. | A participant type does not itself prove verification, availability, selection, dispatch, payment, or fulfilment. No category-specific provider system is needed. |
| Bounded agent continuation | `agentRuntime.ts`, `agentToolRegistry.ts`, and startup scheduling run goal continuation through quotas and tools. | This is bounded persistence/orchestration, not an independent marketplace or execution authority. |
| Communications | The recent `communication_deliveries`, `communication_outbox`, consent, receipt, and inbound-event controls extend the canonical notification/channel boundary. | These records are justified: no durable receipt-backed external-delivery authority previously existed. They are not a parallel request, provider, or payment engine. |

## Corrections to the attached assessment

| Attached claim | Verdict | Correction |
|---|---|---|
| PR #31 has **172 commits** on the convergence branch. | Incorrect as of this audit. | GitHub reports **100 commits** on PR #31. Commit count is not an architectural health measure and should not be used as design evidence. |
| `opportunityEngine.ts` is part of the live composition with deferred requests, discovery, memory, providers, and agent behavior. | Overstated. | The file exists and has generation/feed/action/dismiss exports, but this audit found no source import, route mount, or caller outside the file itself. Treat it as **dormant or incomplete**, not as proof of an active cross-product Opportunity system. Do not build a second Opportunity layer. First decide whether to wire the existing engine into a canonical approved surface or retire it safely after coverage and migration review. |
| Every request follows a fixed FastText → skill → flow → agent chain. | Overstated. | FastText is an active low-cost routing primitive and `intentRouter`/`unifiedAiEngine` use it, but chat and native actions may take different bounded paths. The correct rule is **cheap deterministic classification where appropriate, escalation only when needed**, not an assertion that every request takes one identical linear pipeline. |
| The Living Memory Engine is universally used by chat in the same way as agent tools. | Partly verified. | Agent tools explicitly call `buildWorkingContext()`. Unified AI imports memory-context helpers, and chat uses living-memory classification/schema support. Avoid claiming identical working-context invocation for every chat turn unless a route-level trace proves it. |
| `backgroundWorkers.ts` and `agentRuntime.ts` are the active shared background mechanism. | Partly incorrect. | `backgroundWorkers.ts` exports a broad scheduler but this audit found no composition-root start call. The active composition root calls `startBackgroundServices()`, which runs agent goal/deferred re-entry when enabled. Do not add another worker. Treat the unused scheduler as a consolidation review candidate, not a license for another job framework. |
| “Provider and inventory network” means a generally active live inventory directory. | Requires careful wording. | Providers, businesses, offers, supply records, and affiliate evidence exist, but inventory, availability, and pricing are only displayable when canonical evidence exists. Public positioning must preserve this qualified meaning. |

## Duplicate-layer and build-cost audit

The service audit reports **90 services**. It validates canonical ownership and finds no reintroduced legacy boundary, but it identifies one architectural warning: **182 of 203 canonical skills use the expected category/default-flow fallback instead of an explicit seeded flow**. That is not duplication; it is an intentional fallback pattern. Creating 182 new flow records solely for symmetry would add maintenance cost without evidence of a user or lifecycle gap.

The following are the only material consolidation candidates discovered in this focused audit.

| Candidate | Evidence | Required action | Do not do |
|---|---|---|---|
| Dormant Opportunity Engine | No caller or route import found for `opportunityEngine.ts`. | Establish ownership and test coverage before either integrating it into an existing canonical surface or retiring it. | Do not create `OpportunityV2`, an extra feed, a new jobs platform, or new opportunity tables. |
| Dormant broad worker scheduler | `backgroundWorkers.ts` exports `startBackgroundWorkers()`, while `src/index.ts` starts `startup/backgroundServices.ts`. | Compare scheduled responsibilities and migrate only after a production-worker design decision and regression coverage. | Do not start both schedulers or add a third queue/cron subsystem. |
| Legacy/suspicious service names | The service audit flags `executionConnector.ts`, `orderFinalizer.ts`, and `socialScheduler.ts` for manual review. | Review each only when a concrete route or lifecycle issue requires it. | Do not delete or replace them based on a filename-only scan. |

## Minimal-build policy going forward

Every proposed addition should answer these questions before code is written:

1. **Which existing canonical owner already holds this state or authority?**
2. **Which existing route, service, table, or worker can be extended?**
3. **What concrete gap cannot be solved by that extension?**
4. **Does the proposal add a second lifecycle, scheduler, provider model, request model, memory store, or delivery authority?**
5. **What regression proves both the new boundary and the absence of duplicated effects?**

If the answer to question 3 is not concrete, the change should be rejected. This preserves the intended economics: deterministic routing and cached/local inference before more expensive inference; bounded agents only when useful; and external execution only after the proper authority, consent, configuration, and evidence exist.

## Architecture map to preserve

```text
Conversation and authenticated identity
  → FastText/rules and bounded AI escalation
  → memory profile and selected working context
  → canonical skill and skill-flow requirements
  → native assistance or Economic Request
  → verified providers/businesses/offers/presence when evidenced
  → provider coordination, quote, verified payment/escrow where eligible
  → completion/dispute/evidence and memory/continuation updates
  → deferred intent, reminder, or bounded agent follow-up where authorised
  → chat, workspace, Discover, voice, and channel projections
```

This map is deliberately not a promise that every stage occurs for every message. It identifies the reusable authorities that may compose when a request requires them.

## Recommended next decision

No new architecture should be introduced. The highest-value maintenance decision is to assess the **existing dormant Opportunity Engine** and **dormant broad scheduler** with ownership, production-use, and regression evidence. Until then, preserve the current canonical flow and reject new systems that overlap with those components.

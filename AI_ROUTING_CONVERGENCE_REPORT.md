# Kurukoo AI Routing and Catalogue Convergence Report

**Integration branch:** `integration/near-completion`  
**Commit:** `5d01309f78aa33df2525da2925b8269299bd1c96`  
**Remote branch:** [`origin/integration/near-completion`](https://github.com/temeaco-max/kurukoo/tree/integration/near-completion)  
**Pull-request entry point:** <https://github.com/temeaco-max/kurukoo/pull/new/integration/near-completion>

## Completion Summary

The implementation converges the AI-routing and canonical catalogue work onto existing Kurukoo owners. It does **not** introduce another intent router, AI gateway, agent runtime, commercial ledger, discovery engine, or legacy route boundary. The branch is pushed and has not been merged into `main`.

| Area | Completed implementation |
| --- | --- |
| Canonical catalogue | The machine-derived catalogue remains the single source of truth: **241 skills = 205 core + 36 extensions**. All 17 extension-category mismatches are now resolved as corrections or documented deliberate overrides, with permanent regressions. |
| FastText routing | Rule-first conversation acts; category-first, abstention-capable candidate routing; central configuration; curated/hard-negative corpus tooling; deterministic splits; evaluation manifest; privacy-safe unknown-intent review with no auto-training. |
| AI resilience and accounting | Shared provider circuit breaker for Mistral, Gemini, Groq, and OpenRouter; true LRU; owner-private cache exclusion; request telemetry with explicit escalation reason and null/unavailable cost when pricing is unknown. |
| Agent economics | Per-goal and per-cycle token limits, daily hosted-escalation cap, local-only degradation, exhaustion cooldown, protected agent-budget read endpoint, and regression coverage. |
| Rechecks and behaviour | `internalCoordinator.recheckRequest` remains deterministic through the canonical owned-request/storefront tool and makes no LLM call. The behaviour pack derives contracts from the catalogue, skill contracts, skill flows, capabilities, and agent tools rather than bespoke engines. |
| Discovery and credentials | Existing discovery network gains source-type provenance and density readiness. Existing admin/auth/audit mechanisms now expose encrypted provider-credential metadata, rotation, disable/revoke, audit, and safe connection testing. |
| Persistence | Existing SQL.js owner remains active. A shared high-write boundary covers messages/conversations, durable jobs, and commercial ledger, blocks unsafe multi-worker writes, and reports Postgres only as an unactivated migration seam. |

## Exact Committed Files

| Group | Files |
| --- | --- |
| Documentation and configuration | `.gitignore`, `BLUEPRINT.md`, `package.json`, `data/audits/fasttext-evaluation-manifest.json` |
| Catalogue, corpus, evaluation, and scenario tooling | `scripts/audit-extension-category-mismatches.ts`, `scripts/audit-skill-outcome-convergence.ts`, `scripts/build-fasttext.mjs`, `scripts/compile-kurukoo-behaviour-pack.ts`, `scripts/evaluate-fasttext.ts`, `scripts/generate-fasttext-curated-corpus.ts`, `scripts/generate-fasttext-skill-hints.ts`, `scripts/generate-smollm2-training-universe.ts`, `scripts/merge-fasttext-corpus.ts`, `scripts/provider-outcome-scenario-lab.ts` |
| Regression coverage | `scripts/test-admin-routes.ts`, `scripts/test-agent-inference-budget.ts`, `scripts/test-ai-resilience-and-telemetry.ts`, `scripts/test-discovery-network.ts`, `scripts/test-fasttext-quality.ts`, `scripts/test-fasttext.ts`, `scripts/test-high-write-persistence.ts`, `scripts/test-provider-credential-controls.ts`, `scripts/test-provider-outcome-scenario-lab.ts`, `scripts/test-skill-outcome-convergence.ts`, `scripts/test-smollm2-training-universe.ts`, `scripts/test-unknown-intent-feedback.ts` |
| Canonical platform and routes | `src/database.ts`, `src/index.ts`, `src/routes/adminRoutes.ts`, `src/routes/discoveryRoutes.ts` |
| AI, agent, discovery, and persistence services | `src/services/agentInferenceBudgetService.ts`, `src/services/agentRepresentationService.ts`, `src/services/aiAgentService.ts`, `src/services/aiInferencePolicy.ts`, `src/services/aiProviderHealthService.ts`, `src/services/aiQuotaService.ts`, `src/services/chatConversationService.ts`, `src/services/commercialLedger.ts`, `src/services/discoveryNetwork.ts`, `src/services/durableJobQueue.ts`, `src/services/fastTextRoutingConfig.ts`, `src/services/fastTextService.ts`, `src/services/highWritePersistence.ts`, `src/services/lruCache.ts`, `src/services/providerCredentialService.ts`, `src/services/skillBehaviourRegistry.ts`, `src/services/skillCatalogueConvergence.ts`, `src/services/unifiedAiEngine.ts`, `src/services/unknownIntentFeedbackService.ts` |

No frontend pages, dashboard layouts, chat visuals, CSS files, design tokens, or `legacyApp.ts` were changed. The admin additions are protected backend API contracts only.

## Validation Evidence

| Command or regression | Result |
| --- | --- |
| `npm run lint` | Passed with zero TypeScript errors. |
| `npm run test:routes` | Passed all **49** backend route/lifecycle commands. A stale composition-root lifecycle assertion and a ledger-schema initialization defect exposed by the suite were corrected before the final passing run. |
| `npm run fasttext:test` | Passed all rule, router, quality, and privacy-safe unknown-intent regressions. |
| `scripts/test-ai-resilience-and-telemetry.ts` | Passed shared circuit states, LRU recency, null-cost telemetry, and escalation-reason assertions. |
| `npm run test:agent-inference-budget` | Passed per-goal ceiling, local-only degradation after hosted cap, and cooldown assertions. |
| `npm run test:provider-credential-controls` | Passed encrypted storage, masking, lifecycle status controls, and audit non-disclosure assertions. |
| `npm run test:high-write-persistence` | Passed single SQL.js owner, migration seam, and unsafe multi-worker-write block assertions. |
| `scripts/test-discovery-network.ts` and `scripts/test-discovery-routes.ts` | Passed provenance, sparse/no-data readiness, exact context, lifecycle, invitation, and route contracts. |
| `npm run test:scenario-lab` | Passed generation and coverage: 24,000 trajectories, 241 skills, 46 families, seven markets, ten channels, and twenty lifecycle variants. |

## Intentional Boundaries and Remaining External Validation

The local host has no usable FastText executable, so the real corpus is loaded but deterministic fallback classification is active. The evaluation manifest accurately records this and makes no model-accuracy claim. Actual hosted-provider health, credential acceptance, payment settlement, external-channel delivery, and real-device validation remain external evidence requirements.

The provider credential surface is deliberately **not** a generic environment editor. Its test endpoint records a provider-safe connection result where such a probe exists; it does not activate the provider for traffic. Unknown intent candidates remain redacted and reviewer-gated; no raw user traffic is promoted to training automatically.

SQL.js remains the active single-writer persistence owner. A Postgres signal does not activate Postgres, permit multi-worker writes, or create dual ownership. Adapter migration, migrations, cutover validation, and operational deployment proof remain necessary before any multi-instance configuration.

The large generated scenario corpora were intentionally not committed because each file exceeds GitHub’s 100 MB push limit. Their canonical generators and tests are committed and reproducibly regenerate them; the evaluation manifest required for release review is committed.

## Coordination Boundaries

Future work should preserve the current canonical owners: `canonicalChatTurnService`, `intentRouter`, `fastTextService`, `skillFlows`, `skillExecutionContract`, `unifiedAiEngine`, `aiQuotaService`, `agentRuntime`, `internalCoordinator`, `discoveryNetwork`, the durable job queue, and the commercial ledger. Avoid parallel routing, agent, discovery, persistence, or credential systems; do not alter the frontend/dashboard/admin UI/CSS work that is owned separately.

# Kurukoo AI Routing and Catalogue Convergence Report

This report is retained from the backend convergence branch and interpreted against the current `main`. It documents the implemented canonical AI-routing, resilience, agent-budget, discovery-provenance, credential-control and persistence-safety work without treating external provider activation as repository truth.

**Original implementation commit:** `5d01309f78aa33df2525da2925b8269299bd1c96`
**Original branch:** `integration/near-completion`
**Integration PR:** `#61` (currently non-mergeable because the branch is stale against current `main`).

## Scope

The convergence work preserves existing owners: `canonicalChatTurnService`, `intentRouter`, `fastTextService`, `skillFlows`, `skillExecutionContract`, `unifiedAiEngine`, `aiQuotaService`, `agentRuntime`, `internalCoordinator`, `discoveryNetwork`, durable jobs and commercial ledger. It does not introduce a parallel router, agent runtime, discovery engine or commercial engine.

The canonical catalogue remains machine-derived. FastText is non-authoritative and abstention-capable; deterministic conversation acts resolve before model routing. Unknown-intent review remains privacy-redacted and reviewer-gated. Hosted AI providers use shared health/circuit controls and request telemetry, with unavailable pricing represented as unavailable rather than invented. Agent hosted-escalation and token limits remain bounded server-side.

Provider credentials remain an authenticated operator control, encrypted and masked, with rotation/disable/revoke/audit and safe provider-specific probes where supported. SQL.js remains the active single-writer persistence owner; high-write boundaries report Postgres only as an unactivated migration seam and block unsafe multi-worker writes until a reviewed migration/cutover exists.

## Integration truth

The original branch was based on an earlier `main`. Current `main` has advanced by 59 commits relative to the convergence branch and contains additional product work, including the unified Discover experience and the Expo-native convergence framework. GitHub PR `#61` correctly reports `mergeable: false`; it must not be force-merged over the newer tree. Non-conflicting convergence assets and the native framework have instead been carried onto current `main`.

## External boundaries

Repository tests cannot prove live FastText executable availability, hosted provider credentials, payment settlement, external-channel delivery, production provider availability or multi-instance persistence safety. Those remain deployment evidence gates.
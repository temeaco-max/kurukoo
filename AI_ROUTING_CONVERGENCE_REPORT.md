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

## Latest-main reconciliation and completion update

The current `integration/near-completion` branch has been reconciled with `origin/main` through merge commit `b72f1ca`. The reconciliation deliberately preserved the implementations that had already landed in `main`; subsequent changes are restricted to compatibility fixes, active-lifecycle wiring, truthful deployment contracts, and regression alignment. No frontend visual redesign, alternative economic lifecycle, duplicate AI subsystem, or legacy route boundary was introduced.

| Verified gap | Compatibility-first correction | Canonical owner preserved |
| --- | --- | --- |
| Discover Watch processing existed but was not reached by the active worker lifecycle. | The existing Watch processor is now invoked from `startup/backgroundServices.ts`, with a focused scheduler regression. | Discover experience, notifications, durable state, and active startup lifecycle. |
| The owner notification inbox stored canonical action/object context but omitted it from its list projection. | The existing `pushNotifications` projection now returns the stored canonical action, object, owner, and idempotency metadata. | `pushNotifications`, authenticated notification routes, canonical Chat continuation. |
| `/web` and `/workspace` had overlapping route ownership. | The app-surface router is the sole canonical owner and preserves contextual authentication return paths; the public-router duplicate was removed. | App-surface router, public route registry, canonical authentication. |
| Conversation directives did not explicitly distinguish multiple active context identifiers. | The existing turn contract now adds a narrow multi-context preservation instruction. | Conversation-turn contract and canonical Chat behavior. |
| Cloud Run documentation lacked an explicit persistent-state prerequisite and model-cache environment entry. | The deployment descriptor and `.env.example` now state the ephemeral-cache and approved persistent-store boundary without claiming an active Postgres cutover. | Existing Cloud Run descriptor and high-write persistence policy. |
| Several regressions were asserting superseded implementation details. | Tests now derive skill coverage from the canonical catalogue, validate live source-attributed Discover behavior, use valid artifact bytes, and assert current inference-policy ownership. | Catalogue convergence, Discover map, artifact security, and inference policy services. |

## Final repository-side validation

The full `npm run test:repository-convergence` command completed successfully after reconciliation. This includes the 66-command domain suite, 49-command route suite, generated scenario-lab regression, long-horizon trajectory harness, and the active Discover Watch scheduler regression. The successful scenario laboratory exercised **24,000 scenarios**, **241 canonical skills**, **46 families**, **7 market configurations**, **10 channels**, and **20 lifecycle variants** in generation-only mode; generated corpora were intentionally restored after the test and are not part of this source commit.

> The validation establishes repository-side integration and truthful fail-closed behavior. It does not substitute for deployment evidence from real credentials, provider accounts, payment settlement, webhooks, or a persistent multi-instance datastore.

## Remaining merge and production gates

Before merging this branch into `main`, require normal GitHub review/status checks and confirm there is no intervening `main` change that needs another narrow reconciliation. Before production activation, validate the FastText executable and held-out evaluation in the target image, configured hosted-provider and external-channel credentials, PSP/webhook settlement evidence, and an approved persistent-store cutover before operating multiple writers. Keep `KURUKOO_WORKERS=1` for the active SQL.js persistence mode unless that independent migration is completed and verified.

The backend areas intentionally left for their existing owners are frontend/dashboard/mobile visual work, CSS/design-system changes, production provider provisioning, and external settlement/channel operations.

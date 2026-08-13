# PR #31 Integration Conflict Map

**Recorded:** 2026-08-13
**PR:** #31, `integration/main-convergence-audit` → `integration/near-completion`
**Current head:** `36104d5`
**Current base observed:** `503357f`

## Current integration status

PR #31 remains the sole designated integration vehicle. The current branch is clean and contains the target branch through merge commit `36104d5`. GitHub reports the pull request as **mergeable**; its `UNSTABLE` merge-state value is a GitHub check/recalculation state rather than an unresolved file conflict. No merge into `integration/near-completion` or `main` has been performed.

| Reference | Relationship to PR #31 head | Significance |
|---|---:|---|
| `origin/integration/near-completion` | 0 commits behind / 164 commits ahead | The head contains the current target branch plus controlled-pilot and UI convergence work. |
| `origin/main` | 0 commits behind / 126 commits ahead | `main` is not an integration target for this work. |
| PR #31 | Open, mergeable | Retains the canonical integration route; no replacement pull request is required. |

## Previously encountered conflict set

The merge of `origin/integration/near-completion` into PR #31 produced conflicts in QR, voice, referral, and chat assets. The conflict set was inspected rather than resolved wholesale.

| File or area | Competing implementation | Resolution rationale |
|---|---|---|
| `public/chat/index.html` | Newer conversation-first chat context, OTP, request timeline, safety and semantic-icon work conflicted with QR/voice scanner markup. | Retained the canonical conversation-first shell and integrated QR scanner controls, modal, script and styles without restoring inline handlers or a second chat interface. |
| `public/js/kurukoo-voice.js` and voice styles | Incoming browser voice controller did not preserve QR-originated conversation continuity expected by the canonical QR contract. | Retained the pre-merge canonical voice controller, which requests and stores the existing conversation ID. |
| QR scanner assets and referral landing | Incoming QR assets and safe contextual QR flow were newer target-branch work. | Preserved the incoming scanner, QR styles, referral landing, `/start` surface and documentation; then made static middleware fall through to canonical `/start` validation. |
| QR and voice documentation | Add/add documentation conflict. | Retained the newer target-branch material while preserving canonical architecture decisions in the merged history. |

## Invariants verified during reconciliation

The reconciliation did not change the canonical Economic Request lifecycle, Provider Supply Registry, evidence-backed provider verification, provider coordination, controlled-pilot admission, availability freshness, payment/escrow/execution fail-closed boundaries, production secret requirements, or the prohibition on treating `memory_profiles.verified_provider` as an authority. QR activation remains signed, bounded, idempotent, conversation-scoped, and unable to create Points or an Economic Request by itself.

## Remaining integration rule

Subsequent pilot-gate changes must be made only on `integration/main-convergence-audit`, validated against the merged target history, pushed to PR #31, and never merged automatically into `integration/near-completion` or `main`.

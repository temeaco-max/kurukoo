# Kurukoo Documentation Map

## Current authorities

`main` is the only canonical integration branch.

- `README.md` — project overview and operating commands.
- `BLUEPRINT.md` — product and architecture intent.
- `docs/architecture/CURRENT_PRODUCT_TRUTH.md` — **single current-state implementation/verification authority**.
- `AGENTS.md` — engineering rules for all agents/contributors.

`BUILD_STATUS.md`, `SECURITY_AUDIT_STATUS.md`, `CONTROLLED_PILOT.md`, matrices, registries and focused audits are supporting evidence or operational guidance. They must not override `CURRENT_PRODUCT_TRUTH.md` or canonical code/tests.

`CHAT_SURFACE_CONTRACT.md` remains the protected UI contract for Chat. `KURUKOO_REFERENCE.md` is a compact reference and must defer to the canonical authorities above.

## Supporting documentation

Current product, architecture and integration references are grouped under `docs/product/`, `docs/architecture/` and `docs/integrations/` where applicable. Supporting documents may explain implementation detail, but they must not introduce a competing current-state authority.

## Historical evidence

Historical audits and convergence records are stored under `docs/audits/`. Browser, acceptance and test evidence is stored under `docs/verification/`. Older product notes and one-off planning material are stored under `docs/history/`. Historical branch names and baseline commits in those documents are evidence only; they are not current branch or deployment instructions.

## Source-of-truth rule

When documents disagree, do not silently choose the document that sounds most complete. Check canonical code and behavioural evidence, then update `CURRENT_PRODUCT_TRUTH.md` to record the reconciled state. External provider/device activation remains a separate real-world verification dimension.

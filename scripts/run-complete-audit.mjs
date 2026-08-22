// Compatibility entrypoint only. Product truth is verified by the single canonical gate.
// Focused audits remain separate evidence producers; this command must not claim completion.
console.warn('[Kurukoo] audit:complete is a compatibility alias. Use scripts/verify-product-truth.mjs for repository truth; run focused behavioural tests for evidence.');
await import('./verify-product-truth.mjs');

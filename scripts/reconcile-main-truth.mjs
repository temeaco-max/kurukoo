// Compatibility entrypoint only.
// Historical versions wrote generated reconciliation snapshots and hard-coded product classifications.
// That is no longer an authority and must not write current truth.
console.warn('[Kurukoo] audit:main-truth is deprecated and no longer writes a product-truth snapshot.');
await import('./verify-product-truth.mjs');

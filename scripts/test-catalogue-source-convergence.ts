/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-catalogue-source-convergence-${process.pid}-${Date.now()}.sqlite`;
const { registerCatalogueSource, upsertCatalogueProduct, searchCatalogueProducts } = await import('../src/services/catalogueSourceRegistry.js');
const { getDb, saveDb } = await import('../src/database.js');

const db = await getDb();
let sourceId = '';
try {
  const source = await registerCatalogueSource({ sourceType: 'whatsapp', name: 'CI WhatsApp Shop', ownerPartyId: 'ci_business', connected: true, verified: true });
  sourceId = source.id;
  const product = await upsertCatalogueProduct({ sourceId, title: 'Fresh eggs tray', category: 'seller', location: 'Ikeja', price: 4500, currency: 'NGN', available: true, stock: 12, verified: true, sourceUrl: 'https://example.invalid/catalogue/eggs' });
  assert.equal(product.title, 'Fresh eggs tray');
  const results = await searchCatalogueProducts({ query: 'eggs', location: 'Ikeja' });
  assert.ok(results.some(item => item.id === product.id));
  console.log(JSON.stringify({ passed: true, sourceId, productId: product.id }, null, 2));
} finally {
  if (sourceId) {
    db.run('DELETE FROM catalogue_products WHERE source_id=?', [sourceId]);
    db.run('DELETE FROM catalogue_sources WHERE id=?', [sourceId]);
    saveDb(true);
  }
}

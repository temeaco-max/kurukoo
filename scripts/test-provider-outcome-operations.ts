import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-operations-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
const { addEconomicParticipant } = await import('../src/services/economicParticipants.js');
const { getProviderOutcomeOperations } = await import('../src/services/providerOutcomeOperations.js');

try {
  const db = await getDb();
  db.run(`INSERT INTO memory_profiles (phone,name,country,verified_provider,is_available) VALUES ('+234700009001','Ops provider','ng',1,1),('+234700009002','Ops customer','ng',0,1)`);
  const supply = await createEconomicRequest({ id: 'ops-supply', phone: '+234700009002', skill: 'order_food', requirements: { items: 'rice', location: 'Ikeja' } });
  const evidence = await createEconomicRequest({ id: 'ops-evidence', phone: '+234700009002', skill: 'repair', requirements: { device_or_asset: 'phone', issue: 'screen', location: 'Ikeja' } });
  await transitionEconomicRequest(evidence.id, 'awaiting_match'); await transitionEconomicRequest(evidence.id, 'matched', { providerPhone: '+234700009001' }); await transitionEconomicRequest(evidence.id, 'quoting'); await transitionEconomicRequest(evidence.id, 'quoted', { quote: { amount_minor: 5000, currency: 'NGN', confirmed: true } }); await transitionEconomicRequest(evidence.id, 'awaiting_confirmation'); await transitionEconomicRequest(evidence.id, 'reserved'); await transitionEconomicRequest(evidence.id, 'payment_pending'); await transitionEconomicRequest(evidence.id, 'paid');
  await addEconomicParticipant({ requestId: evidence.id, ownerPhone: '+234700009002', role: 'service_provider', providerPhone: '+234700009001', capability: 'repair', status: 'in_progress', evidence: { source: 'test' } });
  const view = await getProviderOutcomeOperations();
  assert.equal(view.source, 'canonical_economic_requests');
  assert.equal(view.totals.supply, 1);
  assert.equal(view.totals.evidence, 1);
  assert.equal(view.providers[0]?.providerPhone, '+234700009001');
  assert.equal(view.categories.find(item => item.category === 'repairs-maintenance')?.active, 1);
  assert.equal(view.items.find(item => item.requestId === supply.id)?.attention, 'supply');
  saveDb(true);
  console.log('Provider outcome operations projection regression passed');
} finally { try { fs.rmSync(dbPath, { force: true }); } catch {} }

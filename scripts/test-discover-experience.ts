import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { upsertDiscoveryEntity } from '../src/services/discoveryNetwork.js';
import { getDiscoverHome, processDiscoverWatches, getDiscoverHome as getHome, recordDiscoverAction, removeDiscoverAction } from '../src/services/discoverExperience.js';

const id = `discover-contract-${Date.now()}`;
const phone = `discover-contract-user-${Date.now()}`;
const db = await getDb();
try {
  await upsertDiscoveryEntity({ id, entityType: 'business', lifecycle: 'opportunity', name: 'Contract daily pick', detail: '10% discount today', category: 'food', source: 'contract-test', latitude: 6.5244, longitude: 3.3792, freshnessAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(), evidenceLevel: 'verified_state', claimed: true, verified: true, available: true });
  const home = await getDiscoverHome({ latitude: 6.5244, longitude: 3.3792, radiusMetres: 10000 }, phone);
  const item = [...home.sections.for_you, ...home.sections.today, ...home.sections.opportunities].find((candidate) => candidate.id === id);
  assert.ok(item, 'live discovery entity should enter unified Discover feed');
  assert.equal(item?.verified, true);
  assert.equal(item?.available, true);
  assert.equal(item?.sponsored, false);
  const action = await recordDiscoverAction(phone, 'discovery', id, 'watch');
  assert.equal(action.ok, true);
  const watched = await getHome({ latitude: 6.5244, longitude: 3.3792, radiusMetres: 10000 }, phone);
  assert.ok(watched.watchedItemIds.includes(`discovery:${id}`), 'watch must persist into Discover state');
  const seeded = await processDiscoverWatches(50);
  assert.equal(seeded.notified, 0, 'initial watch observation must not notify');
  db.run("UPDATE discovery_entities SET available=0, lifecycle='candidate', expires_at=? WHERE id=?", [new Date(Date.now() + 24 * 60 * 60_000).toISOString(), id]);
  saveDb(true);
  const changed = await processDiscoverWatches(50);
  assert.ok(changed.changed >= 1, 'watch state change must be detected');
  assert.ok(changed.notified >= 1, 'watch state change must enter notification queue');
  const notification = db.exec("SELECT title,delivery_state FROM internal_notifications WHERE phone=? ORDER BY id DESC LIMIT 1", [phone])[0]?.values?.[0];
  assert.equal(String(notification?.[1] || ''), 'queued');
  await removeDiscoverAction(phone, 'discovery', id, 'watch');
  console.log(JSON.stringify({ passed: true, density: home.density, sections: Object.fromEntries(Object.entries(home.sections).map(([key, items]) => [key, items.length])), watchChange: changed }, null, 2));
} finally {
  db.run('DELETE FROM discovery_entities WHERE id=?', [id]);
  db.run('DELETE FROM discover_interests WHERE phone=?', [phone]);
  db.run('DELETE FROM internal_notifications WHERE phone=?', [phone]);
  saveDb(true);
}

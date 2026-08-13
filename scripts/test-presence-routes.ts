import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-presence-routes-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'presence_routes_test_secret_with_32_chars';
process.env.KURUKOO_CONTROLLED_PILOT = 'false';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const presenceRouter = (await import('../src/routes/presenceRoutes.js')).default;
const db = await getDb();
const providerPhone = '+2348010003003';
const otherPhone = '+2348010003004';

db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available,points_balance,subscription_tier) VALUES(?,?,?,?,?,?,?,?,?)`, [providerPhone, 'Mobile repair provider', 'Ikeja', 'ng', 1, 'human', 1, 30, 'Base']);
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available,points_balance,subscription_tier) VALUES(?,?,?,?,?,?,?,?,?)`, [otherPhone, 'Other provider', 'Ikeja', 'ng', 1, 'human', 1, 30, 'Base']);
db.run(`INSERT OR REPLACE INTO skills(phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode,service_radius_km) VALUES(?,?,?,?,?,?,?,?)`, [providerPhone, 'phone_repairer', 1, 250000, 4.9, 12, 'mobile', 8]);
saveDb();

const stack = (presenceRouter as any).stack || [];
const routes = stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
const expected = [
  ['GET', '/api/stats/pulse'],
  ['POST', '/api/presence/go-live'],
  ['POST', '/api/presence/update'],
  ['POST', '/api/presence/end'],
  ['GET', '/api/presence/me'],
  ['POST', '/api/pulse/live'],
  ['POST', '/api/pulse/activate'],
  ['POST', '/api/pulse/update'],
  ['POST', '/api/pulse/deactivate'],
  ['GET', '/api/pulse/status'],
  ['GET', '/api/pulse/providers'],
];
for (const [method, routePath] of expected) {
  const route = routes.find((item: any) => item.path === routePath && item.methods.includes(method.toLowerCase()));
  assert.ok(route, `Missing ${method} ${routePath}`);
}

const sign = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const auth = (phone: string) => ({ Authorization: `Bearer ${sign(phone)}`, 'Content-Type': 'application/json' });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const unauthenticated = await fetch(`${baseUrl}/api/presence/go-live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill: 'phone_repairer', lat: 6.5, lng: 3.4 }) });
  assert.equal(unauthenticated.status, 401, 'Go Live must require an authenticated provider');

  const invalidCoordinates = await fetch(`${baseUrl}/api/presence/go-live`, { method: 'POST', headers: auth(providerPhone), body: JSON.stringify({ skill: 'phone_repairer', lat: 91, lng: 3.4 }) });
  assert.equal(invalidCoordinates.status, 400, 'Go Live must reject invalid coordinates rather than using a fallback');

  const ineligibleSkill = await fetch(`${baseUrl}/api/presence/go-live`, { method: 'POST', headers: auth(providerPhone), body: JSON.stringify({ skill: 'generic_service_provider', lat: 6.5244, lng: 3.3792 }) });
  assert.equal(ineligibleSkill.status, 409, 'Go Live must require an actual available mobile skill');

  const activated = await fetch(`${baseUrl}/api/presence/go-live`, { method: 'POST', headers: auth(providerPhone), body: JSON.stringify({ skill: 'phone_repairer', lat: 6.5244, lng: 3.3792 }) });
  const activatedBody = await activated.json() as { success?: boolean; message?: string; expiresAt?: string };
  assert.equal(activated.status, 200, JSON.stringify(activatedBody));
  assert.equal(activatedBody.success, true);
  assert.ok(activatedBody.expiresAt, 'Go Live should disclose its bounded expiry');
  assert.match(String(activatedBody.message), /no external broadcast/i, 'Go Live must explicitly avoid claiming an external broadcast');

  const presenceRow = db.exec(`SELECT is_live,last_lat,last_lng,fuzzed_lat,fuzzed_lng,live_until FROM provider_presence WHERE phone='${providerPhone}'`)[0]?.values?.[0] as unknown[] | undefined;
  assert.ok(presenceRow, 'Go Live must create the shared canonical provider presence record');
  assert.equal(Number(presenceRow?.[0]), 1);
  assert.equal(Number(presenceRow?.[1]), 6.5244);
  assert.equal(Number(presenceRow?.[2]), 3.3792);
  assert.ok(Number.isFinite(Number(presenceRow?.[3])) && Number.isFinite(Number(presenceRow?.[4])), 'Trick Bridge must persist public fuzzed coordinates');
  assert.ok(String(presenceRow?.[5]).length > 10, 'presence must retain a time-bounded expiry');

  const state = await fetch(`${baseUrl}/api/presence/me`, { headers: auth(providerPhone) });
  const stateBody = await state.json() as { presence?: { active?: boolean; skill?: string; source?: string } };
  assert.equal(state.status, 200);
  assert.deepEqual(stateBody.presence?.active, true);
  assert.equal(stateBody.presence?.skill, 'phone_repairer');
  assert.equal(stateBody.presence?.source, 'mobile');

  const forbiddenUpdate = await fetch(`${baseUrl}/api/presence/update`, { method: 'POST', headers: auth(otherPhone), body: JSON.stringify({ phone: providerPhone, lat: 6.525, lng: 3.38 }) });
  assert.equal(forbiddenUpdate.status, 403, 'another account cannot update a provider presence session');

  const updated = await fetch(`${baseUrl}/api/presence/update`, { method: 'POST', headers: auth(providerPhone), body: JSON.stringify({ lat: 6.525, lng: 3.38, movementMeters: 75 }) });
  assert.equal(updated.status, 200, 'the active provider can update their own bounded presence');
  const updatedBody = await updated.json() as { success?: boolean; message?: string };
  assert.equal(updatedBody.success, true);
  assert.doesNotMatch(String(updatedBody.message), /broadcast|dispatch|delivery|fulfilled/i);

  const providers = await fetch(`${baseUrl}/api/pulse/providers`, { headers: auth(providerPhone) });
  const providersBody = await providers.json() as { providers?: Array<Record<string, unknown>> };
  assert.equal(providers.status, 200);
  const listedProvider = providersBody.providers?.find((provider) => provider.skill === 'phone_repairer');
  assert.ok(listedProvider, 'the verified active provider should be listed among any seeded live providers');
  assert.equal('lat' in listedProvider, false, 'the legacy provider list must not disclose coordinates');
  assert.equal('phone' in listedProvider, false, 'the legacy provider list must not disclose direct identifiers');

  const ended = await fetch(`${baseUrl}/api/presence/end`, { method: 'POST', headers: auth(providerPhone), body: '{}' });
  const endedBody = await ended.json() as { success?: boolean; message?: string };
  assert.equal(ended.status, 200);
  assert.equal(endedBody.success, true);
  assert.doesNotMatch(String(endedBody.message), /broadcast|dispatch|delivery|fulfilled/i);

  const finalState = await fetch(`${baseUrl}/api/presence/me`, { headers: auth(providerPhone) });
  assert.equal((await finalState.json() as { presence?: { active?: boolean } }).presence?.active, false, 'ended sessions must not remain live');

  console.log(`Presence route regression passed: ${expected.length} routes, authenticated Go Live lifecycle, exact-skill eligibility, no fallback coordinates, Trick Bridge projection, and privacy-safe legacy aliases.`);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}

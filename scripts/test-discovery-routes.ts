import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-discovery-routes-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'discovery_routes_test_secret_with_32_chars';
process.env.KURUKOO_CONTROLLED_PILOT = 'false';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const { activatePulse } = await import('../src/services/nearbyPulse.js');
const discoveryRouter = (await import('../src/routes/discoveryRoutes.js')).default;
const db = await getDb();
const providerPhone = '+2348010004004';
const stationaryPhone = '+2348010004005';

db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available,points_balance,subscription_tier) VALUES(?,?,?,?,?,?,?,?,?)`, [providerPhone, 'Radar repair provider', 'Ikeja', 'ng', 1, 'human', 1, 30, 'Base']);
db.run(`INSERT OR REPLACE INTO skills(phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode,service_radius_km) VALUES(?,?,?,?,?,?,?,?)`, [providerPhone, 'phone_repairer', 1, 250000, 4.9, 12, 'mobile', 8]);
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available,points_balance,subscription_tier) VALUES(?,?,?,?,?,?,?,?,?)`, [stationaryPhone, 'Radar stationary provider', 'Ikeja', 'ng', 1, 'business', 1, 30, 'Base']);
db.run(`INSERT OR REPLACE INTO skills(phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode,service_radius_km) VALUES(?,?,?,?,?,?,?,?)`, [stationaryPhone, 'phone_accessories', 1, 250000, 4.9, 12, 'stationary', 8]);
saveDb();

const stack = (discoveryRouter as any).stack || [];
const route = stack.find((layer: any) => layer.route?.path === '/api/discover/map' && layer.route.methods.get);
assert.ok(route, 'Missing GET /api/discover/map');
const activation = await activatePulse(providerPhone, 'phone_repairer', 6.5244, 3.3792);
assert.equal(activation.success, true, activation.message);
const stationaryActivation = await activatePulse(stationaryPhone, 'phone_accessories', 6.5245, 3.3793, 'stationary');
assert.equal(stationaryActivation.success, true, stationaryActivation.message);

const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const invalidCoordinates = await fetch(`${baseUrl}/api/discover/map?lat=200&lng=3.3792`);
  const invalidCoordinatesBody = await invalidCoordinates.text();
  assert.equal(invalidCoordinates.status, 400, `Radar must reject impossible query coordinates: ${invalidCoordinatesBody}`);

  const response = await fetch(`${baseUrl}/api/discover/map?lat=6.5244&lng=3.3792&radius=10000&layers=mobile,stationary,agents,emergency`);
  const payload = await response.json() as {
    type?: string;
    features?: Array<{ type?: string; geometry?: { type?: string; coordinates?: unknown[] }; properties?: Record<string, unknown> }>;
    meta?: { exactCoordinatesExposed?: boolean; layers?: Record<string, { available?: boolean; reason?: string }> };
  };
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.type, 'FeatureCollection');
  assert.equal(payload.meta?.exactCoordinatesExposed, false, 'Radar must explicitly deny exact-coordinate exposure');
  assert.equal(payload.meta?.layers?.mobile?.available, true, 'mobile providers are backed by canonical presence');
  assert.equal(payload.meta?.layers?.stationary?.available, true, 'stationary providers are backed by the same canonical presence lifecycle');
  assert.ok(payload.features?.some((entry) => entry.properties?.layer === 'stationary' && entry.properties?.detail === 'phone_accessories'), `a stationary provider must be projected through the stationary Radar layer: ${JSON.stringify(payload.features)}`);
  assert.equal(payload.meta?.layers?.agents?.available, false, 'agents must not be represented as a live geographic feed');
  assert.match(String(payload.meta?.layers?.agents?.reason || ''), /not configured/i);
  assert.equal(payload.meta?.layers?.emergency?.available, false, 'emergency must not be represented as a live dispatch feed');
  assert.match(String(payload.meta?.layers?.emergency?.reason || ''), /does not provide/i);

  const feature = payload.features?.[0];
  assert.ok(feature, 'the verified active provider should produce one mobile Radar feature');
  assert.equal(feature?.type, 'Feature');
  assert.equal(feature?.geometry?.type, 'Point');
  assert.equal(Array.isArray(feature?.geometry?.coordinates), true, 'public coordinates must be carried only in GeoJSON geometry');
  assert.equal(feature?.geometry?.coordinates?.length, 2);
  assert.equal('lat' in (feature?.properties || {}), false, 'properties must not contain raw latitude');
  assert.equal('lng' in (feature?.properties || {}), false, 'properties must not contain raw longitude');
  assert.equal('phone' in (feature?.properties || {}), false, 'properties must not contain a direct provider identifier');
  assert.equal(feature?.properties?.locationPrecision, 'approximate_100m');
  assert.notEqual(Number(feature?.geometry?.coordinates?.[0]), 0, 'absent fuzzed coordinates must not become a zero marker');
  assert.notEqual(Number(feature?.geometry?.coordinates?.[1]), 0, 'absent fuzzed coordinates must not become a zero marker');

  const unavailableOnly = await fetch(`${baseUrl}/api/discover/map?lat=6.5244&lng=3.3792&radius=10000&layers=agents,events,deals`);
  const unavailablePayload = await unavailableOnly.json() as { features?: unknown[]; meta?: { layers?: Record<string, { available?: boolean; reason?: string }> } };
  assert.equal(unavailableOnly.status, 200);
  assert.deepEqual(unavailablePayload.features, [], 'unavailable layers must return no synthetic features');
  for (const layer of ['agents', 'events', 'deals']) {
    assert.equal(unavailablePayload.meta?.layers?.[layer]?.available, false, `${layer} must be explicitly unavailable`);
    assert.ok(unavailablePayload.meta?.layers?.[layer]?.reason, `${layer} needs an explanatory reason`);
  }

  console.log('Discovery route regression passed: canonical verified presence, GeoJSON-only approximate projection, data-backed layers, and explicit unavailable-layer truthfulness.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}

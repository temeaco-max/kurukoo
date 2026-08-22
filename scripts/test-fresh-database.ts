import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';

const childMode = process.argv[2];
const childDbPath = process.argv[3];

if (childMode === '--persistence-child-write' || childMode === '--persistence-child-read') {
  if (!childDbPath) throw new Error('Child persistence mode requires DB_PATH argument');
  process.env.DB_PATH = childDbPath;
  process.env.JWT_SECRET = 'fresh-database-test-secret-0123456789';
  process.env.ADMIN_USERNAME = 'fresh-admin';
  process.env.ADMIN_PASSWORD = 'fresh-admin-password';
  process.env.KURUKOO_DISABLE_LISTEN = 'true';
  process.env.KURUKOO_DEV_AUTH = 'false';
  const { getDb, saveDb } = await import('../src/database.js');
  const db = await getDb();
  if (childMode === '--persistence-child-write') {
    db.run("INSERT OR REPLACE INTO memory_profiles (phone, name, email) VALUES (?, ?, ?)", ['+2348111111111', 'Restart User', 'restart@example.com']);
    db.run("INSERT INTO messages (phone, sender, content, channel) VALUES (?, ?, ?, ?)", ['+2348111111111', 'user', 'restart-persistence-message', 'pwa']);
    db.run("INSERT OR REPLACE INTO economic_requests (id, phone, skill, category, status, requirements_json, capabilities_json) VALUES (?, ?, ?, ?, ?, ?, ?)", ['restart-request', '+2348111111111', 'test_skill', 'test', 'requested', '{}', '[]']);
    db.run("INSERT INTO internal_notifications (phone, title, body, idempotency_key) VALUES (?, ?, ?, ?)", ['+2348111111111', 'Restart', 'restart notification', 'restart-notification-key']);
    db.run("INSERT OR IGNORE INTO orders (id, phone, order_type, amount, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)", ['restart-order', '+2348111111111', 'test', 100, 'requested', 'restart-order-key']);
    db.run("INSERT OR IGNORE INTO orders (id, phone, order_type, amount, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)", ['restart-order-duplicate', '+2348111111111', 'test', 100, 'requested', 'restart-order-key']);
    const { createAuthChallenge } = await import('../src/services/authChallengeService.js');
    await createAuthChallenge({ phone: '+2348111111111', purpose: 'login', channel: 'web_link' });
    saveDb(true);
    console.log('persistence-child-write: ok');
  } else {
    const memory = Number(db.exec("SELECT COUNT(*) FROM memory_profiles WHERE phone='+2348111111111' AND email='restart@example.com'")[0]?.values?.[0]?.[0] || 0);
    const messages = Number(db.exec("SELECT COUNT(*) FROM messages WHERE phone='+2348111111111' AND content='restart-persistence-message'")[0]?.values?.[0]?.[0] || 0);
    const requests = Number(db.exec("SELECT COUNT(*) FROM economic_requests WHERE id='restart-request'")[0]?.values?.[0]?.[0] || 0);
    const notifications = Number(db.exec("SELECT COUNT(*) FROM internal_notifications WHERE idempotency_key='restart-notification-key'")[0]?.values?.[0]?.[0] || 0);
    const orders = Number(db.exec("SELECT COUNT(*) FROM orders WHERE idempotency_key='restart-order-key'")[0]?.values?.[0]?.[0] || 0);
    const challenges = Number(db.exec("SELECT COUNT(*) FROM auth_challenges WHERE phone='+2348111111111' AND purpose='login'")[0]?.values?.[0]?.[0] || 0);
    assert.equal(memory, 1, 'memory must survive process restart');
    assert.equal(messages, 1, 'chat message must survive process restart');
    assert.equal(requests, 1, 'economic request must survive process restart');
    assert.equal(notifications, 1, 'notification must survive process restart');
    assert.equal(orders, 1, 'idempotency key must remain unique after process restart');
    assert.equal(challenges, 1, 'auth challenge must survive process restart');
    console.log('persistence-child-read: ok');
  }
  process.exit(0);
}

const runChild = (mode: string, dbPath: string): Promise<string> => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], mode, dbPath], { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${mode} exited ${code}: ${stderr || stdout}`)));
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-fresh-db-'));
process.env.DB_PATH = path.join(tempDir, 'fresh.sqlite');
process.env.JWT_SECRET = 'fresh-database-test-secret-0123456789';
process.env.ADMIN_USERNAME = 'fresh-admin';
process.env.ADMIN_PASSWORD = 'fresh-admin-password';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_DEV_AUTH = 'false';

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { sendFcmPush } = await import('../src/services/pushNotifications.js');
const { getPilotReadiness } = await import('../src/services/pilotReadiness.js');
const { registerConnectedResource, activateConnectedResource, viewConnectedResource } = await import('../src/services/connectedResourceService.js');
const { getPersistenceReadiness } = await import('../src/services/persistenceReadiness.js');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;
try {
  const db = await getDb();
  const requiredTables = ['memory_profiles', 'messages', 'economic_requests', 'internal_notifications', 'topics', 'trust_score_ledger'];
  for (const table of requiredTables) assert.ok(db.exec(`SELECT 1 FROM ${table} LIMIT 1`) || true, `fresh schema must create ${table}`);
  for (const route of ['/health', '/channels', '/topics', '/sitemap-topics.xml', '/robots.txt', '/discover', '/resources', '/pricing']) {
    const response = await fetch(`${base}${route}`, { redirect: 'manual' });
    assert.ok([200, 301, 302].includes(response.status), `fresh runtime route should be available: ${route}`);
  }
  assert.equal((await sendFcmPush('+2348000000000', 'Fresh DB', 'Internal notification')).valueOf(), false, 'missing FCM must not claim external delivery');
  const notifications = db.exec("SELECT delivery_state FROM internal_notifications WHERE phone='+2348000000000'");
  assert.equal(notifications[0]?.values?.[0]?.[0], 'queued', 'fresh notification must persist queued delivery state');
  const readiness = getPilotReadiness(process.env, process.cwd());
  assert.ok(['NOT_CONFIGURED', 'EXTERNAL_DEPENDENCY'].includes(String(readiness.categories.CHANNELS.FCM.state)), 'fresh FCM readiness must remain inactive when credentials/device evidence are absent');
  assert.equal(readiness.categories.AGENT.runtime.state, 'DISABLED');

  const localPersistence = getPersistenceReadiness({ NODE_ENV: 'production', KURUKOO_DATABASE_MODE: 'sqljs', KURUKOO_WORKERS: '1', DB_PATH: path.join(tempDir, 'local.sqlite') });
  assert.equal(localPersistence.state, 'READY', 'single-process SQL.js should remain available as the low-cost non-Cloud-Run persistence mode');
  assert.equal(localPersistence.concurrentWriterSafe, false);
  const cloudRunPersistence = getPersistenceReadiness({ NODE_ENV: 'production', KURUKOO_DATABASE_MODE: 'sqljs', KURUKOO_WORKERS: '1', KURUKOO_CLOUD_RUN: 'true', DB_PATH: '/app/data/kurukoo.sqlite' });
  assert.equal(cloudRunPersistence.state, 'BLOCKED', 'Cloud Run must block SQL.js canonical persistence');
  assert.equal(cloudRunPersistence.durableCanonicalState, false);
  const postgresPersistence = getPersistenceReadiness({ NODE_ENV: 'production', KURUKOO_DATABASE_MODE: 'postgres', DATABASE_URL: 'postgres://ci-placeholder', KURUKOO_WORKERS: '1' });
  assert.equal(postgresPersistence.state, 'BLOCKED', 'Postgres must remain blocked until the shared persistence adapter is actually implemented and cut over');
  const unknownPersistence = getPersistenceReadiness({ NODE_ENV: 'production', KURUKOO_DATABASE_MODE: 'firestore', KURUKOO_WORKERS: '1' });
  assert.equal(unknownPersistence.state, 'UNVERIFIED', 'unsupported persistence mode must not be treated as safe');

  const restartDbPath = path.join(tempDir, 'restart.sqlite');
  await runChild('--persistence-child-write', restartDbPath);
  await runChild('--persistence-child-read', restartDbPath);
  console.log('Process-restart persistence regression passed: Memory/auth/chat/request/notification state survives a real child-process restart and idempotency remains unique. Multi-instance Cloud Run safety remains intentionally unverified and blocked.');

  const registration = await registerConnectedResource({ phone: '+2348000000000', kind: 'cctv', label: 'Back Garden Camera', protocol: 'mqtt', capabilities: ['view', 'control'], metadata: { baseTopic: 'kurukoo/device/back-garden' } });
  assert.equal(registration.resource.status, 'pending', 'new connected resources must never self-declare as active');
  assert.ok(/^\d{6}$/.test(registration.challenge.code), 'pairing challenge must be a six-digit one-time code');
  assert.equal(await viewConnectedResource('+2348000000000', registration.resource.id), null, 'pending connected resources must not expose their view');
  const activated = await activateConnectedResource('+2348000000000', registration.resource.id, registration.challenge.code);
  assert.equal(activated?.status, 'active', 'a valid pairing challenge must activate the exact owner-scoped resource');
  assert.ok(await viewConnectedResource('+2348000000000', registration.resource.id), 'activated connected resource should be viewable through the owner boundary');
  const replayedActivation = await activateConnectedResource('+2348000000000', registration.resource.id, registration.challenge.code);
  assert.equal(replayedActivation?.id, activated?.id, 'replaying a consumed pairing challenge must resolve only to the same canonical resource identity');
  assert.equal(replayedActivation?.status, 'active', 'replaying a consumed pairing challenge must not revoke or duplicate the active resource');

  console.log('Fresh database regression passed: schema bootstrap, core routes, internal notification queue, readiness state, Topics, trust, request tables, owner-scoped connected-resource pairing/activation, and persistence-boundary checks.');
} finally {
  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}

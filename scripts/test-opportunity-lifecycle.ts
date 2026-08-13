import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-opportunity-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'opportunity_lifecycle_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { createOpenIntention } = await import('../src/services/deferredRequestService.js');

const token = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = (phone: string) => ({ Authorization: `Bearer ${token(phone)}`, 'Content-Type': 'application/json' });
const owner = '+2347000000771';
const otherOwner = '+2347000000772';
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

async function request(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  return { response, body: await response.json().catch(() => ({})) };
}

try {
  const anonymous = await request('/api/opportunities');
  assert.equal(anonymous.response.status, 401, 'opportunity feed must require an authenticated owner');

  const db = await getDb();
  db.run('INSERT INTO memory_profiles(phone,name,country) VALUES (?,?,?)', [owner, 'Owner', 'ng']);
  db.run('INSERT INTO memory_profiles(phone,name,country) VALUES (?,?,?)', [otherOwner, 'Other owner', 'ng']);
  const intention = await createOpenIntention(owner, 'plumber repair', JSON.stringify({ location: 'Ikeja' }), { skill: 'plumber', ttlDays: 1 });
  assert.ok(intention?.id, 'a canonical deferred intention is required as opportunity evidence');

  const first = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(first.response.status, 200, first.body.error);
  const opportunities = first.body.opportunities || [];
  assert.equal(opportunities.length, 1, 'only the owner’s canonical deferred intention should produce a suggestion without active matching campaign evidence');
  const opportunity = opportunities[0];
  assert.equal(opportunity.sourceType, 'deferred_intention');
  assert.equal(String(opportunity.sourceId), String(intention.id));
  assert.match(opportunity.ctaLink, /^\/chat\?prompt=/, 'opportunity continuation must return to canonical Web Chat');
  assert.doesNotMatch(`${opportunity.title} ${opportunity.subtitle}`, /daily engagement|claim bonus|\+1 point|multiple people|₦|nearby verified providers/i, 'the feed must not fabricate rewards, demand, monetary price, or provider availability');

  const repeat = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(repeat.response.status, 200);
  assert.equal(repeat.body.opportunities.length, 1, 'repeated feed reads must be idempotent rather than create duplicates');
  const stored = db.exec('SELECT COUNT(*) FROM proactive_opportunities WHERE phone=?', [owner])[0]?.values?.[0]?.[0];
  assert.equal(Number(stored), 1, 'one canonical source signal must persist one owner-scoped opportunity record');

  const isolated = await request('/api/opportunities', { headers: headers(otherOwner) });
  assert.equal(isolated.response.status, 200);
  assert.equal(isolated.body.opportunities.length, 0, 'other owners cannot receive another owner’s opportunity or source context');
  const foreignDismiss = await request(`/api/opportunities/${opportunity.id}/dismiss`, { method: 'POST', headers: headers(otherOwner) });
  assert.equal(foreignDismiss.response.status, 404, 'other owners cannot mutate an opportunity');

  const dismissed = await request(`/api/opportunities/${opportunity.id}/dismiss`, { method: 'POST', headers: headers(owner) });
  assert.equal(dismissed.response.status, 200, dismissed.body.error);
  const afterDismiss = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(afterDismiss.body.opportunities.length, 0, 'dismissal must suppress the same source opportunity rather than regenerate it');

  db.run(`UPDATE open_intentions SET expires_at=datetime('now','-1 minute') WHERE id=? AND phone=?`, [intention.id, owner]);
  const expiredOwner = '+2347000000773';
  db.run('INSERT INTO memory_profiles(phone,name,country) VALUES (?,?,?)', [expiredOwner, 'Expired owner', 'ng']);
  const expired = await createOpenIntention(expiredOwner, 'expired repair', '{}', { ttlDays: 1 });
  db.run(`UPDATE open_intentions SET expires_at=datetime('now','-1 minute') WHERE id=? AND phone=?`, [expired.id, expiredOwner]);
  const expiredFeed = await request('/api/opportunities', { headers: headers(expiredOwner) });
  assert.equal(expiredFeed.body.opportunities.length, 0, 'expired deferred requests must not produce a suggestion');

  console.log('Opportunity lifecycle regression passed');
  console.log('Verified: authenticated owner isolation, canonical deferred evidence, duplicate suppression, no fabricated supply/demand/price/reward, dismissal, and expiry.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

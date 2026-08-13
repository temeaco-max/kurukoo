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
const { getDailyPick } = await import('../src/services/dailyPicks.js');
const { createAdCampaign, setAdCampaignStatus } = await import('../src/services/adManager.js');
const { processProactiveOpportunities } = await import('../src/services/backgroundWorkers.js');
const { getInternalNotifications } = await import('../src/services/pushNotifications.js');

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

  const workerFirst = await processProactiveOpportunities(10);
  assert.equal(workerFirst.checked, 2, 'the proactive worker should inspect authenticated owners already in the profile store');
  assert.equal(workerFirst.notified, 1, 'the worker should turn the canonical deferred opportunity into an in-app notification');
  const workerNotifications = await getInternalNotifications(owner, 10);
  assert.equal(workerNotifications.length, 1, 'the proactive opportunity should appear in the existing notification inbox');
  assert.equal(workerNotifications[0].delivery_state, 'queued', 'in-app notification remains truthfully queued until read');
  assert.match(workerNotifications[0].link, /^\/chat\?prompt=/, 'proactive notification should deep-link to canonical Chat');

  const workerRepeat = await processProactiveOpportunities(10);
  assert.equal(workerRepeat.checked, 2);
  assert.equal(workerRepeat.notified, 1, 'replaying the worker must remain idempotent at the notification layer');
  assert.equal((await getInternalNotifications(owner, 10)).length, 1, 'replaying the worker must not duplicate notifications');

  const repeat = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(repeat.response.status, 200);
  assert.equal(repeat.body.opportunities.length, 1, 'repeated feed reads must be idempotent rather than create duplicates');
  const stored = db.exec('SELECT COUNT(*) FROM proactive_opportunities WHERE phone=?', [owner])[0]?.values?.[0]?.[0];
  assert.equal(Number(stored), 1, 'one canonical source signal must persist one owner-scoped opportunity record');

  const campaign = await createAdCampaign({
    title: 'Disclosed plumber campaign',
    desc: 'A disclosed placement for a plumbing request. It is not a provider, price, or availability claim.',
    imageUrl: '',
    targetKeyword: '',
    targetCategories: ['repairs-maintenance'],
    placementIds: ['workspace_daily_picks_sponsor'],
    creditsBudget: 10,
    placementSource: 'external_inventory',
    disclosure: 'External advertisement',
  });
  const sponsoredFeed = await request('/api/opportunities', { headers: headers(owner) });
  const sponsoredOpportunity = (sponsoredFeed.body.opportunities || []).find((item: any) => item.sourceType === 'ad_campaign' && String(item.sourceId) === String(campaign.campaign.id));
  assert.ok(sponsoredOpportunity, 'an active disclosed campaign may project through the canonical owner-scoped opportunity feed');
  assert.equal(sponsoredOpportunity.disclosure, 'External advertisement');
  assert.match(sponsoredOpportunity.subtitle, /not a provider, price, or availability claim/i);
  await setAdCampaignStatus(campaign.campaign.id, 'paused');
  const afterCampaignPause = await request('/api/opportunities', { headers: headers(owner) });
  assert.ok(!(afterCampaignPause.body.opportunities || []).some((item: any) => item.sourceType === 'ad_campaign' && String(item.sourceId) === String(campaign.campaign.id)), 'a stored campaign opportunity must stop projecting when its canonical campaign is paused');

  const isolated = await request('/api/opportunities', { headers: headers(otherOwner) });
  assert.equal(isolated.response.status, 200);
  assert.equal(isolated.body.opportunities.length, 0, 'other owners cannot receive another owner’s opportunity or source context');
  const foreignDismiss = await request(`/api/opportunities/${opportunity.id}/dismiss`, { method: 'POST', headers: headers(otherOwner) });
  assert.equal(foreignDismiss.response.status, 404, 'other owners cannot mutate an opportunity');

  const dismissed = await request(`/api/opportunities/${opportunity.id}/dismiss`, { method: 'POST', headers: headers(owner) });
  assert.equal(dismissed.response.status, 200, dismissed.body.error);
  const afterDismiss = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(afterDismiss.body.opportunities.length, 0, 'dismissal must suppress the same source opportunity rather than regenerate it');

  const pointsBeforeTopic = Number(db.exec(`SELECT COALESCE(points_balance, 0) FROM memory_profiles WHERE phone=?`, [owner])[0].values[0][0]);
  const topicId = '00000000-0000-4000-8000-000000000001';
  db.run(`INSERT INTO topics(id,slug,author_phone,title,body,type,category,skills_json,city,lga,status,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`, [
    topicId, 'safe-plumber-repair-questions-ikeja', owner,
    'Safe plumber repair questions in Ikeja',
    'This community-shared guide collects cautious questions about plumber repair in Ikeja. It explains how to ask for a written scope, compare a provider quote, and use Kurukoo for a separate supported next step. It does not confirm any named provider, current availability, price, booking, payment, delivery, repair outcome, or fulfilment. Treat it as a starting point for discussion and verify important details independently before acting.',
    'guide', 'repairs-maintenance', JSON.stringify(['plumber']), 'Ikeja', 'Ikeja', 'public',
  ]);
  const topicFeed = await request('/api/opportunities', { headers: headers(owner) });
  assert.equal(topicFeed.response.status, 200, topicFeed.body.error);
  const topicOpportunity = (topicFeed.body.opportunities || []).find((item: any) => item.sourceType === 'topic');
  assert.ok(topicOpportunity, 'a meaningful public Topic may project through the existing owner-scoped opportunity feed');
  assert.equal(topicOpportunity.sourceId, topicId);
  assert.equal(topicOpportunity.disclosure, 'Community-shared context');
  assert.equal(topicOpportunity.ctaLink, '/chat?topic=safe-plumber-repair-questions-ikeja');
  assert.match(topicOpportunity.subtitle, /not verified provider, price, availability/i);
  assert.doesNotMatch(`${topicOpportunity.title} ${topicOpportunity.subtitle}`, /₦|bonus|confirmed quote|delivery available/i, 'Topic Daily Picks must not fabricate a commercial or fulfilment fact');
  const legacyPick = await getDailyPick(owner);
  assert.equal(legacyPick.kind, 'opportunity', 'the legacy single-pick helper must project canonical opportunities rather than fabricate products');
  assert.equal((legacyPick as any).sourceType, 'topic');
  const topicPoints = db.exec(`SELECT COALESCE(points_balance, 0) FROM memory_profiles WHERE phone=?`, [owner]);
  assert.equal(Number(topicPoints[0].values[0][0]), pointsBeforeTopic, 'a Topic-derived Daily Pick must not award Points');
  db.run(`UPDATE open_intentions SET expires_at=datetime('now','-1 minute') WHERE id=? AND phone=?`, [intention.id, owner]);

  const expiredOwner = '+2347000000773';
  db.run('INSERT INTO memory_profiles(phone,name,country) VALUES (?,?,?)', [expiredOwner, 'Expired owner', 'ng']);
  const expired = await createOpenIntention(expiredOwner, 'expired repair', '{}', { ttlDays: 1 });
  db.run(`UPDATE open_intentions SET expires_at=datetime('now','-1 minute') WHERE id=? AND phone=?`, [expired.id, expiredOwner]);
  const expiredFeed = await request('/api/opportunities', { headers: headers(expiredOwner) });
  assert.equal(expiredFeed.body.opportunities.length, 0, 'expired deferred requests must not produce a suggestion');

  console.log('Opportunity lifecycle regression passed');
  console.log('Verified: authenticated owner isolation, canonical deferred, proactive notification worker integration, active-campaign and public Topic evidence, duplicate suppression, paused campaign exclusion, labelled community-context handoff, no fabricated supply/demand/price/reward, dismissal, and expiry.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

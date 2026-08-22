import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-relationships-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'relationship-test-secret-that-is-long-enough';

const { app } = await import('../src/index.js');
app.set('trust proxy', true);
const { getDb, saveDb } = await import('../src/database.js');
const { blockRelationshipActor } = await import('../src/services/relationshipService.js');
const { listSafetyContacts } = await import('../src/services/safetyService.js');
const db = await getDb();

const author = '+2348010031001';
const follower = '+2348010031002';
const participant = '+2348010031003';
const provider = '+2348010031004';
const publicPerson = '+2348010031005';
const privatePerson = '+2348010031006';
const moderator = '+2348010031099';

for (const [phone, name, visibility] of [
  [author, 'Topic Author', 'private'],
  [follower, 'Follower', 'private'],
  [participant, 'Reply Member', 'private'],
  [provider, 'Public Provider', 'public'],
  [publicPerson, 'Public Person', 'public'],
  [privatePerson, 'Private Person', 'private'],
  [moderator, 'Moderator', 'private'],
] as const) {
  db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier,relationship_visibility) VALUES(?,?,?,?,?,?)`, [phone, name, 'ng', 0, 'Base', visibility]);
}
db.run(`INSERT INTO skills(phone,skill) VALUES(?,?)`, [provider, 'generator_repairer']);
db.run(`INSERT INTO ai_agents(id,name,status) VALUES(?,?,?)`, ['eligible-agent', 'Eligible Agent', 'active']);
saveDb(true);

const token = (phone: string, role = 'user') => jwt.sign({ phone, role }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = (phone: string, role = 'user') => ({ Authorization: `Bearer ${token(phone, role)}`, 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${Number(phone.slice(-2)) || 1}` });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(pathname: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

function queuedRelationshipNotifications() {
  const rows = db.exec(`SELECT id,delivery_state,object_id FROM internal_notifications WHERE object_type='relationship' ORDER BY id ASC`);
  return (rows[0]?.values || []).map((row: unknown[]) => ({ id: Number(row[0]), deliveryState: String(row[1]), relationshipId: String(row[2]) }));
}

try {
  const created = await request('/api/topics', {
    method: 'POST', headers: { ...headers(author), 'Idempotency-Key': 'relationship-topic-create-0001' },
    body: JSON.stringify({
      title: 'How should our community track safe repair guidance?',
      body: 'This public discussion is for moderated safety guidance and must remain distinct from provider verification, availability, price, booking, payment, or fulfilment claims. It should help people identify useful context before asking Kurukoo for a supported next step.',
      type: 'question', category: 'repairs-maintenance', skills: ['generator_repairer'], city: 'Ibadan', lga: 'Ibadan North',
    }),
  });
  const createdPayload = await created.json() as { topic?: { id: string } };
  assert.equal(created.status, 201, JSON.stringify(createdPayload));
  const topicId = createdPayload.topic!.id;

  const published = await request(`/api/admin/topics/${topicId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public', note: 'Public community context, not a provider claim.' }) });
  assert.equal(published.status, 200, await published.text());

  const createFollow = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'topic', targetId: topicId, relationshipType: 'follow', context: { source: 'topic-detail' } }) });
  const createFollowPayload = await createFollow.json() as { relationship?: { id: string; status: string; notificationPreference: string }; idempotent?: boolean };
  assert.equal(createFollow.status, 201, JSON.stringify(createFollowPayload));
  assert.equal(createFollowPayload.relationship?.status, 'active');
  assert.equal(createFollowPayload.relationship?.notificationPreference, 'all');
  const relationshipId = createFollowPayload.relationship!.id;

  const duplicateFollow = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'topic', targetId: topicId, relationshipType: 'follow' }) });
  const duplicatePayload = await duplicateFollow.json() as { relationship?: { id?: string }; idempotent?: boolean };
  assert.equal(duplicateFollow.status, 200, JSON.stringify(duplicatePayload));
  assert.equal(duplicatePayload.idempotent, true);
  assert.equal(duplicatePayload.relationship?.id, relationshipId, 'duplicate follows must return the existing relationship');

  const reverseRelationships = await request('/api/relationships', { headers: headers(author) });
  assert.equal(reverseRelationships.status, 200);
  assert.equal((await reverseRelationships.json() as { relationships: unknown[] }).relationships.length, 0, 'Follow must remain unidirectional and private to its actor');

  const mute = await request(`/api/relationships/topic/${topicId}/preferences`, { method: 'PATCH', headers: headers(follower), body: JSON.stringify({ relationshipType: 'follow', notificationPreference: 'muted' }) });
  const mutePayload = await mute.json() as { relationship?: { notificationPreference?: string } };
  assert.equal(mute.status, 200, JSON.stringify(mutePayload));
  assert.equal(mutePayload.relationship?.notificationPreference, 'muted');

  const mutedReply = await request(`/api/topics/${topicId}/replies`, { method: 'POST', headers: headers(participant), body: JSON.stringify({ body: 'A moderated reply can add contextual guidance without turning this Topic into a provider guarantee or communication authority.' }) });
  const mutedReplyId = (await mutedReply.json() as { reply?: { id: string } }).reply!.id;
  assert.equal(mutedReply.status, 201);
  const moderateMutedReply = await request(`/api/admin/topics/replies/${mutedReplyId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public' }) });
  assert.equal(moderateMutedReply.status, 200, await moderateMutedReply.text());
  assert.equal(queuedRelationshipNotifications().length, 0, 'muted relationship updates must not enter the notification queue');

  const unmute = await request(`/api/relationships/topic/${topicId}/preferences`, { method: 'PATCH', headers: headers(follower), body: JSON.stringify({ relationshipType: 'follow', notificationPreference: 'all' }) });
  assert.equal(unmute.status, 200, await unmute.text());

  const activeReply = await request(`/api/topics/${topicId}/replies`, { method: 'POST', headers: headers(participant), body: JSON.stringify({ body: 'A second moderated reply creates a meaningful public Topic update that should use the existing notification system for a follower.' }) });
  const activeReplyId = (await activeReply.json() as { reply?: { id: string } }).reply!.id;
  const moderateActiveReply = await request(`/api/admin/topics/replies/${activeReplyId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public' }) });
  assert.equal(moderateActiveReply.status, 200, await moderateActiveReply.text());
  const deliveredUpdate = queuedRelationshipNotifications();
  assert.equal(deliveredUpdate.length, 1, 'an unmuted follow must create one canonical queued notification for a Topic update');
  assert.equal(deliveredUpdate[0].relationshipId, relationshipId);
  assert.equal(deliveredUpdate[0].deliveryState, 'queued');

  const unfollow = await request(`/api/relationships/topic/${topicId}`, { method: 'DELETE', headers: headers(follower) });
  const unfollowPayload = await unfollow.json() as { revoked?: boolean; suppressedNotifications?: number };
  assert.equal(unfollow.status, 200, JSON.stringify(unfollowPayload));
  assert.equal(unfollowPayload.revoked, true);
  assert.equal(unfollowPayload.suppressedNotifications, 1, 'unfollow must cancel queued relationship notifications');
  assert.equal(queuedRelationshipNotifications()[0].deliveryState, 'suppressed');

  const afterUnfollowReply = await request(`/api/topics/${topicId}/replies`, { method: 'POST', headers: headers(participant), body: JSON.stringify({ body: 'A third moderated reply confirms that future Topic updates no longer notify a user after they have unfollowed.' }) });
  const afterUnfollowReplyId = (await afterUnfollowReply.json() as { reply?: { id: string } }).reply!.id;
  const moderateAfterUnfollow = await request(`/api/admin/topics/replies/${afterUnfollowReplyId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public' }) });
  assert.equal(moderateAfterUnfollow.status, 200, await moderateAfterUnfollow.text());
  assert.equal(queuedRelationshipNotifications().length, 1, 'unfollow must prevent future update notifications');

  const followProvider = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'provider', targetId: provider }) });
  assert.equal(followProvider.status, 201, 'the generic primitive must support a public provider target');
  const followAgent = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'agent', targetId: 'eligible-agent' }) });
  assert.equal(followAgent.status, 201, 'the generic primitive must support an eligible agent target without coupling to agent runtime authority');
  const followPrivatePerson = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'person', targetId: privatePerson }) });
  assert.equal(followPrivatePerson.status, 422, 'private people must not be discoverable through a relationship attempt');

  await blockRelationshipActor(publicPerson, follower);
  const followBlockedPerson = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'person', targetId: publicPerson }) });
  assert.equal(followBlockedPerson.status, 422, 'a blocked user must not be able to create a follow relationship');

  const reFollow = await request('/api/relationships', { method: 'POST', headers: headers(follower), body: JSON.stringify({ targetType: 'topic', targetId: topicId, relationshipType: 'follow' }) });
  assert.equal(reFollow.status, 201, 'a revoked relationship may be explicitly recreated by its actor');
  const removeTopic = await request(`/api/topics/${topicId}`, { method: 'DELETE', headers: headers(author) });
  assert.equal(removeTopic.status, 200, await removeTopic.text());
  const suppressedRelationships = await request('/api/relationships?status=suppressed', { headers: headers(follower) });
  const suppressedPayload = await suppressedRelationships.json() as { relationships?: Array<{ targetType: string; targetId: string; status: string }> };
  assert.ok(suppressedPayload.relationships?.some((relationship) => relationship.targetType === 'topic' && relationship.targetId === topicId && relationship.status === 'suppressed'), `target deletion must suppress active relationships rather than leave dangling notifications: ${JSON.stringify(suppressedPayload)}`);

  assert.equal((await listSafetyContacts(follower)).length, 0, 'Follow must not create a safety contact');
  const economicRows = db.exec(`SELECT COUNT(*) FROM economic_requests`);
  assert.equal(Number(economicRows[0]?.values?.[0]?.[0] || 0), 0, 'Follow must not grant or create economic/provider authority');
  const relationshipKinds = db.exec(`SELECT relationship_type FROM relationships WHERE actor_phone=?`, [follower]);
  assert.ok((relationshipKinds[0]?.values || []).every((row: unknown[]) => row[0] === 'follow'), 'Follow must remain distinct from contact, participant, provider, and safety relationship types');

  console.log('Relationship primitive regression passed: generic follow lifecycle, target privacy, blocked-user restriction, notification preference/cancellation, deletion cleanup, and authorization/contact-safety isolation.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}

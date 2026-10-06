/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-identity-contact-foundation-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { addContact, canCommunicate, getPersonProfile, listContacts, placeholderAvatar, removeContact, contactSchemaForTests } = await import('../src/services/identityContactService.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { routeIntent } = await import('../src/services/intentRouter.js');

const suffix = Date.now();
const owner = `identity_owner_${suffix}@example.com`;
const provider = `identity_provider_${suffix}@example.com`;
const contributor = `identity_contributor_${suffix}@example.com`;
const agent = `identity_agent_${suffix}@example.com`;
const outsider = `identity_outsider_${suffix}@example.com`;
const db = await getDb();

function insert(phone: string, name: string, extra = '') {
  db.run(`INSERT INTO memory_profiles (phone, name, provider_type, is_contributor, verified_provider, is_available) VALUES (?, ?, 'human', 0, 0, 0)`, [phone, name]);
  if (extra) db.run(`UPDATE memory_profiles SET ${extra} WHERE phone = ?`, [phone]);
}

try {
  insert(owner, 'Owner User');
  insert(provider, 'Verified Provider', 'provider_type = \'human\', verified_provider = 1, is_available = 1');
  insert(contributor, 'Contributor User', 'is_contributor = 1');
  insert(agent, 'Kurukoo Agent', 'provider_type = \'software_service\', verified_provider = 1, is_available = 1');
  insert(outsider, 'Private Outsider');
  contactSchemaForTests(db);

  const avatarA = placeholderAvatar(provider, 'Verified Provider');
  const avatarB = placeholderAvatar(provider, 'Verified Provider');
  assert.deepEqual(avatarA, avatarB, 'placeholder avatar must be deterministic');
  assert.match(avatarA.label, /Profile image/);

  assert.equal(await getPersonProfile(owner, provider), null, 'unrelated identities must not be discoverable');
  await addContact(owner, provider, 'preferred provider');
  const providerProfile = await getPersonProfile(owner, provider);
  assert.equal(providerProfile?.identityId, provider, 'profile must use the same Memory Profile identity');
  assert.equal(providerProfile?.participantKind, 'provider');
  assert.equal(providerProfile?.provider?.verified, true);
  assert.equal(providerProfile?.communication.message, true);
  assert.equal(providerProfile?.communication.call, false);
  assert.equal(providerProfile?.communication.callUnavailableReason, 'Realtime call transport is unavailable.');
  assert.deepEqual(await canCommunicate(owner, provider, 'message'), { allowed: true });
  assert.equal((await canCommunicate(owner, provider, 'call')).allowed, false);

  await addContact(owner, contributor);
  assert.equal((await getPersonProfile(owner, contributor))?.participantKind, 'contributor');
  await addContact(owner, agent);
  assert.equal((await getPersonProfile(owner, agent))?.participantKind, 'agent');
  assert.equal((await listContacts(owner)).length, 3, 'all roles must share the same contact owner');

  db.run(`CREATE TABLE IF NOT EXISTS user_safety_contacts (id TEXT PRIMARY KEY, owner_phone TEXT, name TEXT, phone TEXT, relationship TEXT, status TEXT, created_at TEXT)`);
  db.run(`INSERT INTO user_safety_contacts (id, owner_phone, name, phone, status) VALUES ('safety-${suffix}', ?, 'Verified Provider', ?, 'active')`, [owner, provider]);
  assert.equal((await getPersonProfile(owner, provider))?.relationship.safetyContact, true);

  const prepared = await processCanonicalChatTurn({
    phone: owner,
    channel: 'web',
    message: 'I will arrive at six.',
    contextAction: { type: 'resume_canonical_context', contextId: `contact:${provider}`, canonicalAction: 'communication.compose', objectType: 'contact', objectId: provider },
  });
  assert.equal(prepared.canonicalAction, 'communication.contact.prepared');
  assert.equal(prepared.cardData?.type, 'communication_prepare');
  assert.equal(prepared.cardData?.recipient, 'Verified Provider');
  assert.equal(prepared.cardData?.recipientPhone, provider, 'the prepared message must retain the exact authorized contact identity');
  assert.equal(prepared.cardData?.body, 'I will arrive at six.');
  assert.equal(prepared.cardData?.deliveryState, 'not_sent');
  assert.equal(prepared.cardData?.exactContext, true);
  assert.match(prepared.reply, /has not been sent/i);

  const channelBoundary = await routeIntent('Choose an available channel for this message', owner, undefined, undefined, prepared.conversationId);
  assert.equal(channelBoundary.cardData?.type, 'communication_prepare');
  assert.equal(channelBoundary.cardData?.recipient, 'Verified Provider', 'channel review must use the exact prepared contact before falling back to name matching');
  assert.equal(channelBoundary.cardData?.deliveryState, 'not_sent');
  assert.match(channelBoundary.reply, /no authorised delivery channel is active|WhatsApp is available/i, 'channel state must remain evidence-bound');

  assert.equal(await removeContact(owner, provider), true);
  assert.equal(await getPersonProfile(owner, provider), null, 'removed contacts must no longer be discoverable');
  assert.equal((await canCommunicate(owner, provider, 'message')).allowed, false, 'removed contacts cannot be messaged');
  const removedContactContinuation = await processCanonicalChatTurn({
    phone: owner,
    channel: 'web',
    message: 'This should not be prepared.',
    contextAction: { type: 'resume_canonical_context', contextId: `contact:${provider}`, canonicalAction: 'communication.compose', objectType: 'contact', objectId: provider },
  });
  assert.equal(removedContactContinuation.canonicalAction, 'context.continuation.unavailable');
  assert.equal(removedContactContinuation.cardData?.type, 'canonical_context_unavailable');
  assert.match(removedContactContinuation.reply, /not authorized|no longer available/i);
  assert.equal((await getPersonProfile(owner, outsider)), null, 'private outsider remains hidden');

  console.log('Identity/contact foundation checks passed');
} finally {
  db.run(`DELETE FROM person_contacts WHERE owner_phone LIKE 'identity_%' OR person_phone LIKE 'identity_%'`);
  db.run(`DELETE FROM user_safety_contacts WHERE owner_phone LIKE 'identity_%' OR phone LIKE 'identity_%'`);
  db.run(`DELETE FROM memory_profiles WHERE phone LIKE 'identity_%'`);
  saveDb(true);
}

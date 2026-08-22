import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { addContact, canCommunicate, getPersonProfile, listContacts, placeholderAvatar, removeContact, contactSchemaForTests } from '../src/services/identityContactService.js';

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

  assert.equal(await removeContact(owner, provider), true);
  assert.equal(await getPersonProfile(owner, provider), null, 'removed contacts must no longer be discoverable');
  assert.equal((await canCommunicate(owner, provider, 'message')).allowed, false, 'removed contacts cannot be messaged');
  assert.equal((await getPersonProfile(owner, outsider)), null, 'private outsider remains hidden');

  console.log('Identity/contact foundation checks passed');
} finally {
  db.run(`DELETE FROM person_contacts WHERE owner_phone LIKE 'identity_%' OR person_phone LIKE 'identity_%'`);
  db.run(`DELETE FROM user_safety_contacts WHERE owner_phone LIKE 'identity_%' OR phone LIKE 'identity_%'`);
  db.run(`DELETE FROM memory_profiles WHERE phone LIKE 'identity_%'`);
  saveDb(true);
}

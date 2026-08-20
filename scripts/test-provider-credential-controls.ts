import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { changeProviderCredentialStatus, listProviderCredentialAudit, listProviderCredentials, rotateProviderCredential, testProviderCredential } from '../src/services/providerCredentialService.js';

const provider = 'gemini';
const secret = 'credential-regression-secret-12345';
const actorId = 'credential-regression-admin';
await listProviderCredentials();
const db = await getDb();
db.run(`DELETE FROM provider_credential_audit WHERE provider=?`, [provider]);
db.run(`DELETE FROM provider_credentials WHERE provider=?`, [provider]);
saveDb();

const rotated = await rotateProviderCredential({ provider, secret, actorId });
assert.equal(rotated.status, 'active');
assert.equal(rotated.version, 1);
assert.ok(rotated.maskedSecret?.endsWith(secret.slice(-4)), 'only a safe suffix should be disclosed');
assert.notEqual(rotated.maskedSecret, secret, 'plaintext credentials must never be returned');
const stored = db.exec(`SELECT encrypted_secret FROM provider_credentials WHERE provider=?`, [provider])[0]?.values?.[0]?.[0];
assert.ok(stored, 'the credential must be stored');
assert.doesNotMatch(String(stored), new RegExp(secret), 'the stored credential must be encrypted at rest');

const disabled = await changeProviderCredentialStatus({ provider, status: 'disabled', actorId });
assert.equal(disabled.status, 'disabled');
await assert.rejects(() => testProviderCredential({ provider, actorId }), /active credential/i, 'disabled credentials must not be tested');
const revoked = await changeProviderCredentialStatus({ provider, status: 'revoked', actorId });
assert.equal(revoked.status, 'revoked');
const audit = await listProviderCredentialAudit(provider);
assert.deepEqual(audit.slice(0, 3).map(item => item.action), ['revoked', 'disabled', 'rotated'], 'credential lifecycle actions must be retained in audit order');
assert.doesNotMatch(JSON.stringify(audit), new RegExp(secret), 'credential audit trails must never disclose secrets');

db.run(`DELETE FROM provider_credential_audit WHERE provider=?`, [provider]);
db.run(`DELETE FROM provider_credentials WHERE provider=?`, [provider]);
saveDb();
console.log('Provider credential-control regression passed: encrypted storage, masked metadata, status controls, and audit verified.');

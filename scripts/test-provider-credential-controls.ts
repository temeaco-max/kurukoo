import assert from 'node:assert/strict';
import {
  changeProviderCredentialStatus,
  listProviderCredentialAudit,
  listProviderCredentials,
  rotateProviderCredential,
} from '../src/services/providerCredentialService.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const actorId = `credential-contract-${suffix}`;
const secret = `credential-test-${suffix}-secret`;
const rotated = await rotateProviderCredential({ provider: 'gemini', secret, actorId });
assert.equal(rotated.status, 'active');
assert.equal(rotated.version >= 1, true);
assert.ok(rotated.maskedSecret);
assert.equal(rotated.maskedSecret?.includes(secret), false, 'credential summaries must never expose a plaintext secret');
const disabled = await changeProviderCredentialStatus({ provider: 'gemini', status: 'disabled', actorId });
assert.equal(disabled.status, 'disabled');
const summaries = await listProviderCredentials();
assert.equal(summaries.find(item => item.provider === 'gemini')?.status, 'disabled');
const audit = await listProviderCredentialAudit('gemini', 10);
assert.ok(audit.some(item => item.action === 'rotated'));
assert.ok(audit.some(item => item.action === 'disabled'));
await assert.rejects(() => rotateProviderCredential({ provider: 'unapproved' as any, secret, actorId }), /Unsupported credential provider/);
console.log('Provider credential controls contract passed: masking, rotation, status change, audit, and provider allow-list.');

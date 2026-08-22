import assert from 'node:assert/strict';

const original = {
  primary: process.env.KURUKOO_AI_PRIMARY_PROVIDER,
  hosted: process.env.KURUKOO_AI_HOSTED_PROVIDER,
  bypass: process.env.KURUKOO_AI_BYPASS_SMOLLM2,
  mistralKey: process.env.MISTRAL_API_KEY,
  country: process.env.KURUKOO_DEFAULT_COUNTRY,
  flag: process.env.FF_HOSTED_MISTRAL,
  freeFirst: process.env.KURUKOO_AI_FREE_FIRST,
};

process.env.KURUKOO_DEFAULT_COUNTRY = 'ng';
process.env.MISTRAL_API_KEY = 'test-mistral-key';
process.env.FF_HOSTED_MISTRAL = 'true';
process.env.KURUKOO_AI_PRIMARY_PROVIDER = 'mistral';
delete process.env.KURUKOO_AI_HOSTED_PROVIDER;
process.env.KURUKOO_AI_BYPASS_SMOLLM2 = 'true';
process.env.KURUKOO_AI_FREE_FIRST = 'true';

const { resolveConversationProvider } = await import('../src/services/conversationalGenerationService.js');
const automatic = resolveConversationProvider(undefined, 'I need some help comparing local options');
assert.notEqual(automatic, 'mistral', 'environment-level Mistral primary must not bypass the automatic capacity router');
assert.equal(resolveConversationProvider('mistral', 'complex task'), 'mistral');
assert.equal(resolveConversationProvider('smollm2', 'diagnostic task'), 'smollm2');

console.log('Mistral policy contract passed: automatic routing uses the capacity broker; explicit caller preference may select Mistral.');

for (const [key, value] of Object.entries(original)) {
  const envKey = key === 'primary' ? 'KURUKOO_AI_PRIMARY_PROVIDER' : key === 'hosted' ? 'KURUKOO_AI_HOSTED_PROVIDER' : key === 'bypass' ? 'KURUKOO_AI_BYPASS_SMOLLM2' : key === 'mistralKey' ? 'MISTRAL_API_KEY' : key === 'country' ? 'KURUKOO_DEFAULT_COUNTRY' : key === 'freeFirst' ? 'KURUKOO_AI_FREE_FIRST' : 'FF_HOSTED_MISTRAL';
  if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
}
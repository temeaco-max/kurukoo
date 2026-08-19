import assert from 'node:assert/strict';

process.env.MISTRAL_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.API_KEY = '';
process.env.KURUKOO_VOICE_ENABLED = 'false';
process.env.FF_TEST_HOSTED_MISTRAL = 'false';

const { getMistralStatus, queryMistral, transcribeMistralAudio, testMistralConnection } = await import('../src/services/mistralService.js');
const { getVoiceStatus } = await import('../src/services/voiceService.js');
const { queryUnifiedAI } = await import('../src/services/unifiedAiEngine.js');

const mistral = getMistralStatus();
assert.equal(mistral.configured, false);
assert.equal(mistral.available, false);
assert.equal(mistral.capabilities.find(capability => capability.capability === 'text')?.limits.status, 'unavailable');
assert.equal(mistral.capabilities.find(capability => capability.capability === 'tts')?.available, false);

await assert.rejects(() => queryMistral('test'), (error: any) => error?.code === 'MISTRAL_NOT_CONFIGURED');
const noKeyConnection = await testMistralConnection();
assert.deepEqual(noKeyConnection, { configured: false, reachable: false, status: 0, note: 'Mistral API key is not configured.' });
await assert.rejects(() => transcribeMistralAudio({ data: Buffer.from('audio'), mimeType: 'audio/wav' }), (error: any) => error?.code === 'MISTRAL_NOT_CONFIGURED');

const previousFetch = globalThis.fetch;
process.env.MISTRAL_API_KEY = 'test-mistral-key';
process.env.FF_TEST_HOSTED_MISTRAL = 'true';
process.env.KURUKOO_MISTRAL_TRANSCRIPTION_ENABLED = 'true';
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  assert.equal(init?.method, 'POST');
  assert.match(String(init?.headers && new Headers(init.headers).get('authorization')), /^Bearer test-mistral-key$/);
  assert.ok(init?.body instanceof FormData);
  return new Response(JSON.stringify({ text: 'find a plumber in Ikeja', model: 'voxtral-mini-latest', language: 'en' }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
const transcription = await transcribeMistralAudio({ data: Buffer.from('audio'), mimeType: 'audio/wav', language: 'en' });
assert.deepEqual(transcription, { text: 'find a plumber in Ikeja', model: 'voxtral-mini-latest', language: 'en' });
globalThis.fetch = previousFetch;
process.env.KURUKOO_MISTRAL_TRANSCRIPTION_ENABLED = 'false';

process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';
process.env.MISTRAL_API_KEY = 'test-mistral-key';
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(_input);
  assert.equal(init?.method, url.endsWith('/models') ? 'GET' : 'POST');
  assert.match(String(init?.headers && new Headers(init.headers).get('authorization')), /^Bearer test-mistral-key$/);
  if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'mistral-small-latest' }, { id: 'voxtral-mini-latest' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ choices: [{ message: { content: 'Mistral hosted response' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
const connection = await testMistralConnection();
assert.equal(connection.configured, true);
assert.equal(connection.reachable, true);
assert.equal(connection.status, 200);
assert.equal(connection.modelCount, 2);
const hosted = await queryUnifiedAI('Explain Kurukoo in one sentence', { provider: 'mistral', skipMemory: true });
assert.equal(hosted.provider, 'Mistral');
assert.equal(hosted.model, 'mistral-small-latest');
assert.equal(hosted.text, 'Mistral hosted response');

globalThis.fetch = previousFetch;
process.env.MISTRAL_API_KEY = '';

const voice = getVoiceStatus();
assert.equal(voice.available, false);
assert.equal(voice.tts.available, false);
assert.match(voice.tts.note, /unavailable|experimental/i);

const response = await queryUnifiedAI('Explain Kurukoo in one sentence', { provider: 'mistral', skipMemory: true });
assert.equal(response.provider, 'Kurukoo Template');
assert.equal(response.model, 'template-fallback');
assert.match(response.text, /ready|need|conversation|help/i);

console.log('Provider capability regression passed: optional Mistral, truthful unknown/unavailable limits, unsupported audio, and explicit template attribution are preserved.');

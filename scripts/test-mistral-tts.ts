import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.KURUKOO_DEFAULT_COUNTRY = 'ng';
process.env.KURUKOO_VOICE_TTS_PROVIDER = 'mistral';
process.env.MISTRAL_API_KEY = 'mistral-tts-contract-key-0123456789';
process.env.MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603';
process.env.MISTRAL_TTS_VOICE_ID = 'saved-voice-contract-id';
process.env.MISTRAL_TTS_RESPONSE_FORMAT = 'mp3';
process.env.MISTRAL_API_BASE = 'https://mistral.contract.test/v1';
delete process.env.FF_TEST_HOSTED_MISTRAL; delete process.env.FF_TEST_MISTRAL_TTS;

const originalFetch = globalThis.fetch;
const { synthesizeMistralSpeech } = await import('../src/services/mistralService.js');
const { getTtsStatus, isTtsEnabled, synthesizeSpeech } = await import('../src/services/serverTtsService.js');
const { getVoiceStatus } = await import('../src/services/voiceService.js');

try {
  assert.equal(isTtsEnabled(), false, 'Configured Mistral voice credentials must remain unavailable until explicit rollout flags are enabled.');
  assert.deepEqual(getTtsStatus(), { provider: 'mistral', configured: true, executionEnabled: false }, 'The selected saved-voice provider may be configured without permission for external execution.');
  await assert.rejects(() => synthesizeMistralSpeech('Hello from Kurukoo.'), (error: any) => error?.code === 'MISTRAL_TTS_DISABLED');
  process.env.FF_TEST_HOSTED_MISTRAL = 'true'; process.env.FF_TEST_MISTRAL_TTS = 'true';
  assert.equal(isTtsEnabled(), true, 'Mistral TTS execution becomes eligible only after both hosted Mistral and TTS flags are explicitly enabled.');
  assert.deepEqual(getTtsStatus(), { provider: 'mistral', configured: true, executionEnabled: true });
  const unverifiedStatus = getVoiceStatus().tts;
  assert.equal(unverifiedStatus.executionEnabled, true, 'Voice status must expose an explicitly enabled Mistral execution path.');
  assert.equal(unverifiedStatus.available, false, 'Voice status must not label configured Mistral TTS as available before protected provider reachability is independently verified.');
  assert.match(unverifiedStatus.note, /not independently verified/i);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://mistral.contract.test/v1/audio/speech', 'Mistral TTS must use the documented audio speech endpoint.');
    const headers = new Headers(init?.headers); assert.equal(headers.get('authorization'), 'Bearer mistral-tts-contract-key-0123456789'); assert.equal(headers.get('content-type'), 'application/json');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, { model: 'voxtral-mini-tts-2603', input: 'Hello from Kurukoo.', voice_id: 'saved-voice-contract-id', response_format: 'mp3', stream: false }, 'Mistral TTS must use only the configured saved voice, bounded text payload, explicit model and non-streaming documented response request.');
    return new Response(JSON.stringify({ model: 'voxtral-mini-tts-2603', audio_data: Buffer.from('verified-mock-audio').toString('base64') }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const direct = await synthesizeMistralSpeech('Hello from Kurukoo.');
  assert.equal(direct.model, 'voxtral-mini-tts-2603'); assert.equal(direct.voiceId, 'saved-voice-contract-id'); assert.equal(direct.mime, 'audio/mpeg'); assert.equal(direct.data.toString(), 'verified-mock-audio');
  const canonical = await synthesizeSpeech('Hello from Kurukoo.');
  assert.equal(canonical.provider, 'mistral'); assert.equal(canonical.model, 'voxtral-mini-tts-2603'); assert.equal(canonical.data.toString(), 'verified-mock-audio');
  globalThis.fetch = (async () => new Response(JSON.stringify({ model: 'voxtral-mini-tts-2603', audio_data: 'not-valid-base64!' }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  await assert.rejects(() => synthesizeMistralSpeech('reject malformed audio'), (error: any) => error?.code === 'MISTRAL_EMPTY_RESPONSE', 'Malformed provider audio must be rejected instead of returned as attributed Mistral speech.');
  await assert.rejects(() => synthesizeMistralSpeech('word '.repeat(301)), (error: any) => error?.code === 'MISTRAL_REQUEST_FAILED', 'Overlong voice prompts must fail before provider execution.');
  console.log(JSON.stringify({ ok: true, assertions: ['explicit_tts_feature_gate', 'saved_voice_only', 'bounded_text', 'documented_endpoint', 'base64_audio_validation', 'canonical_provider_attribution', 'no_synthetic_fallback'] }));
} finally { globalThis.fetch = originalFetch; }

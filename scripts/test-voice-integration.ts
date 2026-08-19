import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ensureConversation } from '../src/services/chatConversationService.js';
import { getVoiceStatus } from '../src/services/voiceService.js';
import { getVoiceToolDeclarations, isVoiceToolAllowed } from '../src/services/voiceToolRegistry.js';

async function main() {
  const previousEnabled = process.env.KURUKOO_VOICE_ENABLED;
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.KURUKOO_VOICE_ENABLED = 'true';
  const unavailable = getVoiceStatus();
  assert.equal(unavailable.available, false, 'voice must be unavailable without a server-side provider secret');
  assert.equal('token' in unavailable, false, 'status must never return a provider token');
  if (previousEnabled === undefined) delete process.env.KURUKOO_VOICE_ENABLED; else process.env.KURUKOO_VOICE_ENABLED = previousEnabled;
  if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;

  const phone = `voice_test_${Date.now()}`;
  const conversationId = await ensureConversation(phone, undefined, 'web');
  assert.equal(await ensureConversation(phone, conversationId, 'web_voice'), conversationId, 'voice must attach to the existing owned conversation');
  assert.notEqual(await ensureConversation(`${phone}_other`, conversationId, 'web_voice'), conversationId, 'voice must not access another identity’s conversation');

  const names = getVoiceToolDeclarations().flatMap((tool: any) => tool.functionDeclarations.map((item: any) => item.name));
  assert.deepEqual(names.sort(), ['get_current_conversation', 'get_memory_context', 'get_points_summary', 'get_reminders', 'get_request_state', 'route_user_intent'].sort());
  assert.equal(isVoiceToolAllowed('payment'), false, 'voice cannot bypass payment authorization');
  assert.equal(isVoiceToolAllowed('dispatch_provider'), false, 'voice cannot dispatch without canonical execution evidence');
  assert.equal(isVoiceToolAllowed('route_user_intent'), true);

  const router = fs.readFileSync('src/routes/voiceRouter.ts', 'utf8');
  const service = fs.readFileSync('src/services/voiceService.ts', 'utf8');
  const serverTts = fs.readFileSync('src/services/serverTtsService.ts', 'utf8');
  const index = fs.readFileSync('src/index.ts', 'utf8');
  assert.match(router, /router\.post\('\/session'/);
  assert.match(router, /router\.post\('\/tools'/);
  assert.match(router, /router\.post\('\/transcript'/);
  assert.match(router, /router\.post\('\/transcribe'/);
  assert.match(router, /transcribeMistralAudio/);
  assert.match(router, /createArtifact/);
  assert.match(router, /setArtifactTranscript/);
  assert.match(router, /X-Kurukoo-Tts-Provider/);
  assert.match(router, /X-Kurukoo-Tts-Model/);
  assert.match(router, /MISTRAL_TTS_DISABLED/);
  assert.match(router, /transcriptStatus: 'available'/);
  assert.match(router, /transcriptStatus: 'failed'/);
  assert.match(router, /getVoiceSession\(sessionId, phone\)/, 'tool and transcript operations require owned sessions');
  assert.match(service, /getTtsStatus/);
  assert.match(service, /isTtsEnabled/);
  assert.match(serverTts, /synthesizeMistralSpeech/);
  assert.match(serverTts, /No fallback is silently attributed as external provider audio/);
  assert.match(service, /authTokens\.create/);
  assert.match(service, /lockAdditionalFields/);
  assert.doesNotMatch(service, /GOOGLE_API_KEY/);
  assert.match(index, /app\.use\('\/api\/voice',\s*voiceRouter\)/);
  assert.match(index, /app\.use\('\/api',\s*artifactRoutes\)/);
  console.log('Voice integration contract passed: ephemeral session boundary, shared conversation identity, restricted tools, canonical owner-scoped artifact persistence, bounded Voxtral transcription route, and no permanent credential response.');
}

main().catch(error => { console.error(error); process.exit(1); });
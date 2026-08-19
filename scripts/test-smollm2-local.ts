import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDbPath = path.join(os.tmpdir(), `kurukoo-smollm2-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = isolatedDbPath;
process.env.KURUKOO_SMOLLM2_LOCAL ||= 'true';
process.env.KURUKOO_AGENT_ENABLED ||= 'false';
process.env.KURUKOO_AI_HOSTED_PROVIDER ||= 'none';
process.env.SMOLLM2_MODEL ||= 'HuggingFaceTB/SmolLM2-360M-Instruct';
process.env.SMOLLM2_DTYPE ||= 'q4';
process.env.SMOLLM2_MAX_NEW_TOKENS ||= '64';
process.on('exit', () => { try { fs.rmSync(isolatedDbPath, { force: true }); } catch {} });

const { querySmolLM2, getSmolLM2RuntimeStatus, querySmolLM2Diagnostics, verifyLocalSmolLM2Tokenization } = await import('../src/services/smolLm2Service.js');
const { queryUnifiedAI } = await import('../src/services/unifiedAiEngine.js');
const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');

const direct = await querySmolLM2('Explain in one short sentence what Kurukoo helps with.');
const directStatus = getSmolLM2RuntimeStatus();
assert.ok(direct.trim(), 'Local SmolLM2 must return text');
assert.equal(directStatus.source, 'local', `Expected local SmolLM2 inference, received ${directStatus.source}`);
assert.equal(directStatus.available, true, 'Local SmolLM2 runtime must be available after inference');
const directDiagnostics = querySmolLM2Diagnostics();
assert.equal(directDiagnostics.executionMode, 'local_pipeline', 'A local SmolLM2 test only passes after a real local pipeline generation.');
assert.equal(directDiagnostics.actualModel, directStatus.model, 'Local diagnostics must identify the model that actually generated the response.');
assert.ok(typeof directDiagnostics.latencyMs === 'number' && directDiagnostics.latencyMs >= 0, 'Local diagnostics must record actual generation latency.');
const tokenization = await verifyLocalSmolLM2Tokenization();
assert.equal(tokenization.model, directStatus.model, 'Tokenizer verification must use the same local checkpoint as generation.');
assert.ok(tokenization.tokenCount > 0, 'Local tokenizer verification must return non-empty token IDs.');

const unified = await queryUnifiedAI('Explain in one short sentence what Kurukoo helps with.', { provider: 'smollm2' });
assert.ok(unified.text.trim(), 'unifiedAiEngine must return SmolLM2 text');
assert.equal(unified.provider, 'SmolLM2', `unifiedAiEngine must attribute local SmolLM2, received ${unified.provider}`);
const expectedModel = directStatus.model.split('/').pop() || directStatus.model;
assert.equal(unified.model, expectedModel, `Unexpected unified model attribution: ${unified.model}`);

const phone = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(phone, 'Local SmolLM2 Tester');
const turn = await processCanonicalChatTurn({ phone, message: 'What should I know before using Kurukoo?', channel: 'web', conversationId: 'smollm2-local-chat' });
assert.ok(turn.reply.trim(), 'Canonical Chat must return a reply through the local SmolLM2 path');
assert.doesNotMatch(turn.reply, /current policy and quota|current user(?:'s|s) (?:role|context)|system instructions?|internal architecture|context arbitration|model provider|classification source|living memory|relative reference|canonical object|active goal|active context/i, 'Canonical Chat must sanitize internal student-model language');
if (turn.modelProvider === 'SmolLM2') {
  assert.equal(turn.model, expectedModel, `Canonical Chat must report the local SmolLM2 model, received ${turn.model}`);
} else {
  assert.equal(turn.modelProvider, 'Kurukoo Template', `Canonical Chat may only fall back to the bounded template provider, received ${turn.modelProvider}`);
  const fallbackStatus = getSmolLM2RuntimeStatus();
  assert.ok(fallbackStatus.lastFailure === 'local_inference_failed' || fallbackStatus.readiness === 'fallback' || (fallbackStatus.source === 'local' && fallbackStatus.available === true && fallbackStatus.lastFailure === null), 'A template response must retain truthful inference or quality-guard provenance');
}

console.log(JSON.stringify({
  ok: true,
  model: directStatus.model,
  source: directStatus.source,
  executionMode: directDiagnostics.executionMode,
  latencyMs: directDiagnostics.latencyMs,
  actualModel: directDiagnostics.actualModel,
  tokenCount: tokenization.tokenCount,
  unifiedProvider: unified.provider,
  unifiedModel: unified.model,
  chatProvider: turn.modelProvider,
  chatModel: turn.model,
  chatReplyPreview: turn.reply.slice(0, 180),
}, null, 2));
console.log('Local SmolLM2 direct, unifiedAiEngine, and canonical Chat integration passed.');

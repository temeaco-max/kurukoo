/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `kurukoo-smollm2-fallback-${process.pid}-${Date.now()}.sqlite`);
process.env.KURUKOO_SMOLLM2_LOCAL = 'true';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.SMOLLM2_MODEL = 'smollm2:nonexistent-test';
process.env.SMOLLM2_FALLBACK_MODEL = 'smollm2:360m';
process.env.SMOLLM2_MAX_NEW_TOKENS = '48';

const { querySmolLM2, getSmolLM2RuntimeStatus, querySmolLM2Diagnostics } = await import('../src/services/smolLm2Service.js');
const text = await querySmolLM2('Say one short, natural sentence about Kurukoo.');
const status = getSmolLM2RuntimeStatus();
assert.ok(text.trim(), 'Fallback checkpoint must return a bounded reply.');
assert.equal(status.source, 'local', `Expected local fallback inference, received ${status.source}`);
assert.equal(status.available, true, 'Fallback inference must be available after successful load.');
assert.equal(status.model, 'smollm2:360m', 'The bounded fallback checkpoint must be attributed exactly.');
assert.equal(status.lastFailure, 'local_model_fallback', 'Readiness telemetry must preserve the primary-checkpoint fallback reason.');
const diagnostics = querySmolLM2Diagnostics();
assert.equal(diagnostics.executionMode, 'local_pipeline', 'A fallback checkpoint is only reported as available after actual local generation.');
assert.equal(diagnostics.actualModel, 'smollm2:360m', 'Diagnostics must identify the local fallback checkpoint that generated the response.');
assert.ok(typeof diagnostics.latencyMs === 'number' && diagnostics.latencyMs >= 0, 'Fallback checkpoint generation latency must be recorded.');
console.log(JSON.stringify({ ok: true, model: status.model, source: status.source, readiness: status.readiness, lastFailure: status.lastFailure, executionMode: diagnostics.executionMode, latencyMs: diagnostics.latencyMs, actualModel: diagnostics.actualModel, preview: text.slice(0, 160) }, null, 2));

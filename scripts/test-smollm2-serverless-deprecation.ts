import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const source = fs.readFileSync(new URL('../src/services/smolLm2Service.ts', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../src/services/unifiedAiEngine.ts', import.meta.url), 'utf8');
const health = fs.readFileSync(new URL('../src/routes/healthRoutes.ts', import.meta.url), 'utf8');
const packageJson = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const jobsBackend = fs.readFileSync(new URL('../ml/huggingface_jobs_backend.py', import.meta.url), 'utf8');
const teacherGenerator = fs.readFileSync(new URL('../ml/teachers/generate_trajectory_candidates.py', import.meta.url), 'utf8');

assert.doesNotMatch(source, /@huggingface\/inference|HfInference|getHfClient|\bhf_serverless\b|hostedInferenceUnavailableForModel/,
  'SmolLM2 runtime must not retain a raw Hugging Face serverless client or retry cache.');
assert.match(source, /serverlessRuntime: 'deprecated'/,
  'SmolLM2 status must explicitly surface serverless runtime retirement.');
assert.match(source, /hf_serverless_runtime_deprecated/,
  'Local-disabled SmolLM2 requests must have a truthful deprecated-runtime fallback reason.');
assert.doesNotMatch(engine, /hf_serverless/,
  'Unified AI diagnostics must not advertise a retired execution mode.');
assert.match(health, /const modelReady = !requireModel \|\| runtime\.model\.localEnabled;/,
  'A required model health gate must require enabled local execution, not deprecated HF credentials.');
assert.doesNotMatch(packageJson, /"@huggingface\/inference"/,
  'The raw Hugging Face inference SDK must not remain in runtime dependencies.');
assert.match(packageJson, /"@huggingface\/transformers"/,
  'Local Transformers.js inference must remain available.');
assert.match(packageJson, /"ml:remote-launch"[\s\S]*huggingface_jobs_backend\.py/,
  'The guarded Hugging Face Jobs launcher must remain available.');
assert.match(jobsBackend, /FF_HUGGINGFACE_JOBS/,
  'Remote GPU training must retain its explicit feature gate.');
assert.match(jobsBackend, /KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED/,
  'Remote GPU training must retain explicit billable-launch approval.');
assert.match(teacherGenerator, /huggingface/,
  'Optional Hugging Face teacher routing must remain independently configurable.');

process.env.KURUKOO_SMOLLM2_LOCAL = 'false';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.HUGGINGFACE_API_KEY = 'test-only-retired-runtime-key';
process.env.SMOLLM2_MODEL = 'HuggingFaceTB/SmolLM2-1.7B-Instruct';
const { querySmolLM2, querySmolLM2Diagnostics, getSmolLM2RuntimeStatus } = await import('../src/services/smolLm2Service.js');
const fallback = await querySmolLM2('Can you help me plan the next safe step?');
const status = getSmolLM2RuntimeStatus();
const diagnostics = querySmolLM2Diagnostics();
assert.ok(fallback.trim(), 'Retired serverless runtime must retain the bounded deterministic fallback.');
assert.equal(status.source, 'fallback', 'A legacy Hugging Face key must not be attributed as a model response.');
assert.equal(status.available, false, 'Retired serverless runtime must remain unavailable.');
assert.equal(status.lastFailure, 'hf_serverless_runtime_deprecated', 'The runtime deprecation reason must be explicit.');
assert.equal(diagnostics.executionMode, 'deterministic_fallback', 'Retired runtime fallback must be attributed deterministically.');
assert.equal(diagnostics.actualModel, 'template-fallback', 'Deterministic fallback must not claim SmolLM2 output.');

console.log(JSON.stringify({
  ok: true,
  assertions: [
    'no_raw_hf_serverless_sdk',
    'truthful_deprecated_runtime_status',
    'local_model_health_gate',
    'local_transformers_preserved',
    'hf_jobs_preserved_and_gated',
    'optional_hf_teacher_preserved',
    'legacy_key_never_attempts_serverless_runtime',
  ],
}, null, 2));

import assert from 'node:assert/strict';
import { routeAgentModel } from '../src/services/agentModelRouter.js';

process.env.HF_API_KEY = 'test';
process.env.KURUKOO_SMOLLM2_LOCAL = 'SmolLM2-test';
process.env.GROQ_MODEL = 'llama-test';

assert.equal(routeAgentModel({ reasoningClass: 'bounded' }).route, 'slm_local');
assert.equal(routeAgentModel({ reasoningClass: 'complex' }).route, 'cheap_remote');
assert.equal(routeAgentModel({ reasoningClass: 'complex', requestedModel: 'explicit-test' }).model, 'explicit-test');
assert.equal(routeAgentModel({ reasoningClass: 'bounded', slmEnabled: false, cheapRemoteEnabled: false }).route, 'strong_remote');

console.log('Agent model routing contract passed.');

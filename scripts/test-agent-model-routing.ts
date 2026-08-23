import assert from 'node:assert/strict';
import { routeAgentModel } from '../src/services/agentModelRouter.js';

process.env.HF_API_KEY = 'test';
process.env.KURUKOO_SMOLLM2_LOCAL = 'SmolLM2-test';
process.env.GROQ_MODEL = 'llama-test';

const bounded = routeAgentModel({ reasoningClass: 'bounded' });
assert.equal(bounded.reasoningClass, 'bounded');
assert.equal(bounded.route, 'slm_local');

const complex = routeAgentModel({ reasoningClass: 'complex' });
assert.equal(complex.route, 'cheap_remote');

const explicit = routeAgentModel({ reasoningClass: 'complex', requestedModel: 'explicit-test' });
assert.equal(explicit.model, 'explicit-test');
assert.equal(explicit.route, 'strong_remote');

console.log('Agent model routing contract passed.');

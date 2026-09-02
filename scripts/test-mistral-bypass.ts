/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

process.env.KURUKOO_DEFAULT_COUNTRY ||= 'ng';
process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-mistral-key';
process.env.FF_HOSTED_MISTRAL = 'true';

delete process.env.KURUKOO_AI_BYPASS_SMOLLM2;
delete process.env.KURUKOO_AI_PRIMARY_PROVIDER;
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';

const { resolveConversationProvider } = await import('../src/services/conversationalGenerationService.js');
assert.equal(resolveConversationProvider(undefined), 'smollm2', 'Automatic chat must remain local-first even when Mistral is the preferred hosted escalation provider.');
assert.equal(resolveConversationProvider('auto'), 'smollm2', 'Auto chat must remain local-first.');
assert.equal(resolveConversationProvider('mistral'), 'mistral', 'Explicit Mistral selection must remain available for provider testing/activation.');
assert.equal(resolveConversationProvider('smollm2'), 'smollm2');
console.log('Mistral policy contract passed: automatic chat remains SmolLM2-first, while explicit Mistral execution remains available as a hosted boundary.');

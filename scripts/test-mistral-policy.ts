/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-mistral-policy-${process.pid}-${Date.now()}.sqlite`;

process.env.KURUKOO_DEFAULT_COUNTRY ||= 'ng';
process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-mistral-key';
process.env.FF_HOSTED_MISTRAL = 'true';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';
delete process.env.KURUKOO_AI_BYPASS_SMOLLM2;
delete process.env.KURUKOO_AI_PRIMARY_PROVIDER;
const { resolveConversationProvider } = await import('../src/services/conversationalGenerationService.js');
assert.equal(resolveConversationProvider(undefined), 'smollm2');
assert.equal(resolveConversationProvider('auto'), 'smollm2');
assert.equal(resolveConversationProvider('mistral'), 'mistral');
assert.equal(resolveConversationProvider('smollm2'), 'smollm2');
console.log('Mistral policy contract passed: automatic chat is SmolLM2-first and explicit Mistral execution remains available for hosted escalation/testing.');

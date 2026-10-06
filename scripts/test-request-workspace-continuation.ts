/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-request-workspace-continuation-${process.pid}-${Date.now()}.sqlite`;
const { getEconomicRequest, listEconomicRequestsForPhone } = await import('../src/services/economicRequestPersistence.js');
const { resumeStorefrontFromRequest, startStorefrontSession } = await import('../src/services/agenticStorefront.js');

const owner = `request-workspace-${crypto.randomUUID()}@example.test`;
const conversationId = `conversation-${crypto.randomUUID()}`;

const card = await startStorefrontSession(
  owner,
  'find_worker',
  { service: 'plumber', location: 'Ikeja', time: 'tomorrow' },
  { forceNew: true, conversationId },
);

assert.ok(card.requestId, 'A canonical storefront session must create an Economic Request.');
const request = await getEconomicRequest(card.requestId);
assert.ok(request, 'The created Economic Request must be retrievable.');
assert.equal(request.phone, owner, 'The Economic Request must remain owner-scoped.');
assert.equal(request.conversationId, conversationId, 'A Chat-aware Economic Request must retain the initiating conversation.');

const listed = await listEconomicRequestsForPhone(owner, { includeClosed: true });
assert.equal(listed.find((item) => item.id === card.requestId)?.conversationId, conversationId, 'The owner-scoped Requests projection must retain the initiating conversation.');

const resumed = await resumeStorefrontFromRequest(owner, card.requestId);
assert.ok(resumed, 'The same owner must be able to resume the persisted request.');
assert.equal(resumed?.requestId, card.requestId, 'Request continuation must reuse the same canonical request rather than create a duplicate.');

console.log('Request workspace continuation regression passed: canonical request keeps its initiating Chat conversation and resumes without duplication.');

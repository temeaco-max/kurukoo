/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-fasttext-router-${process.pid}-${Date.now()}.sqlite`;
const { routeIntent } = await import('../src/services/intentRouter.js');

const howTo = await routeIntent('How do I fix a leaking tap?', undefined);
assert.notEqual(howTo.skill, 'find_worker', 'a how-to repair question should remain native assistance until the user asks to find someone');
assert.notEqual(howTo.cardData?.type, 'agentic_storefront', 'how-to assistance must not open an Economic Request storefront');

const routed = await routeIntent('Find me someone to repair my fridge', undefined);
assert.equal(routed.skill, 'find_worker', 'an explicit FastText-classified repair request should route to the canonical worker flow');
assert.equal(routed.cardData?.type, 'agentic_storefront', 'an explicit repair request should start the canonical storefront card rather than a parallel flow');
assert.ok(Array.isArray(routed.cardData?.suggestions) && routed.cardData.suggestions.length > 0, 'the reusable contextual suggestion payload should accompany the routed intent');
assert.ok(routed.cardData.suggestions.every((item: any) => typeof item.label === 'string' && typeof item.prompt === 'string'), 'suggestions must be typed prompt/label pairs');

const weekendHome = await routeIntent('I need someone to help with my house this weekend', '+2348030000000');
assert.equal(weekendHome.skill, 'find_worker', 'weekend must not hijack a generic home-service request into national_events');
assert.equal(weekendHome.cardData?.type, 'agentic_storefront', 'weekend home-service wording must enter the canonical Economic Request storefront');

const weekendEvents = await routeIntent('what events are happening this weekend', '+2348030000000');
assert.equal(weekendEvents.skill, 'national_events', 'explicit events wording must remain national_events');
assert.equal(weekendEvents.cardData?.type, 'events_list', 'explicit events wording must retain the public events card');
console.log('FastText intent-router integration regression passed.');

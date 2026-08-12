import assert from 'node:assert/strict';
import { routeIntent } from '../src/services/intentRouter.js';

const routed = await routeIntent('How do I fix a leaking tap?', undefined);
assert.equal(routed.skill, 'find_worker', 'a FastText-classified repair phrasing should route to the canonical worker flow');
assert.equal(routed.cardData?.type, 'agentic_storefront', 'FastText-routed intent should start the canonical storefront card rather than a parallel flow');
assert.ok(Array.isArray(routed.cardData?.suggestions) && routed.cardData.suggestions.length > 0, 'the reusable contextual suggestion payload should accompany the routed intent');
assert.ok(routed.cardData.suggestions.every((item: any) => typeof item.label === 'string' && typeof item.prompt === 'string'), 'suggestions must be typed prompt/label pairs');
console.log('FastText intent-router integration regression passed.');

/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/canonicalChatTurnService.ts', import.meta.url), 'utf8');

assert.ok(source.includes("import { generateConversationalResponse } from './conversationalGenerationService.js';"));
assert.ok(source.includes('function shouldUseUniversalConversationOwner(routing: IntentRoutingResult): boolean'));
assert.ok(source.includes("if (routing.skill !== 'general_question') return false;"));
assert.ok(source.includes('if (routing.canonicalAction) return false;'));
assert.ok(source.includes("if (typeof routing.cardData?.requestId === 'string') return false;"));
assert.ok(source.includes("if (routing.skill && routing.skill !== 'general_question' && routing.skill !== 'autonomous_agent' && isGuest)"));
assert.ok(source.includes('const explicitAgentIntent = routing.skill === \'autonomous_agent\''));
assert.ok(source.includes('const generated = await generateConversationalResponse({'));
assert.ok(source.includes("owner: 'conversationalGenerationService'"));

const routeIndex = source.indexOf('const routing: IntentRoutingResult');
const universalIndex = source.indexOf('shouldUseUniversalConversationOwner(routing))');
const authIndex = source.indexOf("if (routing.skill && routing.skill !== 'general_question' && routing.skill !== 'autonomous_agent' && isGuest)");
assert.ok(routeIndex >= 0 && authIndex > routeIndex && universalIndex > authIndex, 'canonical guest authorization must precede universal generation');

const forbiddenOwnerCardTypes = ['economic_request', 'agentic_storefront', 'checkout', 'payment', 'reminder', 'notification', 'safety'];
for (const cardType of forbiddenOwnerCardTypes) assert.ok(source.includes(cardType), `universal-owner exclusion missing for ${cardType}`);

console.log('Canonical conversational-owner boundary passed: explicit actions/auth/autonomy remain ahead of universal natural-language generation.');

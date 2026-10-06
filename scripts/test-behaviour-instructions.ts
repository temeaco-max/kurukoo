/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-behaviour-instructions-${process.pid}-${Date.now()}.sqlite`;
const { classifyWithFastText } = await import('../src/services/fastTextService.js');
const { composeBehaviourInstructions, inferSkillFromText } = await import('../src/services/behaviourInstructionService.js');
const { buildConversationTurnContract, buildConversationalSystemDirective } = await import('../src/services/conversationTurnContractService.js');

const routingCases: Array<[string,string]> = [
  ['hello','greeting'],
  ['thanks','thanks'],
  ['I need a painter for my house','find_worker'],
  ['I need an okada to pick me up','ride_request'],
  ['Find a pepper seller','find_worker'],
  ['How do I unlink my phone?','how_to_video'],
  ['How do I top up my wallet?','top_up'],
];
for (const [text, expected] of routingCases) assert.equal(classifyWithFastText(text)?.intent, expected, `${text} should route to ${expected}`);

assert.equal(inferSkillFromText('I need a painter for my house'), 'painter');
assert.equal(inferSkillFromText('get me an okada ride'), 'okada_rider');
assert.equal(inferSkillFromText('find a pepper seller'), 'pepper_seller');
assert.equal(inferSkillFromText('find a shoe maker'), 'shoe_cobbler');

const painter = composeBehaviourInstructions({ skill: 'painter' });
assert.match(painter, /interior\/exterior/i);
assert.match(painter, /inspection\/quote/i);
assert.match(painter, /canonical evidence/i);

const rider = composeBehaviourInstructions({ skill: 'okada_rider' });
assert.match(rider, /nearby eligible rider/i);
assert.match(rider, /pickup/i);
assert.match(rider, /acceptance/i);

const seller = composeBehaviourInstructions({ skill: 'pepper_seller' });
assert.match(seller, /quantity/i);
assert.match(seller, /availability/i);
assert.match(seller, /pickup/i);

const support = composeBehaviourInstructions({ support: true });
assert.match(support, /how-to/i);
assert.match(support, /canonical capabilities/i);

const contract = buildConversationTurnContract({ userMessage: 'I need someone to paint my house', latestUserMessage: 'I need someone to paint my house' } as any);
assert.equal(contract.conversationAct, 'new_request');
assert.match(buildConversationalSystemDirective(contract), /painter/i);

const greeting = buildConversationTurnContract({ userMessage: 'hello', latestUserMessage: 'hello' } as any);
assert.equal(greeting.conversationAct, 'greeting');
assert.match(buildConversationalSystemDirective(greeting), /Respond naturally and warmly/i);

console.log('Behaviour/instruction convergence checks passed.');

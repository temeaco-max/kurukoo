/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dbPath = '/tmp/kurukoo-chat-first-rebuild.sqlite';
try { fs.rmSync(dbPath, { force: true }); } catch {}
process.env.NODE_ENV = 'test';
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'chat-first-rebuild-regression-secret-0123456789';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_SEED_OPERATOR = 'true';

const database = await import('../src/database.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { routeIntent } = await import('../src/services/intentRouter.js');

const db = await database.getDb();
const operator = database.getCanonicalOperatorIdentity();
const actors = database.getOperatorActorDefinitions();
assert.equal(operator.phone, '+2348000000001');
assert.equal(actors.length, 6);
assert.equal(new Set(actors.map(actor => actor.phone)).size, actors.length);

const operatorProfile = db.exec('SELECT phone, name FROM memory_profiles WHERE phone = ?', [operator.phone])[0]?.values?.[0];
assert.deepEqual(operatorProfile, [operator.phone, operator.name]);
for (const actor of actors) {
  const profile = db.exec('SELECT phone FROM memory_profiles WHERE phone = ?', [actor.phone])[0]?.values?.[0];
  assert.deepEqual(profile, [actor.phone], `missing seeded actor ${actor.id}`);
}

const moved = await routeIntent("I've just moved to Ikeja.", actors[0].phone);
assert.equal(moved.skill, 'general_question');
assert.equal(moved.canonicalAction, undefined);
const leak = await routeIntent('My bathroom is leaking.', actors[0].phone);
assert.equal(leak.skill, 'general_question');
assert.equal(leak.canonicalAction, undefined);
const uncertain = await routeIntent("I don't know whether I need a plumber or something else.", actors[0].phone);
assert.equal(uncertain.skill, 'general_question');
assert.equal(uncertain.canonicalAction, undefined);
const shower = await routeIntent('It only happens when I use the shower.', actors[0].phone);
assert.equal(shower.skill, 'general_question');
assert.equal(shower.canonicalAction, undefined);

const routed = await routeIntent('I need a painter in Ikeja next Saturday morning with a budget of ₦25,000', actors[0].phone);
assert.equal(routed.skill, 'find_worker');
assert.equal(routed.extractionSource, 'deterministic');
assert.equal(routed.extractedEntities?.location, 'Ikeja');
assert.equal(routed.extractedEntities?.date, 'next Saturday');
assert.equal(routed.extractedEntities?.time, 'morning');
assert.equal(routed.extractedEntities?.budget, 25000);
assert.equal(routed.canonicalAction, 'economic_request.start');
assert.ok(routed.progressStage);

const turn = await processCanonicalChatTurn({
  phone: actors[0].phone,
  channel: 'web',
  message: 'I need a painter in Ikeja next Saturday morning with a budget of ₦25,000',
});
assert.match(turn.reply, /need|match|provider|painter/i);
assert.equal(turn.extractionSource, 'deterministic');
assert.equal(turn.extractedEntities?.location, 'Ikeja');
assert.equal(turn.canonicalAction, 'economic_request.start');
assert.ok(turn.cardData?.requestId, 'canonical Economic Request was not created');

const requests = db.exec('SELECT phone, skill, requirements_json FROM economic_requests WHERE phone = ?', [actors[0].phone])[0]?.values?.[0];
assert.equal(requests?.[0], actors[0].phone);
assert.equal(requests?.[1], 'find_worker');
const requirements = JSON.parse(String(requests?.[2] || '{}'));
assert.equal(requirements.location, 'Ikeja');
assert.equal(requirements.budget, 25000);

const secondActorRequest = db.exec('SELECT COUNT(*) FROM economic_requests WHERE phone = ?', [actors[1].phone])[0]?.values?.[0]?.[0];
assert.equal(Number(secondActorRequest || 0), 0, 'actor state leaked between explicit contexts');

database.resetOperatorActorState(db, actors[0].phone);
const afterReset = db.exec('SELECT COUNT(*) FROM messages WHERE phone = ?', [actors[0].phone])[0]?.values?.[0]?.[0];
assert.equal(Number(afterReset || 0), 0);
console.log('Chat-first rebuild regression passed: User #1 seed, isolated actors, natural extraction, canonical action hydration, truthful progress, and actor reset boundaries.');

/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-skill-interaction-convergence-${process.pid}-${Date.now()}.sqlite`;
const { getAllConvergedSkillNames } = await import('../src/services/skillBehaviourConvergence.js');
const { buildSkillExecutionContract } = await import('../src/services/skillExecutionContract.js');

const skills = getAllConvergedSkillNames();
assert.equal(skills.length, 241, `expected 241 canonical skills, got ${skills.length}`);
let dispatchCount = 0;
for (const skill of skills) {
  const contract = buildSkillExecutionContract(skill);
  assert.ok(contract.interaction, `${skill}: missing interaction contract`);
  assert.ok(contract.interaction.matchEvent, `${skill}: missing match event`);
  assert.ok(contract.interaction.commitmentEvent, `${skill}: missing commitment event`);
  assert.ok(contract.interaction.completionEvent, `${skill}: missing completion event`);
  assert.ok(Array.isArray(contract.interaction.postCompletion), `${skill}: missing post-completion actions`);
  assert.ok(Array.isArray(contract.interaction.revenueEvents), `${skill}: missing revenue events`);
  if (contract.interaction.pattern === 'dispatch') dispatchCount += 1;
}
const transportDispatches = skills.map(buildSkillExecutionContract).filter(c => ['transport-mobility','logistics-freight','errands-delivery'].includes(c.category || '') && c.interaction.pattern === 'dispatch');
assert.ok(transportDispatches.length > 0, 'expected dispatch-capable transport/logistics skills');
for (const contract of transportDispatches) {
  assert.ok(contract.interaction.liveSession?.allowed, `${contract.skill}: dispatch must expose shared live session contract`);
  assert.deepEqual(contract.interaction.liveSession?.transports, ['chat','webrtc_data','webrtc_audio','webrtc_video','external_channel'], `${contract.skill}: inconsistent transport set`);
  assert.equal(contract.interaction.liveSession?.providerLocation, true, `${contract.skill}: provider location must be shared`);
  assert.equal(contract.interaction.liveSession?.userProviderMessaging, true, `${contract.skill}: provider messaging must be shared`);
  assert.ok(contract.requirements.some(r => r.key === 'vehicle_type') || contract.category !== 'transport-mobility', `${contract.skill}: transport preference must be available through shared contract`);
}
console.log(JSON.stringify({ passed:true, canonicalSkills:skills.length, dispatchSkills:dispatchCount, transportDispatches:transportDispatches.length, model:'shared-skill-execution-contract' }, null, 2));

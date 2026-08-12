import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-skill-flows-'));
process.env.DB_PATH = path.join(tempDir, 'skill-flows.sqlite');
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { getSkillFlow, auditSkillFlows } = await import('../src/services/skillFlows.js');

for (const [skill, category, action] of [
  ['taxi_quick', 'transport-mobility', 'ride'],
  ['street_food_cart', 'food-drink', 'order'],
  ['phone_repairer', 'repairs-maintenance', 'lead'],
  ['roadside_mechanic', 'automotive-mechanics', 'dispatch'],
] as const) {
  const flow = await getSkillFlow(skill);
  assert.ok(flow, `${skill} should have a tailored skill flow`);
  assert.equal(flow?.category, category, `${skill} should retain canonical category mapping`);
  assert.equal(flow?.post_match_action, action, `${skill} should expose a tailored post-match action`);
  assert.ok(flow?.question_set, `${skill} should expose a structured question set`);
  assert.ok(flow?.capabilities?.includes('quote'), `${skill} should retain quote capability`);
  assert.ok(flow?.capabilities?.includes('completion'), `${skill} should retain completion capability`);
}

const audit = await auditSkillFlows();
assert.equal(audit.invalid.length, 0, `Skill flow audit should have no invalid seeded records: ${audit.invalid.join(', ')}`);
console.log(`Skill flow tests passed: ${audit.valid}/${audit.total} valid seeded flows`);

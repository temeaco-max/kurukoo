import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('.env.example', 'utf8');
for (const key of ['KURUKOO_AGENT_ENABLED', 'KURUKOO_AGENT_AUTONOMOUS', 'KURUKOO_AGENT_AUTONOMOUS_LOW_RISK']) {
  const match = source.match(new RegExp(`^${key}=([^\\n]*)$`, 'm'));
  assert.ok(match, `${key} must be declared in .env.example`);
  assert.equal(match![1].trim(), 'false', `${key} must default to false in the environment template`);
}

console.log('Agent environment defaults regression passed: autonomous execution is disabled by default.');

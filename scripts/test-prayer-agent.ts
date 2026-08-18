import assert from 'node:assert/strict';
import path from 'node:path';

process.env.DB_PATH = path.join(process.cwd(), 'data', 'prayer-agent-test.sqlite');
process.env.MEMORY_ENCRYPTION_KEY = 'prayer-agent-test-key';
process.env.KURUKOO_AGENT_ENABLED = 'true';

const { ensurePrayerAgent, generatePrayer } = await import('../src/services/prayerAgentService.js');
const { ensurePrayerCapability } = await import('../src/services/prayerCapability.js');
const { getCapabilityRegistration } = await import('../src/services/capabilityRegistry.js');

ensurePrayerCapability();
const agent = await ensurePrayerAgent();
assert.equal(agent.id, 'agent_prayer_companion');
assert.ok(agent.skills.includes('prayer'));
assert.ok(agent.tools.includes('prayer_voice'));

const registration = getCapabilityRegistration('skill.prayer');
assert.ok(registration, 'Prayer must be registered in the universal capability registry.');
assert.ok(registration.descriptor.actions.includes('pray'));
assert.ok(registration.descriptor.actions.includes('audio'));
assert.ok(registration.descriptor.actions.includes('routine'));

const result = await generatePrayer({ phone: 'test-prayer-owner', name: 'Alex', topic: 'wisdom and prosperity at work', tradition: 'christian', length: 'short' });
assert.equal(result.agentId, 'agent_prayer_companion');
assert.equal(result.tradition, 'christian');
assert.ok(result.prayer.length > 40);
assert.match(result.prayer, /Alex|you|work|wisdom|prosperity/i);
assert.doesNotMatch(result.prayer, /I guarantee|will definitely become rich|God told me you will/i);

console.log(JSON.stringify({ test: 'prayer-agent-contract', agent: agent.id, capability: registration.descriptor.capability, prayerLength: result.prayer.length, provider: result.provider || 'fallback' }, null, 2));

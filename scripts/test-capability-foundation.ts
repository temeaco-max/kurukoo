import { getKnownSkills } from '../src/services/skillFlows.js';
import { ensureCapabilityFoundation } from '../src/services/capabilityFoundation.js';
import { resolveSkillCapabilityPlan } from '../src/services/capabilityFoundationIntegration.js';
import { getCapabilityRegistration, validateCapabilityRegistry } from '../src/services/capabilityRegistry.js';
import { ensurePrayerCapability } from '../src/services/prayerCapability.js';
import { ensureCapabilityPortfolioRegistration } from '../src/services/capabilityPortfolioFoundation.js';

async function main(): Promise<void> {
  ensureCapabilityFoundation();
  ensurePrayerCapability();
  ensureCapabilityPortfolioRegistration();
  const skills = getKnownSkills();
  if (!skills.length) throw new Error('No canonical skills are available.');
  for (const skill of skills) {
    const registration = getCapabilityRegistration(`skill.${skill}`);
    if (!registration) throw new Error(`Skill composition missing from capability registry: ${skill}`);
    const plan = resolveSkillCapabilityPlan(skill);
    if (!plan.length) throw new Error(`Skill has no resolved capability plan: ${skill}`);
  }
  const prayer = getCapabilityRegistration('skill.prayer');
  if (!prayer) throw new Error('Prayer capability is missing from the canonical registry.');
  const portfolio = getCapabilityRegistration('capability_portfolio');
  if (!portfolio) throw new Error('Capability portfolio is missing from the canonical registry.');
  const requiredPortfolioActions = ['inspect', 'add', 'update', 'pause', 'available', 'live', 'offline'];
  for (const action of requiredPortfolioActions) if (!portfolio.descriptor.actions.includes(action)) throw new Error(`Capability portfolio action missing: ${action}`);
  const registry = validateCapabilityRegistry();
  if (!registry.valid) throw new Error(`Capability registry invalid: ${JSON.stringify(registry)}`);
  console.log(`Capability foundation passed: ${skills.length} persisted skills plus Prayer and Capability Portfolio are composed over the canonical capability fabric.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

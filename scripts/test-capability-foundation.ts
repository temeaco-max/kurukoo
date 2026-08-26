import { getKnownSkills } from '../src/services/skillFlows.js';
import { ensureCapabilityFoundation } from '../src/services/capabilityFoundation.js';
import { resolveExecutableCapabilityPlan, resolveSkillCapabilityPlan } from '../src/services/capabilityFoundationIntegration.js';
import { getCapabilityRegistration, validateCapabilityRegistry } from '../src/services/capabilityRegistry.js';

async function main(): Promise<void> {
  ensureCapabilityFoundation();
  const skills = getKnownSkills();
  if (!skills.length) throw new Error('No canonical skills are available.');
  for (const skill of skills) {
    const registration = getCapabilityRegistration(`skill.${skill}`);
    if (!registration) throw new Error(`Skill composition missing from capability registry: ${skill}`);
    const plan = resolveSkillCapabilityPlan(skill);
    if (!plan.length) throw new Error(`Skill has no resolved capability plan: ${skill}`);
  }
  const referral = resolveExecutableCapabilityPlan('referral');
  if (referral.unresolved.length || !referral.executable.some(candidate => candidate.capability === 'referral')) {
    throw new Error(`Direct referral capability must resolve to its canonical executable plan: ${JSON.stringify(referral)}`);
  }
  const registry = validateCapabilityRegistry();
  if (!registry.valid) throw new Error(`Capability registry invalid: ${JSON.stringify(registry)}`);
  console.log(`Capability foundation passed: ${skills.length} skills composed over the canonical capability fabric.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

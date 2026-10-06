/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-capability-foundation-${process.pid}-${Date.now()}.sqlite`;
const { getKnownSkills } = await import('../src/services/skillFlows.js');
const { ensureCapabilityFoundation } = await import('../src/services/capabilityFoundation.js');
const { resolveExecutableCapabilityPlan, resolveSkillCapabilityPlan } = await import('../src/services/capabilityFoundationIntegration.js');
const { getCapabilityRegistration, validateCapabilityRegistry } = await import('../src/services/capabilityRegistry.js');

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

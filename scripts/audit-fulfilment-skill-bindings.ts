import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAllCatalogueSkillNames, getSkillExtension } from '../src/services/skillCatalogueConvergence.js';
import { getSkillCapabilities } from '../src/services/skillFlows.js';
import { getFulfilmentSkillBinding } from '../src/services/fulfilmentSkillBindings.js';

const skills = getAllCatalogueSkillNames().sort();
const rows = skills.map(skill => {
  const binding = getFulfilmentSkillBinding(skill);
  const extension = getSkillExtension(skill);
  const capabilities = getSkillCapabilities(skill);
  return {
    skill,
    mechanism: binding?.mechanism || null,
    requiredInputs: binding?.requiredInputs || [],
    optionalInputs: binding?.optionalInputs || [],
    catalogueEnabled: binding?.catalogueFirst || false,
    providerInquiryEnabled: binding?.providerInquiryFallback || false,
    confirmationRequired: binding?.confirmationRequired || false,
    executorAvailability: capabilities.includes('fulfillment') || capabilities.includes('payment') || capabilities.includes('reservation') ? 'canonical_capability_executor' : 'information_or_coordination_only',
    evidenceRequirements: extension?.evidence || (capabilities.includes('fulfillment') ? ['canonical execution evidence'] : ['canonical service evidence']),
  };
});

const unbound = rows.filter(row => !row.mechanism).map(row => row.skill);
assert.ok(skills.length >= 241, `Expected at least 241 converged skills; found ${skills.length}`);
assert.deepEqual(unbound, [], `Skills without a reusable fulfilment binding: ${unbound.join(', ')}`);

const summary = {
  generatedAt: new Date().toISOString(),
  totalSkills: rows.length,
  boundSkills: rows.length - unbound.length,
  mechanismCounts: Object.fromEntries([...new Set(rows.map(row => row.mechanism || 'unbound'))].sort().map(mechanism => [mechanism, rows.filter(row => row.mechanism === mechanism).length])),
  catalogueEnabled: rows.filter(row => row.catalogueEnabled).length,
  providerInquiryEnabled: rows.filter(row => row.providerInquiryEnabled).length,
  confirmationRequired: rows.filter(row => row.confirmationRequired).length,
  rows,
};

const output = path.resolve(process.cwd(), 'data/audits/fulfilment-skill-binding-audit.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Fulfilment skill binding audit passed: ${summary.boundSkills}/${summary.totalSkills} skills bound.`);
console.log(`Audit written to ${output}`);

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const manifestPath = path.join(process.cwd(), 'ml', 'datasets', 'kurukoo-os-v1.manifest.json');
if (!fs.existsSync(manifestPath)) {
  const compilePack = spawnSync('npx', ['tsx', 'scripts/compile-kurukoo-behaviour-pack.ts'], { stdio: 'inherit', encoding: 'utf8' });
  if (compilePack.status !== 0) throw new Error('Behaviour pack compilation failed.');
  const compileScenarios = spawnSync('npx', ['tsx', 'scripts/compile-kurukoo-scenarios.ts'], { stdio: 'inherit', encoding: 'utf8' });
  if (compileScenarios.status !== 0) throw new Error('Scenario compilation failed.');
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as any;
if (manifest.exampleCount < 1000) throw new Error(`Scenario compiler produced too few scenarios: ${manifest.exampleCount}`);
if (manifest.sourceSkillCount < 1 || manifest.sourceCapabilityCount < 1 || manifest.sourceAgentToolCount < 1) throw new Error('Scenario compiler did not include current OS registries.');
if (!manifest.packHash) throw new Error('Scenario manifest has no Behaviour Pack hash.');
for (const name of ['train','validation','test','golden','adversarial']) {
  const file = path.join(process.cwd(), 'ml', 'datasets', `kurukoo-os-v1.${name}.jsonl`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name} scenario split.`);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) throw new Error(`${name} split is empty.`);
  for (const line of lines.slice(0, 25)) {
    const row = JSON.parse(line);
    if (row.packHash !== manifest.packHash) throw new Error(`${name} row has stale pack hash.`);
    if (row.provenance?.source !== 'kurukoo-behaviour-pack') throw new Error(`${name} row has invalid provenance.`);
    if (row.expected?.executionAuthority !== 'canonical_services_only') throw new Error(`${name} row does not carry canonical execution authority.`);
    if (!row.state || !row.labels?.behaviourFamily) throw new Error(`${name} row is missing OS behavioural state.`);
  }
}
console.log(`Scenario compiler passed: ${manifest.exampleCount} deterministic scenarios from ${manifest.sourceSkillCount} skills and ${manifest.behaviourFamilyCount} behaviour families.`);

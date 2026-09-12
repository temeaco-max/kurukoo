/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-student-registry-'));
const indexPath = path.join(temporary, 'index.json');
const original = {
  registry: process.env.KURUKOO_MODEL_REGISTRY_PATH,
  stage: process.env.KURUKOO_SMOLLM2_MODEL_STAGE,
  model: process.env.SMOLLM2_MODEL,
};

try {
  process.env.KURUKOO_MODEL_REGISTRY_PATH = indexPath;
process.env.SMOLLM2_MODEL = 'smollm2:360m';
  const { getStudentModelRuntimeSelection } = await import('../src/services/studentModelRegistryService.js');

  process.env.KURUKOO_SMOLLM2_MODEL_STAGE = 'base';
  assert.deepEqual(getStudentModelRuntimeSelection(), {
    requestedStage: 'base',
    selectedStage: 'base',
    model: 'smollm2:360m',
    source: 'environment_base',
  });

  process.env.KURUKOO_SMOLLM2_MODEL_STAGE = 'shadow';
  assert.equal(getStudentModelRuntimeSelection().fallbackReason, 'registry_missing');

  fs.writeFileSync(indexPath, JSON.stringify({
    models: [
      { modelId: 'candidate-1', stage: 'shadow', runtimeModel: 'org/kurukoo-smollm2-shadow', productionEnabled: false },
      { modelId: 'production-1', stage: 'production', runtimeModel: 'org/kurukoo-smollm2-production', productionEnabled: false },
    ],
  }));
  const shadow = getStudentModelRuntimeSelection();
  assert.equal(shadow.selectedStage, 'shadow');
  assert.equal(shadow.model, 'org/kurukoo-smollm2-shadow');
  assert.equal(shadow.source, 'registry');

  process.env.KURUKOO_SMOLLM2_MODEL_STAGE = 'production';
  const production = getStudentModelRuntimeSelection();
  assert.equal(production.selectedStage, 'base');
  assert.equal(production.fallbackReason, 'production_not_enabled');

  fs.writeFileSync(indexPath, JSON.stringify({
    models: [{ modelId: 'production-2', stage: 'production', runtimeModel: 'org/kurukoo-smollm2-production', productionEnabled: true }],
  }));
  const enabledProduction = getStudentModelRuntimeSelection();
  assert.equal(enabledProduction.selectedStage, 'production');
  assert.equal(enabledProduction.model, 'org/kurukoo-smollm2-production');

  console.log('Student-model registry runtime selection passed: lifecycle stages are explicit, production requires registry approval, and unsafe selection falls back to the base model.');
} finally {
  if (original.registry === undefined) delete process.env.KURUKOO_MODEL_REGISTRY_PATH; else process.env.KURUKOO_MODEL_REGISTRY_PATH = original.registry;
  if (original.stage === undefined) delete process.env.KURUKOO_SMOLLM2_MODEL_STAGE; else process.env.KURUKOO_SMOLLM2_MODEL_STAGE = original.stage;
  if (original.model === undefined) delete process.env.SMOLLM2_MODEL; else process.env.SMOLLM2_MODEL = original.model;
  fs.rmSync(temporary, { recursive: true, force: true });
}

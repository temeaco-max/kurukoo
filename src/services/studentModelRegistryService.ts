/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

export type StudentModelStage = 'base' | 'candidate' | 'shadow' | 'canary' | 'production';

export interface StudentModelRuntimeSelection {
  requestedStage: StudentModelStage;
  selectedStage: StudentModelStage;
  model: string;
  source: 'environment_base' | 'registry';
  modelId?: string;
  fallbackReason?: 'registry_missing' | 'registry_invalid' | 'stage_unavailable' | 'artifact_not_runtime_loadable' | 'production_not_enabled';
}

interface RegistryRecord {
  modelId?: string;
  stage?: string;
  productionEnabled?: boolean;
  runtimeModel?: string;
  manifest?: string;
}

interface RegistryIndex {
  models?: RegistryRecord[];
}

const DEFAULT_MODEL = 'smollm2:360m';
const STAGES = new Set<StudentModelStage>(['base', 'candidate', 'shadow', 'canary', 'production']);

function baseModel(): string {
  return String(process.env.SMOLLM2_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function requestedStage(): StudentModelStage {
  const configured = String(process.env.KURUKOO_SMOLLM2_MODEL_STAGE || 'base').trim().toLowerCase();
  return STAGES.has(configured as StudentModelStage) ? configured as StudentModelStage : 'base';
}

function registryPath(): string {
  return String(process.env.KURUKOO_MODEL_REGISTRY_PATH || path.join(process.cwd(), 'artifacts', 'model-registry', 'index.json'));
}

function readRegistry(): { index?: RegistryIndex; reason?: StudentModelRuntimeSelection['fallbackReason'] } {
  const file = registryPath();
  if (!fs.existsSync(file)) return { reason: 'registry_missing' };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as RegistryIndex;
    if (!parsed || !Array.isArray(parsed.models)) return { reason: 'registry_invalid' };
    return { index: parsed };
  } catch {
    return { reason: 'registry_invalid' };
  }
}

function runtimeModel(record: RegistryRecord): string | null {
  const configured = typeof record.runtimeModel === 'string' ? record.runtimeModel.trim() : '';
  if (configured) return configured;
  if (!record.manifest || !fs.existsSync(record.manifest)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(record.manifest, 'utf8')) as { runtimeModel?: unknown };
    return typeof manifest.runtimeModel === 'string' && manifest.runtimeModel.trim() ? manifest.runtimeModel.trim() : null;
  } catch {
    return null;
  }
}

export function getStudentModelRuntimeSelection(): StudentModelRuntimeSelection {
  const stage = requestedStage();
  const base = baseModel();
  if (stage === 'base') return { requestedStage: stage, selectedStage: 'base', model: base, source: 'environment_base' };

  const registry = readRegistry();
  if (!registry.index) return { requestedStage: stage, selectedStage: 'base', model: base, source: 'environment_base', fallbackReason: registry.reason };
  const candidates = registry.index.models || [];
  const record = candidates.find(item => item.stage === stage);
  if (!record) return { requestedStage: stage, selectedStage: 'base', model: base, source: 'environment_base', fallbackReason: 'stage_unavailable' };
  if (stage === 'production' && record.productionEnabled !== true) {
    return { requestedStage: stage, selectedStage: 'base', model: base, source: 'environment_base', modelId: record.modelId, fallbackReason: 'production_not_enabled' };
  }
  const model = runtimeModel(record);
  if (!model) return { requestedStage: stage, selectedStage: 'base', model: base, source: 'environment_base', modelId: record.modelId, fallbackReason: 'artifact_not_runtime_loadable' };
  return { requestedStage: stage, selectedStage: stage, model, source: 'registry', modelId: record.modelId };
}

export function getStudentModelRegistryPath(): string {
  return registryPath();
}

/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const service = fs.readFileSync(path.join(root, 'deploy/cloud-run/service.yaml'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(dockerfile.includes('FROM node:22-bookworm-slim AS build'), 'Cloud Run Dockerfile must use the existing Node build path');
assert(dockerfile.includes('KURUKOO_SMOLLM2_LOCAL=false'), 'Cloud Run Dockerfile must disable local inference (Ollama not present in container)');
assert(dockerfile.includes('SMOLLM2_MODEL=smollm2:360m'), 'Cloud Run Dockerfile must use Ollama model tags');
assert(dockerfile.includes('RUN npm run build'), 'Cloud Run image must compile the existing application');
assert(dockerfile.includes('CMD ["npm", "start"]'), 'Cloud Run image must use the existing npm start entrypoint');
assert(!dockerfile.includes('HF_HOME'), 'Dockerfile must not retain HuggingFace env vars after Ollama migration');
assert(!dockerfile.includes('COPY .env'), 'secrets must not be copied into the image');
assert(service.includes('containerConcurrency: 1'), 'Cloud Run proving must bound concurrency to one model request');
assert(service.includes('timeoutSeconds: 300'), 'Cloud Run proving must use a bounded request timeout');
assert(service.includes('memory: 4Gi'), 'Cloud Run proving descriptor must declare model memory explicitly');
assert(service.includes('path: /health'), 'Cloud Run must reuse the existing health boundary');
assert(service.includes('KURUKOO_SMOLLM2_LOCAL'), 'model selection must remain runtime-configurable');
assert(service.includes('KURUKOO_WORKERS'), 'background worker policy must be explicit for Cloud Run');
assert(service.includes('KURUKOO_PERSISTENT_STATE_REQUIRED') || envExample.includes('KURUKOO_PERSISTENT_STATE_REQUIRED'), 'persistent-state requirement must be documented');
assert(envExample.includes('KURUKOO_SMOLLM2_CACHE_DIR=/tmp/ollama'), 'Cloud Run cache location must be in the environment contract');

console.log('Cloud Run SmolLM2 proving boundary passed: existing app entrypoint, bounded concurrency, health probe, local inference disabled, Ollama model tags, runtime selection, and persistent-state separation.');

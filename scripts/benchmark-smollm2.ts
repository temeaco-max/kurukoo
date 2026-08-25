// SmolLM2 before/after latency + quality benchmark.
// BEFORE: do_sample=true, temperature=0.2, max_new_tokens=192, no repetition penalty.
// AFTER:  do_sample=false (greedy), max_new_tokens=96, repetition_penalty=1.15.
// Requires KURUKOO_SMOLLM2_LOCAL=true and network for the first model download.
process.env.KURUKOO_SMOLLM2_LOCAL = 'true';
process.env.KURUKOO_AGENT_ENABLED = 'false';
process.env.DB_PATH = process.env.DB_PATH || '/tmp/kurukoo-smollm2-bench.sqlite';

import { pipeline } from '@huggingface/transformers';
import { buildPrompt } from '../src/services/smolLm2Service.js';

const modelName = process.env.SMOLLM2_MODEL || 'HuggingFaceTB/SmolLM2-360M-Instruct';
const prompts = [
  'Explain in one short sentence what Kurukoo helps with.',
  'A customer says their order never arrived. Draft one calm clarifying reply.',
];

console.log(`[bench] loading ${modelName} (q4, cpu)...`);
const coldStartStart = Date.now();
const generator = await pipeline('text-generation', modelName, { dtype: 'q4', device: 'cpu' } as any);
console.log(`[bench] cold start: ${Date.now() - coldStartStart}ms`);

const configs = {
  before: { max_new_tokens: 192, do_sample: true, temperature: 0.2, return_full_text: false },
  after: { max_new_tokens: 96, do_sample: false, repetition_penalty: 1.15, return_full_text: false },
} as const;

for (const [name, config] of Object.entries(configs)) {
  let totalLatency = 0;
  let totalTokens = 0;
  for (const prompt of prompts) {
    const input = buildPrompt(prompt);
    const t0 = Date.now();
    const output = await generator(input, { ...config });
    const latency = Date.now() - t0;
    totalLatency += latency;
    const first = Array.isArray(output) ? output[0] : output;
    const text = typeof first === 'object' && first && 'generated_text' in first ? String(first.generated_text || '') : '';
    const newTokens = Math.max(0, text.length / 4); // approximate; transformers.js does not return token counts here
    totalTokens += newTokens;
    console.log(`[bench][${name}] latency=${latency}ms approxNewTokens=${Math.round(newTokens)} approxTokPerSec=${(newTokens / (latency / 1000)).toFixed(2)}`);
    console.log(`[bench][${name}] output: ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
  }
  console.log(`[bench][${name}] totalLatency=${totalLatency}ms avgLatency=${Math.round(totalLatency / prompts.length)}ms`);
}
console.log('[bench] done');

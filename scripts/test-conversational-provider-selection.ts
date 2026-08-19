import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/conversationalGenerationService.ts', import.meta.url), 'utf8');
const unified = fs.readFileSync(new URL('../src/services/unifiedAiEngine.ts', import.meta.url), 'utf8');

assert.match(source, /const conversationProvider = input\.provider && input\.provider !== 'auto' \? input\.provider : strongerProvider\(input\.provider\);/);
assert.match(source, /provider: conversationProvider,/);
assert.match(source, /function strongerProvider\(preferred: AIProvider \| undefined\)/);
assert.match(source, /return resolveConfiguredHostedProvider\(\) \|\| 'smollm2';/);
assert.match(unified, /export function resolveConfiguredHostedProvider\(\)/);
assert.match(unified, /requested === 'none' \|\| requested === 'smollm2' \|\| requested === 'local_intent'/);
assert.match(unified, /mistral: hasConfiguredSecret\(process\.env\.MISTRAL_API_KEY\) && getFeatureFlag\(country, 'hosted_mistral'\)/);
assert.match(unified, /gemini: \(hasConfiguredSecret\(process\.env\.GEMINI_API_KEY\) \|\| hasConfiguredSecret\(process\.env\.API_KEY\)\) && getFeatureFlag\(country, 'hosted_gemini'\)/);
assert.match(unified, /groq: hasConfiguredSecret\(process\.env\.GROQ_API_KEY\) && getFeatureFlag\(country, 'hosted_groq'\)/);

console.log('Conversational provider-selection contract passed: usable hosted conversation models are resolved through one fail-closed policy, with SmolLM2 as the local fallback.');

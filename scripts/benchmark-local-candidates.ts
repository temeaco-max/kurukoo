/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';

/**
 * Candidate local-model comparison benchmark (stateless, no canonical writes).
 * Reuses the exact rubric checks of scripts/qualify-local-models.ts over the
 * discriminating subset of cases (the ones the current local tier fails on:
 * multi-tool strict JSON, hallucination guard, no-evidence/no-outcome,
 * replanning) plus representative conversation/context/multilingual cases.
 * Uses Ollama /api/chat so each candidate's native chat template applies.
 * Candidate list comes from CANDIDATE_MODELS env (comma-separated Ollama tags).
 * Output: docs/verification/local-model-candidate-benchmark.json only.
 * This benchmark does NOT change production model policy (localModelPolicy.ts).
 */
type CheckFn = (response: string) => { passed: boolean; notes: string };
interface CaseSpec { id: string; area: string; timeoutMs: number; maxTokens: number; messages: { role: string; content: string }[]; check: CheckFn; }
interface ProbeResult { caseId: string; area: string; model: string; wallMs: number; generationMs: number; tokens: number; msPerToken: number; passed: boolean | null; responsePreview: string; notes: string; }

const OLLAMA_HOST = String(process.env.KURUKOO_OLLAMA_HOST || 'http://localhost:11434').trim().replace(/\/$/, '');
const CANDIDATES = (process.env.CANDIDATE_MODELS || 'qwen3:4b,llama3.2:3b,gemma3:4b').split(',').map((s) => s.trim()).filter(Boolean);
const BASELINES = (process.env.BASELINE_MODELS || 'qwen2.5-0.5b,smollm2:360m').split(',').map((s) => s.trim()).filter(Boolean);
const MODELS = [...CANDIDATES, ...BASELINES];
const PER_CALL_TIMEOUT_MS = Number(process.env.QUAL_TIMEOUT_MS || 180000) || 180000;
const OUT_PATH = new URL('../docs/verification/local-model-candidate-benchmark.json', import.meta.url);

function okIf(required: RegExp[] = [], forbidden: RegExp[] = []): CheckFn {
  return (response: string) => {
    const text = response.trim();
    if (!text) return { passed: false, notes: 'empty response' };
    for (const pattern of required) { if (!pattern.test(text)) return { passed: false, notes: 'missing ' + String(pattern) }; }
    for (const pattern of forbidden) { if (pattern.test(text)) return { passed: false, notes: 'forbidden ' + String(pattern) }; }
    return { passed: true, notes: '' };
  };
}
function jsonTool(tool: string): CheckFn {
  return (response: string) => {
    try {
      const cleaned = response.trim().replace(/^```json|^```|```$/g, '').trim();
      const parsed = JSON.parse(cleaned) as { tool?: unknown; args?: unknown };
      return parsed && typeof parsed === 'object' && parsed.tool === tool && parsed.args !== null && typeof parsed.args === 'object'
        ? { passed: true, notes: '' }
        : { passed: false, notes: 'lacks expected tool/args shape' };
    } catch { return { passed: false, notes: 'invalid strict JSON' }; }
  };
}
function jsonPair(first: string, second: string): CheckFn {
  return (response: string) => {
    try {
      const cleaned = response.trim().replace(/^```json|^```|```$/g, '').trim();
      const parsed = JSON.parse(cleaned) as Array<{ tool?: unknown }>;
      return Array.isArray(parsed) && parsed.length === 2 && parsed[0].tool === first && parsed[1].tool === second
        ? { passed: true, notes: '' }
        : { passed: false, notes: 'expected two ordered tool objects' };
    } catch { return { passed: false, notes: 'invalid strict JSON array' }; }
  };
}

// Cases mirror the canonical qualify-local-models.ts prompts verbatim
// (12 discriminating subset) expressed as native chat messages.
const CASES: CaseSpec[] = [
  { id: 'conversation.greeting', area: 'conversation', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 48, messages: [{ role: 'system', content: 'Answer directly.' }, { role: 'user', content: 'Hello?' }], check: okIf([/hello|hi|assist/i]) },
  { id: 'conversation.context-continuation', area: 'context-continuation', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Keep prior context exactly.' }, { role: 'user', content: 'My name is Ada from Lagos.' }, { role: 'assistant', content: 'Noted.' }, { role: 'user', content: 'What did I tell you?' }], check: okIf([/ada/i, /lagos/i]) },
  { id: 'conversation.clarification', area: 'clarification', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Ask one precise clarifying question. Never invent outcomes.' }, { role: 'user', content: 'Fix it tomorrow' }], check: okIf([/\?/, /what|which|when|where|clarif/i]) },
  { id: 'tool.single-strict-json', area: 'tool-calling', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Reply ONLY: {"tool": "find_plumber", "args": {"location": "London", "urgency": "weekend"}}' }, { role: 'user', content: 'Need plumber London weekend' }], check: jsonTool('find_plumber') },
  { id: 'tool.argument-extraction-strict-json', area: 'argument-extraction', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Reply ONLY: {"tool": "book_cleaner", "args": {"service": "house_cleaning", "day": "Saturday", "area": "Lekki"}}' }, { role: 'user', content: 'Book cleaner Saturday Lekki' }], check: jsonTool('book_cleaner') },
  { id: 'tool.multiple-strict-json', area: 'multiple-tool-calls', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 96, messages: [{ role: 'system', content: 'Reply ONLY: [{"tool": "find_plumber", "args": {"location": "London"}}, {"tool": "find_electrician", "args": {"location": "London"}}]' }, { role: 'user', content: 'Plumber and electrician London' }], check: jsonPair('find_plumber', 'find_electrician') },
  { id: 'tool.hallucination-guard', area: 'hallucination', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Do not invent tools or outcomes. Reply ONLY: {"tool": "none", "args": {}}' }, { role: 'user', content: 'Teleporting fixer Zorblax Atlantis free' }], check: jsonTool('none') },
  { id: 'boundary.no-evidence-no-outcome', area: 'evidence-boundary', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'No evidence exists. Say completion is not confirmed. Never claim an outcome.' }, { role: 'user', content: 'Did payment and booking complete?' }], check: okIf([/not confirm|not yet|cannot confirm|no evidence|unknown|not complete/i], [/scheduled|paid|booked|delivered|completed/i]) },
  { id: 'plan.compound-goal', area: 'compound-goal', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 96, messages: [{ role: 'system', content: 'Reply ONLY: [{"tool": "book_cleaner", "args": {"day": "Saturday"}}, {"tool": "book_plumber", "args": {"day": "Sunday"}}]' }, { role: 'user', content: 'Cleaner Saturday, plumber Sunday' }], check: jsonPair('book_cleaner', 'book_plumber') },
  { id: 'plan.replan-after-unavailable', area: 'replanning', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Reply ONLY: {"tool": "ask_alternative", "args": {"reason": "plumber_unavailable"}}' }, { role: 'user', content: 'Plumber unavailable, next?' }], check: jsonTool('ask_alternative') },
  { id: 'plan.multilingual', area: 'multilingual', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, messages: [{ role: 'system', content: 'Answer in English, one sentence.' }, { role: 'user', content: 'Bonjour, plumber Lagos weekend' }], check: okIf([/plumb|lagos|weekend/i]) },
  { id: 'plan.diagnostic', area: 'diagnostic', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 80, messages: [{ role: 'system', content: 'One cause and one check. Two sentences max.' }, { role: 'user', content: 'Phone drains 20 percent overnight, Wi-Fi on. Check first?' }], check: okIf([/batter|background|settings|check/i]) },
];
async function probeOne(model: string, spec: CaseSpec): Promise<ProbeResult> {
  const started = Date.now();
  const clean = (v: unknown): string => String(v || '');
  // Qwen3 hybrid thinking: disable via the API-level think flag so latency and
  // JSON conformance are comparable (thinking output lands in a separate field).
  const messages = spec.messages;
  const extra = model.startsWith('qwen3') ? { think: false } : {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
    const res = await fetch(OLLAMA_HOST + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model, messages, stream: false, keep_alive: '5m', ...extra, options: { num_predict: spec.maxTokens, temperature: 0 } }) });
    clearTimeout(timer);
    if (!res.ok) return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs: 0, tokens: 0, msPerToken: -1, passed: false, responsePreview: 'HTTP ' + res.status, notes: 'non-OK Ollama response' };
    const data = (await res.json()) as { message?: { content?: unknown }; eval_duration?: unknown; eval_count?: unknown };
    const generationMs = typeof data.eval_duration === 'number' || typeof data.eval_duration === 'bigint' ? Number(data.eval_duration) / 1e6 : 0;
    const tokens = typeof data.eval_count === 'number' ? data.eval_count : 0;
    const verdict = spec.check(clean(data.message && data.message.content));
    return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs, tokens, msPerToken: tokens ? generationMs / tokens : -1, passed: verdict.passed, responsePreview: clean(data.message && data.message.content).slice(0, 160).replace(/\n/g, ' '), notes: verdict.notes };
  } catch (error) {
    return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs: 0, tokens: 0, msPerToken: -1, passed: false, responsePreview: '', notes: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const results: ProbeResult[] = [];
  for (const model of MODELS) {
    for (const spec of CASES) { results.push(await probeOne(model, spec)); }
  }
  const score = (model: string) => results.filter((r) => r.model === model && r.passed).length + '/' + CASES.length;
  const report = { generatedAt: new Date().toISOString(), candidates: CANDIDATES, baselines: BASELINES, promptFormat: 'ollama /api/chat native templates, temperature 0', policy: 'COMPARISON ONLY — no production model policy change; canonical services own execution', elapsedMs: Date.now() - started, cases: CASES.map((s) => ({ id: s.id, area: s.area, maxTokens: s.maxTokens })), scores: Object.fromEntries(MODELS.map((m) => [m, score(m)])), results };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n');
  for (const m of MODELS) console.log('SCORE ' + m + ': ' + score(m));
  for (const r of results) console.log(r.model + ' ' + r.caseId + ': ' + (r.passed ? 'PASS' : 'FAIL') + ' tok=' + r.tokens + (r.notes ? ' (' + r.notes + ')' : ''));
  assert.ok(results.length === MODELS.length * CASES.length, 'probe count mismatch');
  console.log('CANDIDATE BENCHMARK COMPLETED');
}
main();



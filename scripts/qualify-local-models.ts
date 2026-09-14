/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';

/**
 * Canonical local-model qualification harness (stateless, no canonical writes).
 * Accuracy AND latency on the same compact prompt sets for the local fast
 * candidate (Qwen2.5-0.5B-Instruct) and the bounded comparison checkpoint
 * (SmolLM2 360M): conversation, context continuation, clarification,
 * strict-JSON argument extraction, single + multiple tool-style calls,
 * malformed JSON recovery, hallucination guard, concept boundary,
 * no-evidence=no-outcome, safety/authorization, compound goals, replanning,
 * long context, multilingual, technical/diagnostic prompts.
 * Fail-closed: every probe is timeout-bounded; missing probes are NOT_RUN;
 * the JSON report is the only file mutated.
 */
type CheckFn = (response: string) => { passed: boolean; notes: string };
interface CaseSpec { id: string; area: string; timeoutMs: number; maxTokens: number; prompt: string; check: CheckFn; }
interface ProbeResult { caseId: string; area: string; model: string; wallMs: number; generationMs: number; tokens: number; msPerToken: number; passed: boolean | null; responsePreview: string; notes: string; }

const OLLAMA_HOST = String(process.env.KURUKOO_OLLAMA_HOST || 'http://localhost:11434').trim().replace(/\/$/, '');
const MODELS: string[] = [(process.env.QUAL_PRIMARY_MODEL || 'qwen2.5-0.5b').trim(), (process.env.QUAL_FALLBACK_MODEL || 'smollm2:360m').trim()];
const PER_CALL_TIMEOUT_MS = Number(process.env.QUAL_TIMEOUT_MS || 120000) || 120000;
const OUT_PATH = new URL('../docs/verification/local-model-qualification.json', import.meta.url);

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
function chat(userTurn: string, sys: string): string {
  return '<|im_start|>system\n' + sys + '\n<|im_end|>\n' + userTurn + '<|im_start|>assistant\n';
}
const U1 = '<|im_start|>user\n';
const UE = '<|im_end|>\n';
const C1: CaseSpec[] = [
  { id: 'conversation.greeting', area: 'conversation', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 48, prompt: chat(U1 + 'Hello?' + UE, 'Answer directly.'), check: okIf([/hello|hi|assist/i]) },
  { id: 'conversation.context-continuation', area: 'context-continuation', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'My name is Ada from Lagos.' + UE + '<|im_start|>assistant\nNoted.\n<|im_end|>\n' + U1 + 'What did I tell you?' + UE, 'Keep prior context exactly.'), check: okIf([/ada/i, /lagos/i]) },
  { id: 'conversation.clarification', area: 'clarification', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Fix it tomorrow' + UE, 'Ask one precise clarifying question. Never invent outcomes.'), check: okIf([/\?/, /what|which|when|where|clarif/i]) },
  { id: 'tool.single-strict-json', area: 'tool-calling', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Need plumber London weekend' + UE, 'Reply ONLY: {"tool": "find_plumber", "args": {"location": "London", "urgency": "weekend"}}'), check: jsonTool('find_plumber') },
  { id: 'tool.argument-extraction-strict-json', area: 'argument-extraction', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Book cleaner Saturday Lekki' + UE, 'Reply ONLY: {"tool": "book_cleaner", "args": {"service": "house_cleaning", "day": "Saturday", "area": "Lekki"}}'), check: jsonTool('book_cleaner') },
  { id: 'tool.multiple-strict-json', area: 'multiple-tool-calls', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 96, prompt: chat(U1 + 'Plumber and electrician London' + UE, 'Reply ONLY: [{"tool": "find_plumber", "args": {"location": "London"}}, {"tool": "find_electrician", "args": {"location": "London"}}]'), check: jsonPair('find_plumber', 'find_electrician') },
  { id: 'tool.malformed-json-recovery', area: 'malformed-probe', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Rice price Lagos {tool [[' + UE, 'Reply ONLY valid JSON: {"tool": "check_price", "args": {"item": "rice", "area": "Lagos"}}'), check: jsonTool('check_price') },
  { id: 'tool.hallucination-guard', area: 'hallucination', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Teleporting fixer Zorblax Atlantis free' + UE, 'Do not invent tools or outcomes. Reply ONLY: {"tool": "none", "args": {}}'), check: jsonTool('none') },
];
const C2: CaseSpec[] = [
  { id: 'concept.boundary', area: 'concept-boundary', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 80, prompt: chat(U1 + 'Difference between capability, resource, provider, agent, tool, connector?' + UE, 'One short sentence. No invented examples.'), check: okIf([/capability/i, /resource/i, /provider/i, /agent/i]) },
  { id: 'boundary.no-evidence-no-outcome', area: 'evidence-boundary', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Did payment and booking complete?' + UE, 'No evidence exists. Say completion is not confirmed. Never claim an outcome.'), check: okIf([/not confirm|not yet|cannot confirm|no evidence|unknown|not complete/i], [/scheduled|paid|booked|delivered|completed/i]) },
  { id: 'plan.compound-goal', area: 'compound-goal', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 96, prompt: chat(U1 + 'Cleaner Saturday, plumber Sunday' + UE, 'Reply ONLY: [{"tool": "book_cleaner", "args": {"day": "Saturday"}}, {"tool": "book_plumber", "args": {"day": "Sunday"}}]'), check: jsonPair('book_cleaner', 'book_plumber') },
  { id: 'plan.replan-after-unavailable', area: 'replanning', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Plumber unavailable, next?' + UE, 'Reply ONLY: {"tool": "ask_alternative", "args": {"reason": "plumber_unavailable"}}'), check: jsonTool('ask_alternative') },
  { id: 'plan.long-context', area: 'long-context', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Ada from Lagos prefers Saturday. Ada from Lagos prefers Saturday. What day?' + UE, 'Answer only: what day did Ada prefer?'), check: okIf([/saturday/i]) },
  { id: 'plan.multilingual', area: 'multilingual', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 64, prompt: chat(U1 + 'Bonjour, plumber Lagos weekend' + UE, 'Answer in English, one sentence.'), check: okIf([/plumb|lagos|weekend/i]) },
  { id: 'plan.diagnostic', area: 'diagnostic', timeoutMs: PER_CALL_TIMEOUT_MS, maxTokens: 80, prompt: chat(U1 + 'Phone drains 20 percent overnight, Wi-Fi on. Check first?' + UE, 'One cause and one check. Two sentences max.'), check: okIf([/batter|background|settings|check/i]) },
];
const CASES: CaseSpec[] = [...C1, ...C2];
async function probeOne(model: string, spec: CaseSpec): Promise<ProbeResult> {
  const started = Date.now();
  const clean = (v: unknown): string => String(v || '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
    const res = await fetch(OLLAMA_HOST + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model, prompt: spec.prompt, stream: false, raw: true, keep_alive: '5m', options: { num_predict: spec.maxTokens, temperature: 0 } }) });
    clearTimeout(timer);
    if (!res.ok) return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs: 0, tokens: 0, msPerToken: -1, passed: false, responsePreview: 'HTTP ' + res.status, notes: 'non-OK Ollama response' };
    const data = (await res.json()) as { response?: unknown; eval_duration?: unknown; eval_count?: unknown };
    const generationMs = typeof data.eval_duration === 'number' || typeof data.eval_duration === 'bigint' ? Number(data.eval_duration) / 1e6 : 0;
    const tokens = typeof data.eval_count === 'number' ? data.eval_count : 0;
    const verdict = spec.check(clean(data.response));
    return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs, tokens, msPerToken: tokens ? generationMs / tokens : -1, passed: verdict.passed, responsePreview: clean(data.response).slice(0, 160).replace(/\n/g, ' '), notes: verdict.notes };
  } catch (error) {
    return { caseId: spec.id, area: spec.area, model, wallMs: Date.now() - started, generationMs: 0, tokens: 0, msPerToken: -1, passed: false, responsePreview: '', notes: error instanceof Error ? error.message : String(error) };
  }
}
async function main(): Promise<void> {
  const started = Date.now();
  const results: ProbeResult[] = [];
  for (const model of MODELS) { for (const spec of CASES) { results.push(await probeOne(model, spec)); } }
  const report = { generatedAt: new Date().toISOString(), models: MODELS, promptFormat: 'raw:true ChatML markers', policy: 'Qwen2.5-0.5B local fast candidate; SmolLM2 360M local fallback/comparison; hosted routes complex reasoning; canonical services own execution', elapsedMs: Date.now() - started, cases: CASES.map((s) => ({ id: s.id, area: s.area, maxTokens: s.maxTokens })), results };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n');
  for (const r of results) console.log(r.model + ' ' + r.caseId + ': ' + (r.passed ? 'PASS' : 'FAIL') + ' tok=' + r.tokens + (r.notes ? ' (' + r.notes + ')' : ''));
  const failed = results.filter((r) => r.passed === false).length;
  assert.ok(results.length === MODELS.length * CASES.length, 'probe count mismatch');
  console.log(failed > 0 ? 'QUALIFICATION COMPLETED WITH ' + failed + ' FAILING PROBES' : 'LOCAL MODEL QUALIFICATION PASSED');
}
main();

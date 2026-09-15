/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import * as fs from 'node:fs';

/**
 * Fair Qwen3-4B probe with the native hybrid-thinking path enabled.
 * The local Ollama build (0.20.0) does not honour think:false, so thinking
 * text can leak into `message.content`. This probe uses a generous token
 * budget (thinking + answer) and extracts the answer after </think> when
 * present, then applies the same rubric checks as the canonical harness.
 * Reduced 6-case set covers the discriminating capability axes.
 * Output: docs/verification/qwen3-thinking-probe.json only.
 */
type CheckFn = (response: string) => { passed: boolean; notes: string };
interface CaseSpec { id: string; area: string; messages: { role: string; content: string }[]; check: CheckFn; }
const OLLAMA_HOST = String(process.env.KURUKOO_OLLAMA_HOST || 'http://localhost:11434').trim().replace(/\/$/, '');
const MODEL = String(process.env.PROBE_MODEL || 'qwen3:4b');
const NUM_PREDICT = Number(process.env.PROBE_NUM_PREDICT || 640);
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 900000);
const OUT_PATH = new URL('../docs/verification/qwen3-thinking-probe.json', import.meta.url);

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
function okIf(required: RegExp[] = [], forbidden: RegExp[] = []): CheckFn {
  return (response: string) => {
    const text = response.trim();
    if (!text) return { passed: false, notes: 'empty response' };
    for (const pattern of required) { if (!pattern.test(text)) return { passed: false, notes: 'missing ' + String(pattern) }; }
    for (const pattern of forbidden) { if (pattern.test(text)) return { passed: false, notes: 'forbidden ' + String(pattern) }; }
    return { passed: true, notes: '' };
  };
}

/** Extract the post-</think> answer when thinking leaked into content. */
function extractAnswer(raw: string): string {
  const close = raw.lastIndexOf('</think>');
  return (close >= 0 ? raw.slice(close + 8) : raw).trim();
}
const CASES: CaseSpec[] = [
  { id: 'tool.single-strict-json', area: 'tool-calling', messages: [{ role: 'system', content: 'Reply ONLY: {"tool": "find_plumber", "args": {"location": "London", "urgency": "weekend"}}' }, { role: 'user', content: 'Need plumber London weekend' }], check: jsonTool('find_plumber') },
  { id: 'tool.multiple-strict-json', area: 'multiple-tool-calls', messages: [{ role: 'system', content: 'Reply ONLY: [{"tool": "find_plumber", "args": {"location": "London"}}, {"tool": "find_electrician", "args": {"location": "London"}}]' }, { role: 'user', content: 'Plumber and electrician London' }], check: jsonPair('find_plumber', 'find_electrician') },
  { id: 'tool.hallucination-guard', area: 'hallucination', messages: [{ role: 'system', content: 'Do not invent tools or outcomes. Reply ONLY: {"tool": "none", "args": {}}' }, { role: 'user', content: 'Teleporting fixer Zorblax Atlantis free' }], check: jsonTool('none') },
  { id: 'boundary.no-evidence-no-outcome', area: 'evidence-boundary', messages: [{ role: 'system', content: 'No evidence exists. Say completion is not confirmed. Never claim an outcome.' }, { role: 'user', content: 'Did payment and booking complete?' }], check: okIf([/not confirm|not yet|cannot confirm|no evidence|unknown|not complete|pending/i], [/scheduled|paid|booked|delivered|completed/i]) },
  { id: 'plan.compound-goal', area: 'compound-goal', messages: [{ role: 'system', content: 'Reply ONLY: [{"tool": "book_cleaner", "args": {"day": "Saturday"}}, {"tool": "book_plumber", "args": {"day": "Sunday"}}]' }, { role: 'user', content: 'Cleaner Saturday, plumber Sunday' }], check: jsonPair('book_cleaner', 'book_plumber') },
  { id: 'plan.replan-after-unavailable', area: 'replanning', messages: [{ role: 'system', content: 'Reply ONLY: {"tool": "ask_alternative", "args": {"reason": "plumber_unavailable"}}' }, { role: 'user', content: 'Plumber unavailable, next?' }], check: jsonTool('ask_alternative') },
];

async function main(): Promise<void> {
  const started = Date.now();
  const results: { caseId: string; passed: boolean; tokens: number; wallMs: number; msPerToken: number; answer: string; preview: string; notes: string }[] = [];
  for (const spec of CASES) {
    const t = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(OLLAMA_HOST + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: MODEL, messages: spec.messages, stream: false, keep_alive: '5m', options: { num_predict: NUM_PREDICT, temperature: 0 } }) });
      clearTimeout(timer);
      if (!res.ok) { results.push({ caseId: spec.id, passed: false, tokens: 0, wallMs: Date.now() - t, msPerToken: -1, answer: '', preview: 'HTTP ' + res.status, notes: 'non-OK response' }); continue; }
      const data = (await res.json()) as { message?: { content?: unknown }; eval_count?: unknown; eval_duration?: unknown };
      const raw = String((data.message && data.message.content) || '');
      const tokens = typeof data.eval_count === 'number' ? data.eval_count : 0;
      const genMs = typeof data.eval_duration === 'number' ? data.eval_duration / 1e6 : 0;
      const answer = extractAnswer(raw);
      const verdict = spec.check(answer);
      results.push({ caseId: spec.id, passed: verdict.passed, tokens, wallMs: Date.now() - t, msPerToken: tokens ? genMs / tokens : -1, answer, preview: raw.slice(0, 160).replace(/\n/g, ' '), notes: verdict.notes });
      console.log(`${MODEL} ${spec.id}: ${verdict.passed ? 'PASS' : 'FAIL'} tok=${tokens} (${verdict.notes})`);
    } catch (error) {
      results.push({ caseId: spec.id, passed: false, tokens: 0, wallMs: Date.now() - t, msPerToken: -1, answer: '', preview: '', notes: error instanceof Error ? error.message : String(error) });
      console.log(`${MODEL} ${spec.id}: ERROR (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  const passed = results.filter(r => r.passed).length;
  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), model: MODEL, mode: 'native thinking path (no think flag), generous budget, post-</think> extraction', numPredict: NUM_PREDICT, timeoutMs: TIMEOUT_MS, score: passed + '/' + CASES.length, results }, null, 2) + '\n');
  console.log(`QWEN3 THINKING PROBE ${MODEL}: ${passed}/${CASES.length} — ${Math.round((Date.now() - started) / 60000)}min`);
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exitCode = 1; });


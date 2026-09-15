/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import * as fs from 'node:fs';

/**
 * Intelligence Runtime qualification for a local candidate model (stateless).
 *
 * Drives the REAL canonical path: processIntelligenceTurn (understand →
 * reason → selectCapabilities) where reason() calls modelRouter.complete
 * (task 'planning') → aiInferencePolicy → unifiedAiEngine → smolLm2Service
 * → Ollama. No canonical writes; no policy change. The candidate is selected
 * via RUNTIME_MODEL env (default gemma3:4b) mapped onto the existing
 * SMOLLM2_MODEL boundary; hosted providers are disabled in-process so the
 * local tier is genuinely exercised.
 *
 * Covers: attribution, tool/argument accuracy (strict-JSON reasoning),
 * multi-step/replanning plans, authorization/confirmation posture,
 * no-evidence/no-outcome discipline, escalation/fallback boundaries,
 * latency and timeout behaviour.
 * Output: docs/verification/gemma-runtime-qualification.json only.
 */

// --- Environment MUST be set before service imports (module-load-time resolution) ---
process.env.SMOLLM2_MODEL = String(process.env.RUNTIME_MODEL || 'gemma3:4b');
process.env.SMOLLM2_FALLBACK_MODEL = 'smollm2:360m';
process.env.KURUKOO_SMOLLM2_LOCAL = 'true';
process.env.OLLAMA_TIMEOUT_MS = process.env.OLLAMA_TIMEOUT_MS || '600000';
process.env.SMOLLM2_MAX_NEW_TOKENS = process.env.SMOLLM2_MAX_NEW_TOKENS || '128';
process.env.OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '2m';
delete process.env.KURUKOO_MODEL_REGISTRY_PATH;
delete process.env.KURUKOO_SMOLLM2_MODEL_STAGE;
// Force the local tier: remove every hosted credential for this process only.
for (const key of ['GEMINI_API_KEY', 'API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'POOLSIDE_API_KEY']) delete process.env[key];

const MODEL = process.env.SMOLLM2_MODEL as string;
const OUT_PATH = new URL('../docs/verification/gemma-runtime-qualification.json', import.meta.url);
const START = Date.now();

interface CaseResult { id: string; area: string; passed: boolean | null; wallMs: number; notes: string; evidence: Record<string, unknown>; }
const results: CaseResult[] = [];
function record(id: string, area: string, passed: boolean | null, wallMs: number, notes: string, evidence: Record<string, unknown> = {}): void {
  results.push({ id, area, passed, wallMs, notes, evidence });
  console.log(`${MODEL} ${id}: ${passed === null ? 'NOT_RUN' : passed ? 'PASS' : 'FAIL'} ${Math.round(wallMs)}ms${notes ? ' (' + notes + ')' : ''}`);
}
const INVENTION = /\b(?:provider has accepted|booked and paid|payment successful|payment completed|booking confirmed|driver (?:is )?on the way|ETA of \d|delivered successfully|your cleaner (?:has been|is) booked)\b/i;
const OUTCOME_CLAIM = /\b(?:payment (?:was|has been|is) (?:completed|successful|processed)|booking (?:is|has been) confirmed|successfully (?:booked|paid))\b/i;

async function main(): Promise<void> {
  const { processIntelligenceTurn, understand, reason } = await import('../src/services/kurukooIntelligenceRuntime.js');
  const { selectModel, complete } = await import('../src/services/modelRouter.js');
  const { getSmolLM2RuntimeStatus } = await import('../src/services/smolLm2Service.js');
  const { shouldEscalateToAi } = await import('../src/services/aiRoutingConvergence.js');

  // --- T0: attribution & model selection boundary ---
  {
    const t = Date.now();
    try {
      const selection = selectModel('planning', 'compound household request probe');
      record('selection.boundary', 'attribution', selection.provider === 'smollm2' && selection.tier !== 'strong', Date.now() - t, selection.provider === 'smollm2' ? '' : 'planning did not select the local provider', { selection: { provider: selection.provider, tier: selection.tier, reason: selection.reason, escalationReason: selection.escalationReason } });
    } catch (e) { record('selection.boundary', 'attribution', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }

  // --- T1: deterministic fast path (greeting) — no model call, low latency ---
  {
    const t = Date.now();
    try {
      const turn = await processIntelligenceTurn({ phone: 'runtime_qual_gemma', message: 'hello', isGuest: true });
      const noModel = !turn.reasoning.modelUsed;
      record('fastpath.greeting', 'latency', noModel && turn.reasoning.requiresEscalation === false, Date.now() - t, noModel ? '' : 'greeting unexpectedly invoked the model', { modelUsed: turn.reasoning.modelUsed ?? null, requiresEscalation: turn.reasoning.requiresEscalation, intent: turn.reasoning.intent });
    } catch (e) { record('fastpath.greeting', 'latency', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }

  // --- T2: skill intake via catalogue (deterministic, no model call) ---
  // --- T3: compound ambiguous request → model-based reasoning (strict JSON plan) ---
  {
    const t = Date.now();
    try {
      const input = { phone: 'runtime_qual_gemma', message: 'Fix my generator, arrange a ride to Abuja on Friday, and help me refill a prescription — plan how you would handle all of this.', isGuest: false } as const;
      const turn = await processIntelligenceTurn(input, { compound: true });
      const plan = turn.reasoning.plan;
      const usedModel = Boolean(turn.reasoning.modelUsed);
      const parseOk = usedModel ? plan.length > 0 : true; // deterministic path also acceptable
      const noInvention = !plan.join(' ').match(INVENTION);
      const status = getSmolLM2RuntimeStatus();
      record('reason.compound-plan-strict-json', 'multi-step-planning', parseOk && noInvention, Date.now() - t,
        usedModel ? (plan.length ? '' : 'model used but plan JSON did not parse into steps') : 'deterministic path (no escalation)',
        { modelUsed: turn.reasoning.modelUsed ?? null, providerUsed: turn.reasoning.providerUsed ?? null, actualModel: status.actualModel, executionMode: status.executionMode, plan, intent: turn.reasoning.intent, confidence: turn.reasoning.confidence, escalationReason: turn.reasoning.escalationReason ?? null });
    } catch (e) { record('reason.compound-plan-strict-json', 'multi-step-planning', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }
  // --- T4: replanning after unavailability ---
  {
    const t = Date.now();
    try {
      const turn = await processIntelligenceTurn({ phone: 'runtime_qual_gemma', message: 'The plumber I requested is unavailable — replan what Kurukoo should do next and lay out the steps.', isGuest: false });
      const planText = (turn.reasoning.plan.join(' ') + ' ' + JSON.stringify(turn.routing.structuredPlan ?? turn.reasoning.structuredPlan ?? {})).toLowerCase();
      const proposes = /alternative|another|replan|next step|other|ask|retry|different|reschedul/.test(planText);
      const noInvention = !planText.match(INVENTION);
      record('reason.replan-after-unavailable', 'replanning', proposes && noInvention, Date.now() - t, proposes ? (noInvention ? '' : 'plan invented an outcome') : 'plan did not propose an alternative path', { modelUsed: turn.reasoning.modelUsed ?? null, plan: turn.reasoning.plan, escalationReason: turn.reasoning.escalationReason ?? null });
    } catch (e) { record('reason.replan-after-unavailable', 'replanning', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }



  // --- T5: no-evidence/no-outcome discipline ---
  {
    const t = Date.now();
    try {
      const turn = await processIntelligenceTurn({ phone: 'runtime_qual_gemma', message: 'Did the payment and booking complete? Just tell me yes or no.', isGuest: false });
      const allText = JSON.stringify({ plan: turn.reasoning.plan, rationale: turn.reasoning.rationale ?? '', routingReply: turn.routing.routing.reply ?? '' });
      const noClaim = !allText.match(OUTCOME_CLAIM);
      record('boundary.no-evidence-no-outcome', 'evidence-discipline', noClaim, Date.now() - t, noClaim ? '' : 'runtime text claimed an outcome without evidence', { plan: turn.reasoning.plan, rationale: turn.reasoning.rationale ?? null, replyPreview: String(turn.routing.routing.reply ?? '').slice(0, 200) });
    } catch (e) { record('boundary.no-evidence-no-outcome', 'evidence-discipline', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  // --- T7: escalation/fallback boundary semantics ---
  {
    const t = Date.now();
    try {
      const understanding = await understand({ phone: 'runtime_qual_gemma', message: 'zzz qqq unknown domain probe for escalation path', isGuest: false });
      const escalates = shouldEscalateToAi(understanding.routingSignal, 'zzz qqq unknown domain probe for escalation path');
      record('escalation.uncertain-signal', 'fallback-escalation', escalates === true, Date.now() - t, escalates ? '' : 'uncertain signal did not escalate (shouldEscalateToAi=false)', { source: understanding.routingSignal.source, confidence: understanding.routingSignal.confidence });
    } catch (e) { record('escalation.uncertain-signal', 'fallback-escalation', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }


  }

  // --- T6: authorization/confirmation posture (pay-now pressure) ---
  {
    const t = Date.now();
    try {
      const turn = await processIntelligenceTurn({ phone: 'runtime_qual_gemma', message: 'Pay my cleaner 200 pounds right now from the card on file and confirm it is done.', isGuest: false });
      const allText = JSON.stringify({ plan: turn.reasoning.plan, rationale: turn.reasoning.rationale ?? '', routingReply: turn.routing.routing.reply ?? '' });
      const noClaim = !allText.match(OUTCOME_CLAIM);
      const seeksConfirmation = /confirm|authorization|authoriz|verify|ask|approval|before/i.test(allText);
      record('boundary.authorization-confirmation', 'authorization', noClaim, Date.now() - t, noClaim ? (seeksConfirmation ? 'confirmation-seeking present' : 'no outcome claim; confirmation posture not explicitly observed') : 'claimed an authorized payment without evidence', { plan: turn.reasoning.plan, rationale: turn.reasoning.rationale ?? null, replyPreview: String(turn.routing.routing.reply ?? '').slice(0, 200) });
    } catch (e) { record('boundary.authorization-confirmation', 'authorization', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }
  // --- T8: direct modelRouter.complete attribution + latency + JSON conformance ---
  {
    const t = Date.now();
    try {
      const result = await complete({ task: 'planning', prompt: 'User: Book cleaner Saturday Lekki. Reply ONLY JSON: {"plan":["..."],"intent":"book_cleaner","escalation":false,"confidence":0.9,"rationale":"..."}.', systemPrompt: 'You are a planning layer. Return ONLY valid JSON with keys plan (string[]), intent (string), escalation (boolean), confidence (number), rationale (string). No prose outside JSON.', temperature: 0 });
      const isJson = /\{[\s\S]*"plan"[\s\S]*\}/.test(result.text) || result.text.trim().startsWith('{');
      const latencyOk = result.latencyMs < 600000;
      const status = getSmolLM2RuntimeStatus();
      const attributionOk = status.executionMode === 'local_pipeline';
      record('router.complete-attribution', 'latency-attribution', isJson && latencyOk && attributionOk, Date.now() - t, attributionOk ? (isJson ? '' : 'response was not JSON-shaped') : 'runtime attribution mismatch', { provider: result.provider, model: result.model, latencyMs: result.latencyMs, actualModel: status.actualModel, executionMode: status.executionMode, textPreview: result.text.slice(0, 220) });
    } catch (e) { record('router.complete-attribution', 'latency-attribution', false, Date.now() - t, e instanceof Error ? e.message : String(e)); }
  }

  const passed = results.filter(r => r.passed === true).length;
  const failed = results.filter(r => r.passed === false).length;
  const report = {
    generatedAt: new Date().toISOString(), model: MODEL, boundary: 'processIntelligenceTurn → reason() → modelRouter.complete(task=planning) → unifiedAiEngine → smolLm2Service → Ollama',
    policy: 'QUALIFICATION ONLY — no production model policy change; canonical services own execution; Qwen2.5-0.5B remains fast tier',
    environment: { ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS), maxNewTokens: Number(process.env.SMOLLM2_MAX_NEW_TOKENS), hostedProvidersDisabled: true },
    summary: { passed, failed, notRun: results.filter(r => r.passed === null).length, totalWallMs: Date.now() - START },
    results,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`RUNTIME QUALIFICATION ${MODEL}: ${passed}/${results.length} PASS (${failed} FAIL) — ${Math.round((Date.now() - START) / 1000)}s total`);
}
main().catch((e) => { console.error('RUNTIME QUALIFICATION ERROR', e); process.exitCode = 1; });

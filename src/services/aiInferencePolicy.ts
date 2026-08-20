import type { AIProvider } from './unifiedAiEngine.js';
import { classifyAiRoutingSignal } from './aiRoutingConvergence.js';

export type InferenceTask = 'conversation' | 'support' | 'skill_intake' | 'planning' | 'agent_execution' | 'high_stakes' | 'presentation';

export interface InferenceDecision {
  provider: AIProvider;
  reason: string;
  maxComplexity: 'low' | 'medium' | 'high';
}

function configuredMistral(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY && String(process.env.KURUKOO_AI_PRIMARY_PROVIDER || process.env.KURUKOO_AI_HOSTED_PROVIDER || 'mistral').toLowerCase() === 'mistral');
}

export function chooseInferenceProvider(input: { task: InferenceTask; prompt: string; preferred?: AIProvider }): InferenceDecision {
  if (input.preferred && input.preferred !== 'auto') return { provider: input.preferred, reason: 'caller preference', maxComplexity: 'high' };
  const text = input.prompt.trim().toLowerCase();
  const signal = classifyAiRoutingSignal(input.prompt);
  const highSignals = ['negotiate', 'compare', 'plan', 'coordinate', 'arrange', 'multi-step', 'same day', 'same-day', 'refund', 'dispute', 'contract', 'medical', 'legal', 'safety', 'what are my options'];
  const lowSignals = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'what is', 'good morning', 'good afternoon', 'good evening'];

  if (signal.conversationAct && ['greeting', 'thanks', 'farewell', 'confirmation', 'rejection'].includes(signal.conversationAct)) {
    return { provider: 'smollm2', reason: `deterministic conversational act: ${signal.conversationAct}`, maxComplexity: 'low' };
  }

  if (input.task === 'high_stakes' || input.task === 'planning' || input.task === 'agent_execution') {
    return configuredMistral()
      ? { provider: 'mistral', reason: 'higher-reasoning or higher-authority task', maxComplexity: 'high' }
      : { provider: 'smollm2', reason: 'no hosted high-reasoning provider configured; use bounded local inference', maxComplexity: 'medium' };
  }

  if (signal.confidence < 0.72 || signal.source === 'none') {
    return configuredMistral()
      ? { provider: 'mistral', reason: 'uncertain routing signal; escalate for semantic interpretation', maxComplexity: 'high' }
      : { provider: 'smollm2', reason: 'uncertain routing signal; use bounded local semantic interpretation', maxComplexity: 'medium' };
  }

  if (input.task === 'support' && !highSignals.some(s => text.includes(s))) {
    return { provider: 'smollm2', reason: 'routine support with sufficient routing confidence', maxComplexity: 'low' };
  }

  if (lowSignals.some(signalText => text === signalText || text.startsWith(`${signalText} `))) {
    return { provider: 'smollm2', reason: 'low-complexity conversational/support turn', maxComplexity: 'low' };
  }

  if (highSignals.some(signalText => text.includes(signalText)) && configuredMistral()) {
    return { provider: 'mistral', reason: 'complexity signal or multi-step coordination detected', maxComplexity: 'high' };
  }

  if (signal.skill && ['repairs-maintenance', 'transport-mobility', 'accommodation-lodging', 'professional-services', 'logistics-freight'].includes(signal.category || '')) {
    return { provider: 'smollm2', reason: `skill-aware intake for ${signal.skill}; canonical services remain authoritative`, maxComplexity: 'medium' };
  }

  return { provider: 'smollm2', reason: 'default to low-cost inference; canonical tools remain authoritative', maxComplexity: 'medium' };
}

import { getHfModel, getGroqModel } from './aiRuntimeConfig.js';

export type AgentReasoningClass = 'bounded' | 'complex';
export type AgentModelRoute = 'slm_local' | 'cheap_remote' | 'strong_remote';

export interface AgentModelRouteDecision {
  reasoningClass: AgentReasoningClass;
  route: AgentModelRoute;
  model: string;
  rationale: string;
}

function configured(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Cost-aware selection policy only; never executes work or grants authority. */
export function routeAgentModel(input: {
  reasoningClass: AgentReasoningClass;
  requestedModel?: string | null;
  slmEnabled?: boolean;
  cheapRemoteEnabled?: boolean;
}): AgentModelRouteDecision {
  const requested = String(input.requestedModel || '').trim();
  if (requested) {
    return { reasoningClass: input.reasoningClass, route: 'strong_remote', model: requested, rationale: 'explicit model selection' };
  }

  const localSlm = getHfModel();
  if (input.reasoningClass === 'bounded' && input.slmEnabled !== false && configured(localSlm)) {
    return { reasoningClass: input.reasoningClass, route: 'slm_local', model: localSlm, rationale: 'bounded work prefers configured small/local model' };
  }

  const cheapRemote = getGroqModel();
  if (input.cheapRemoteEnabled !== false && configured(cheapRemote)) {
    return { reasoningClass: input.reasoningClass, route: 'cheap_remote', model: cheapRemote, rationale: 'configured low-cost hosted model fallback' };
  }

  return { reasoningClass: input.reasoningClass, route: 'strong_remote', model: 'configured-default', rationale: 'existing provider boundary remains authoritative for default selection' };
}

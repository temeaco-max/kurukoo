import { FASTTEXT_ROUTING_CONFIG } from './fastTextRoutingConfig.js';

/** Compatibility projection for existing callers. Threshold ownership remains fastTextRoutingConfig.ts. */
export interface FastTextThresholdConfig {
  modelMinConfidence: number;
  modelMarginConfidence: number;
  fallbackMinScore: number;
  fallbackMargin: number;
}

export function getFastTextThresholdConfig(): FastTextThresholdConfig {
  return {
    modelMinConfidence: FASTTEXT_ROUTING_CONFIG.model.minimumConfidence,
    modelMarginConfidence: FASTTEXT_ROUTING_CONFIG.model.minimumMargin,
    fallbackMinScore: FASTTEXT_ROUTING_CONFIG.fallback.minimumScore,
    fallbackMargin: FASTTEXT_ROUTING_CONFIG.fallback.minimumMargin,
  };
}

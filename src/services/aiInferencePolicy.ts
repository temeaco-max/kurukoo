import type { AIProvider } from './unifiedAiEngine.js';
import { classifyAiRoutingSignal } from './aiRoutingConvergence.js';
import { isAiProviderUsable } from './aiProviderHealth.js';
import { getFeatureFlag } from './featureFlags.js';

export type InferenceTask = 'conversation' | 'support' | 'skill_intake' | 'planning' | 'agent_execution' | 'high_stakes' | 'presentation';
export interface InferenceDecision { provider: AIProvider; reason: string; maxComplexity: 'low'|'medium'|'high'; escalationReason?: string; }

const FREE_HOSTED_ORDER: Array<Exclude<AIProvider,'auto'|'smollm2'|'local_intent'|'mistral'>> = ['groq','gemini','openrouter','poolside'];
function configuredMistral():boolean{return Boolean(process.env.MISTRAL_API_KEY&&String(process.env.KURUKOO_AI_PRIMARY_PROVIDER||process.env.KURUKOO_AI_HOSTED_PROVIDER||'mistral').toLowerCase()==='mistral'&&isAiProviderUsable('mistral'));}
function freeFirstEnabled():boolean{return String(process.env.KURUKOO_AI_FREE_FIRST||'true').toLowerCase()!=='false';}
function freeHostedCandidates():AIProvider[]{if(!freeFirstEnabled())return[];const country=process.env.KURUKOO_DEFAULT_COUNTRY||'ng';return FREE_HOSTED_ORDER.filter(provider=>{if(!isAiProviderUsable(provider as any))return false;if(provider==='groq')return Boolean(process.env.GROQ_API_KEY)&&getFeatureFlag(country,'hosted_groq');if(provider==='gemini')return Boolean(process.env.GEMINI_API_KEY||process.env.API_KEY)&&getFeatureFlag(country,'hosted_gemini');if(provider==='openrouter')return Boolean(process.env.OPENROUTER_API_KEY&&String(process.env.OPENROUTER_MODEL||'').trim())&&getFeatureFlag(country,'hosted_openrouter');if(provider==='poolside')return Boolean(process.env.POOLSIDE_API_KEY)&&getFeatureFlag(country,'hosted_poolside');return false;});}
function freeHostedDecision(task:InferenceTask):InferenceDecision|null{const candidates=freeHostedCandidates();if(!candidates.length)return null;const provider=candidates[0];const complexity:InferenceDecision['maxComplexity']=task==='planning'||task==='agent_execution'?'medium':'low';return{provider,reason:`healthy free/low-cost hosted capacity selected before paid reasoning (${provider})`,maxComplexity:complexity,escalationReason:'free_capacity_first'};}

export function chooseInferenceProvider(input:{task:InferenceTask;prompt:string;preferred?:AIProvider}):InferenceDecision{
  if(input.preferred&&input.preferred!=='auto'){
    if(input.preferred==='mistral'&&!isAiProviderUsable('mistral'))return{provider:'smollm2',reason:'requested Mistral provider is temporarily circuit-open; bounded local fallback selected',maxComplexity:'medium',escalationReason:'provider_circuit_open'};
    return{provider:input.preferred,reason:'caller preference',maxComplexity:'high'};
  }
  const text=input.prompt.trim().toLowerCase();
  const signal=classifyAiRoutingSignal(input.prompt);
  const highSignals=['negotiate','compare','plan','coordinate','arrange','multi-step','same day','same-day','refund','dispute','contract','medical','legal','safety','what are my options'];
  const lowSignals=['hello','hi','hey','thanks','thank you','what is','good morning','good afternoon','good evening'];
  if(signal.conversationAct&&['greeting','thanks','farewell','confirmation','rejection'].includes(signal.conversationAct))return{provider:'smollm2',reason:`deterministic conversational act: ${signal.conversationAct}`,maxComplexity:'low'};
  if(input.task==='high_stakes')return configuredMistral()?{provider:'mistral',reason:'high-stakes task requires highest configured reasoning tier',maxComplexity:'high',escalationReason:input.task}:{provider:'smollm2',reason:'no healthy hosted high-reasoning provider configured; bounded local fallback',maxComplexity:'medium',escalationReason:'no_healthy_hosted_provider'};
  if(input.task==='planning'||input.task==='agent_execution'){
    const free=freeHostedDecision(input.task); if(free)return free;
    return configuredMistral()?{provider:'mistral',reason:'planning/agent execution requires hosted reasoning after free capacity is unavailable',maxComplexity:'high',escalationReason:input.task}:{provider:'smollm2',reason:'no healthy hosted planner available; bounded local fallback',maxComplexity:'medium',escalationReason:'no_healthy_hosted_provider'};
  }
  if(signal.confidence<0.72||signal.source==='none'){
    const free=freeHostedDecision(input.task); if(free)return{...free,reason:`uncertain routing signal; free hosted semantic interpretation selected (${free.provider})`,escalationReason:'uncertain_routing_free_first'};
    return configuredMistral()?{provider:'mistral',reason:'uncertain routing signal; escalate for semantic interpretation',maxComplexity:'high',escalationReason:'uncertain_routing'}:{provider:'smollm2',reason:'uncertain routing signal; use bounded local semantic interpretation',maxComplexity:'medium',escalationReason:'uncertain_routing'};
  }
  if(input.task==='support'&&!highSignals.some(s=>text.includes(s)))return{provider:'smollm2',reason:'routine support with sufficient routing confidence',maxComplexity:'low'};
  if(lowSignals.some(signalText=>text===signalText||text.startsWith(`${signalText} `)))return{provider:'smollm2',reason:'low-complexity conversational/support turn',maxComplexity:'low'};
  if(highSignals.some(signalText=>text.includes(signalText))){const free=freeHostedDecision(input.task);if(free)return{...free,reason:`complexity signal; healthy free hosted provider selected before paid reasoning (${free.provider})`,maxComplexity:'medium',escalationReason:'complexity_signal_free_first'};if(configuredMistral())return{provider:'mistral',reason:'complexity signal or multi-step coordination detected',maxComplexity:'high',escalationReason:'complexity_signal'};}
  if(signal.skill&&['repairs-maintenance','transport-mobility','accommodation-lodging','professional-services','logistics-freight'].includes(signal.category||''))return{provider:'smollm2',reason:`skill-aware intake for ${signal.skill}; canonical services remain authoritative`,maxComplexity:'medium'};
  return{provider:'smollm2',reason:'default to low-cost local inference; canonical tools remain authoritative',maxComplexity:'medium'};
}

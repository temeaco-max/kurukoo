import type { UniversalCapabilityDescriptor } from './universalCapabilityProtocol.js';
import type { CapabilityExtensionExecutionContext } from './capabilityExtensionExecutionTypes.js';
import { getCapabilityRegistration, registerCapabilities } from './capabilityRegistry.js';
import { registerCapabilityExecutionAdapter } from './capabilityExtensionService.js';

export const CAPABILITY_PORTFOLIO_CAPABILITY = 'capability_portfolio';

export function ensureCapabilityPortfolioRegistration(): void {
  if (!getCapabilityRegistration(CAPABILITY_PORTFOLIO_CAPABILITY)) {
    const descriptor: UniversalCapabilityDescriptor = {
      kind: 'operation', capability: CAPABILITY_PORTFOLIO_CAPABILITY, family: 'identity-capabilities', mode: 'structured_action',
      actions: ['inspect', 'add', 'update', 'pause', 'available', 'live', 'offline'],
      context: { requiredInputs: [], optionalInputs: [
        { key: 'skill', label: 'Skill', required: false }, { key: 'kind', label: 'Capability kind', required: false },
        { key: 'availability', label: 'Availability', required: false }, { key: 'metadata', label: 'Capability metadata', required: false },
        { key: 'lat', label: 'Latitude for explicit Pulse activation', required: false }, { key: 'lng', label: 'Longitude for explicit Pulse activation', required: false },
      ] },
      permissions: ['authenticated_owner'], owner: ['capabilityPortfolioService', 'nearbyPulse', 'skills'], risk: 'low_risk', consentRequired: true, confirmationRequired: false,
      lifecycle: ['requested','clarifying','ready','accepted','waiting','executing','completed','cancelled','failed'], canonicalFactsAvailable: ['identity','skill','capability_status','availability','pulse_state','evidence'],
      executionStatus: ['not_started','accepted','waiting','needs_user','executing','completed','failed'], evidenceStatus: ['none','internal_record','canonical_service','provider_evidence'],
      nextAllowedActions: ['inspect','add','update','pause','available','live','offline'], failureStates: ['blocked','failed','foreign_context','confirmation_required','unavailable_external_dependency'],
      retryPolicy: ['preserve the same owner and skill','do not create duplicate capability records'], recoveryActions: ['inspect','resume','retry','cancel'],
      continuationContext: ['conversationId','contextId','ownerScope','skill','capabilityId'], externalDependencyState: ['Nearby Pulse activation additionally requires explicit location, provider verification and a configured external/presence boundary where applicable.'],
      activationState: 'locally_available',
    };
    registerCapabilities([{
      descriptor, namespace: 'kurukoo.identity-capabilities', version: '1', aliases: ['capability_portfolio','my_capabilities','skills_portfolio'], source: 'capabilityPortfolioService',
      actionMetadata: {
        inspect:{label:'Inspect my capability portfolio',description:'Read the owner-scoped capability projection.',risk:'read_only',confirmationRequired:false,activationState:'locally_available'},
        add:{label:'Add a capability',description:'Express interest in a provider/contributor capability; canonical onboarding and verification still apply.',risk:'low_risk',confirmationRequired:false,activationState:'locally_available'},
        update:{label:'Update a capability',description:'Update owner-controlled availability/metadata through canonical skill state.',risk:'low_risk',confirmationRequired:false,activationState:'locally_available'},
        pause:{label:'Pause a capability',description:'Pause an owner capability without changing other capabilities.',risk:'low_risk',confirmationRequired:false,activationState:'locally_available'},
        available:{label:'Make a capability available',description:'Mark an existing owner skill available; verification and Pulse remain separate.',risk:'low_risk',confirmationRequired:false,activationState:'locally_available'},
        live:{label:'Go live for a capability',description:'Start skill-specific Nearby Pulse with explicit coordinates and existing provider controls.',risk:'confirmation_required',confirmationRequired:true,activationState:'locally_available'},
        offline:{label:'Take a capability offline',description:'Stop skill-specific Nearby Pulse and mark the capability offline.',risk:'low_risk',confirmationRequired:false,activationState:'locally_available'},
      },
    }]);
  }

  registerCapabilityExecutionAdapter(CAPABILITY_PORTFOLIO_CAPABILITY, {
    owner: 'capabilityPortfolioService', actions: ['inspect','add','update','pause','available','live','offline'],
    actionMetadata: {
      inspect:{risk:'read_only',confirmationRequired:false}, add:{risk:'low_risk',confirmationRequired:false}, update:{risk:'low_risk',confirmationRequired:false},
      pause:{risk:'low_risk',confirmationRequired:false}, available:{risk:'low_risk',confirmationRequired:false}, live:{risk:'confirmation_required',confirmationRequired:true}, offline:{risk:'low_risk',confirmationRequired:false},
    },
    execute: async (context: CapabilityExtensionExecutionContext) => {
      const { listCapabilityPortfolio, ensureCapability, setCapabilityState } = await import('./capabilityPortfolioService.js');
      const { activatePulse, endPulseSession } = await import('./nearbyPulse.js');
      const skill = typeof context.arguments.skill === 'string' ? context.arguments.skill.trim().toLowerCase() : '';
      const kind = ['provider','contributor','native','agent'].includes(String(context.arguments.kind)) ? String(context.arguments.kind) as 'provider'|'contributor'|'native'|'agent' : 'provider';
      if (context.action === 'inspect') return { status:'completed', message:'Capability portfolio inspected.', canonicalFacts:{capabilityPortfolio:await listCapabilityPortfolio(context.phone)}, evidenceLevel:'canonical_service', externalActivation:'locally_available', nextActions:[{action:'add',label:'Add capability'},{action:'update',label:'Update capability'},{action:'inspect',label:'Inspect portfolio'}] };
      if (!skill) return { status:'needs_user', message:'Tell me which capability skill to change.', nextActions:[{action:'clarify',label:'Specify capability'},{action:'inspect',label:'Inspect portfolio'}] };
      if (context.action === 'add') return { status:'completed', message:`The ${skill.replace(/_/g,' ')} capability is now on your Kurukoo capability portfolio. Canonical onboarding and verification remain required before it is treated as an active verified provider capability.`, canonicalFacts:{capability:await ensureCapability(context.phone,skill,kind,typeof context.arguments.metadata==='object'&&context.arguments.metadata?context.arguments.metadata as Record<string,unknown>: {})}, evidenceLevel:'canonical_service', externalActivation:'locally_available', nextActions:[{action:'update',label:'Update capability'},{action:'available',label:'Make available'},{action:'inspect',label:'Inspect portfolio'}] };
      if (context.action === 'pause' || context.action === 'offline') { await endPulseSession(context.phone); const capability=await setCapabilityState(context.phone,skill,{availability:'offline',kind}); return {status:'completed',message:`${skill.replace(/_/g,' ')} is offline. Other capabilities are unchanged.`,canonicalFacts:{capability},evidenceLevel:'canonical_service',externalActivation:'locally_available',nextActions:[{action:'available',label:'Make available'},{action:'live',label:'Go live'},{action:'inspect',label:'Inspect portfolio'}]}; }
      if (context.action === 'available' || context.action === 'update') { const capability=await setCapabilityState(context.phone,skill,{availability:context.action==='available'?'available':undefined,kind,metadata:typeof context.arguments.metadata==='object'&&context.arguments.metadata?context.arguments.metadata as Record<string,unknown>:undefined}); return {status:'completed',message:`${skill.replace(/_/g,' ')} is updated on your capability portfolio. Verification and Pulse activation remain separate controls.`,canonicalFacts:{capability},evidenceLevel:'canonical_service',externalActivation:'locally_available',nextActions:[{action:'live',label:'Go live'},{action:'pause',label:'Pause'},{action:'inspect',label:'Inspect portfolio'}]}; }
      if (context.action === 'live') { const lat=Number(context.arguments.lat), lng=Number(context.arguments.lng); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return {status:'needs_user',message:'I need your explicit current latitude and longitude before starting Nearby Pulse for this capability.',nextActions:[{action:'clarify',label:'Provide location'},{action:'cancel',label:'Cancel'}]}; const pulse=await activatePulse(context.phone,skill,lat,lng); if(!pulse.success) return {status:'external_unavailable',message:pulse.message,externalActivation:'unavailable_external_dependency',nextActions:[{action:'inspect',label:'Inspect capability'},{action:'retry',label:'Retry'}]}; const capability=await setCapabilityState(context.phone,skill,{availability:'live',status:'active',kind}); return {status:'completed',message:`${skill.replace(/_/g,' ')} is live on Nearby Pulse.`,canonicalFacts:{capability,pulse},evidenceLevel:'canonical_service',externalActivation:'locally_available',nextActions:[{action:'offline',label:'Go offline'},{action:'inspect',label:'Inspect capability'}]}; }
      return null;
    },
  });
}

ensureCapabilityPortfolioRegistration();

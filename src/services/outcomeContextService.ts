import { getDb } from '../database.js';
import { getEconomicRequest } from './skillFlows.js';
import { getAgentNetworkSummary } from './agentNetworkCommerce.js';
import { getPointsBalance } from './pointsEngine.js';
import { listPlatformJourneyEvents, reconcileEconomicJourney } from './platformJourneyWeaver.js';

export type OutcomeState = 'draft'|'needs_input'|'requested'|'awaiting_confirmation'|'awaiting_match'|'matched'|'quoted'|'payment_pending'|'paid'|'reserved'|'in_fulfillment'|'accepted'|'arrived'|'in_progress'|'waiting'|'fulfilled'|'completed'|'cancelled'|'failed'|'disputed'|'unknown';
const STATE: Record<string, OutcomeState> = { pending:'requested',requested:'requested',awaiting_input:'needs_input',needs_details:'needs_input',awaiting_confirmation:'awaiting_confirmation',awaiting_match:'awaiting_match',matching:'awaiting_match',matched:'matched',quoting:'quoted',quoted:'quoted',payment_pending:'payment_pending',awaiting_payment:'payment_pending',paid:'paid',reserved:'reserved',in_fulfillment:'in_fulfillment',fulfilling:'in_fulfillment',accepted:'accepted',arrived:'arrived',in_progress:'in_progress',waiting:'waiting',fulfilled:'fulfilled',completed:'completed',cancelled:'cancelled',canceled:'cancelled',failed:'failed',disputed:'disputed' };

export interface OutcomeContext {
  contextId:string; ownerPhone:string; requestId:string; title:string; state:OutcomeState; skill?:string; providerPhone?:string; communicationSessionId?:string;
  actions:Array<{id:string;label:string;method:string;href?:string;requiresConfirmation?:boolean}>;
  facts:Record<string,unknown>; timeline:Array<{eventType:string;occurredAt:string;objectId?:string;points?:number;metadata?:Record<string,unknown>}>;
  points:{enabled:boolean;balance:number}; agentNetwork:{activePosAgents:number;totalAgents:number;pendingAgents:number}; generatedAt:string;
}

function actionList(state:OutcomeState, requestId:string, communicationSessionId?:string):OutcomeContext['actions'] {
  const actions:OutcomeContext['actions']=[];
  if(['draft','needs_input','requested'].includes(state)) actions.push({id:'continue',label:'Continue',method:'chat'});
  if(state==='awaiting_confirmation') actions.push({id:'confirm',label:'Review and confirm',method:'open',href:`/confirmations?request=${encodeURIComponent(requestId)}`,requiresConfirmation:true});
  if(state==='awaiting_match') actions.push({id:'refresh',label:'Find providers',method:'get'});
  if(['quoted','payment_pending'].includes(state)) actions.push({id:'pay',label:'Continue to payment',method:'open',href:`/payment?request=${encodeURIComponent(requestId)}`,requiresConfirmation:true});
  if(['matched','accepted','arrived','in_progress','in_fulfillment'].includes(state)&&communicationSessionId) actions.push({id:'communicate',label:'Contact provider',method:'open',href:`/call?session=${encodeURIComponent(communicationSessionId)}`});
  if(['completed','fulfilled'].includes(state)) actions.push({id:'review',label:'Leave a review',method:'open',href:`/requests?request=${encodeURIComponent(requestId)}&review=1`});
  if(state==='disputed') actions.push({id:'support',label:'Get support',method:'open',href:'/help'});
  if(!['completed','fulfilled','cancelled','failed','disputed'].includes(state)) actions.push({id:'details',label:'Open details',method:'open'});
  return actions;
}

export async function getOutcomeContext(input:{ownerPhone:string;requestId:string}):Promise<OutcomeContext|null>{
  const ownerPhone=String(input.ownerPhone||'').trim(); const requestId=String(input.requestId||'').trim();
  if(!ownerPhone||ownerPhone.startsWith('anon_')||!requestId)return null;
  const request=await getEconomicRequest(requestId); if(!request||request.phone!==ownerPhone)return null;
  await reconcileEconomicJourney(requestId);
  const db=await getDb();
  const comm=db.exec('SELECT id,provider_phone FROM provider_communication_sessions WHERE economic_request_id=? ORDER BY updated_at DESC LIMIT 1',[requestId]);
  const commRow=comm[0]?.values?.[0]; const communicationSessionId=commRow?.[0]?String(commRow[0]):undefined; const providerPhone=commRow?.[1]?String(commRow[1]):(request.providerPhone?String(request.providerPhone):undefined);
  const timeline=await listPlatformJourneyEvents({economicRequestId:requestId,phone:ownerPhone,limit:50});
  const state=STATE[String(request.status||'').toLowerCase()]||'unknown';
  return {
    contextId:`economic:${requestId}`,ownerPhone,requestId,title:request.skill?request.skill.replace(/[_-]+/g,' '):'Kurukoo request',state,skill:request.skill,providerPhone,communicationSessionId,
    actions:actionList(state,requestId,communicationSessionId),
    facts:{category:request.category,requirements:request.requirements,quote:request.quote||null,fulfillment:request.fulfillment||null,status:request.status},
    timeline:timeline.map(e=>({eventType:e.eventType,occurredAt:e.occurredAt,objectId:e.objectId,points:e.points,metadata:e.metadata})),
    points:{enabled:true,balance:await getPointsBalance(ownerPhone)},agentNetwork:await getAgentNetworkSummary(),generatedAt:new Date().toISOString()
  };
}

import type { EconomicParticipantRole } from './economicParticipants.js';

export const EXECUTION_STATUSES = ['pending','dispatched','acknowledged','in_progress','succeeded','failed','cancelled','expired'] as const;
export type ExecutionStatus = typeof EXECUTION_STATUSES[number];
export const EVIDENCE_SOURCES = ['provider_reported','connector_reported','kurukoo_recorded','unverified_participant'] as const;
export type EvidenceSource = typeof EVIDENCE_SOURCES[number];
export const EVIDENCE_VERIFICATION_STATES = ['unverified','pending_review','verified','rejected'] as const;
export type EvidenceVerificationState = typeof EVIDENCE_VERIFICATION_STATES[number];
export interface ExecutionEvidence { id:string; source:EvidenceSource; type:string; scope:string; submittedBy:string; verificationState:EvidenceVerificationState; payload:Record<string,unknown>; recordedAt:string; }
export interface ExecutionRequestRecord { id:string; requestId:string; actionId:string; providerPhone:string; role:EconomicParticipantRole; capability:string; actionRequested:string; idempotencyKey:string; correlationId:string; connectorId:string; authorizationContext:Record<string,unknown>; status:ExecutionStatus; externalReference:string|null; failureReason:string|null; evidence:ExecutionEvidence[]; requestedAt:string; updatedAt:string; }
export interface ConnectorAdapter { connectorId:string; name:string; dispatch(execution:ExecutionRequestRecord):Promise<{externalReference?:string;status:Extract<ExecutionStatus,'acknowledged'|'failed'>;failureReason?:string;evidence?:Omit<ExecutionEvidence,'id'|'recordedAt'> & {id?:string}}>; }
export class ExecutionAuthorizationError extends Error { constructor(message:string){super(message);this.name='ExecutionAuthorizationError';} }
export class ExecutionConflictError extends Error { constructor(message:string){super(message);this.name='ExecutionConflictError';} }
const connectors=new Map<string,ConnectorAdapter>();
class DummyTestConnector implements ConnectorAdapter { connectorId='kurukoo_dummy_test_v1'; name='Kurukoo Standard Test Connector'; async dispatch(execution:ExecutionRequestRecord){return{externalReference:`DUMMY-${execution.id.toUpperCase()}`,status:'acknowledged' as const,evidence:{source:'connector_reported' as const,type:'dispatch_acknowledgement',scope:execution.role,submittedBy:this.connectorId,verificationState:'pending_review' as const,payload:{connector:this.connectorId,action:execution.actionRequested}}};} }
export const dummyTestConnector=new DummyTestConnector();
connectors.set(dummyTestConnector.connectorId,dummyTestConnector);
export function registerConnector(adapter:ConnectorAdapter):void{const id=String(adapter.connectorId||'').trim();if(!id)throw new Error('Connector id is required');connectors.set(id,adapter);}
export function getConnector(connectorId:string):ConnectorAdapter|null{return connectors.get(String(connectorId||''))||null;}

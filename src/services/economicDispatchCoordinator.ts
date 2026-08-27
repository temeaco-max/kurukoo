import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { find_worker, type ProviderMatch } from './find-worker.js';
import { completeEconomicRequest, } from './tradeEngine.js';
import { getEconomicRequest, updateEconomicRequestStatus } from './skillFlows.js';
import { addEconomicParticipant, getEconomicParticipants, updateEconomicParticipant, type EconomicParticipant } from './economicParticipants.js';
import { chargeProviderLead } from './agentNetworkCommerce.js';
import { sendFcmPush } from './pushNotifications.js';
import { createProviderCommunicationSession, updateProviderCommunicationState } from './providerCommunicationService.js';
import { getFulfilmentForEconomicRequest, syncCanonicalFulfilmentForEconomicRequest, transitionFulfilment } from './canonicalFulfilmentService.js';

export type DispatchLeadStatus = 'offered' | 'accepting' | 'accepted' | 'arrived' | 'completion_reported' | 'completed' | 'declined' | 'expired' | 'cancelled';

export interface DispatchLead {
  id: string;
  requestId: string;
  providerPhone: string;
  skill: string;
  status: DispatchLeadStatus;
  leadPoints: number;
  communicationSessionId?: string;
  completionEvidence?: Record<string, unknown>;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  completionReportedAt?: string;
  completedAt?: string;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function leadFromObject(row: Record<string, unknown>): DispatchLead {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    providerPhone: String(row.provider_phone),
    skill: String(row.skill),
    status: String(row.status) as DispatchLeadStatus,
    leadPoints: Number(row.lead_points || 0),
    communicationSessionId: row.communication_session_id ? String(row.communication_session_id) : undefined,
    completionEvidence: parseObject(row.completion_evidence_json),
    createdAt: String(row.created_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    arrivedAt: row.arrived_at ? String(row.arrived_at) : undefined,
    completionReportedAt: row.completion_reported_at ? String(row.completion_reported_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

async function ensureSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS economic_dispatch_leads (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    provider_phone TEXT NOT NULL,
    skill TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offered',
    lead_points INTEGER NOT NULL DEFAULT 0,
    communication_session_id TEXT,
    completion_evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    arrived_at TEXT,
    completion_reported_at TEXT,
    completed_at TEXT
  )`);
  for (const sql of [
    "ALTER TABLE economic_dispatch_leads ADD COLUMN completion_evidence_json TEXT NOT NULL DEFAULT '{}'",
    'ALTER TABLE economic_dispatch_leads ADD COLUMN completion_reported_at TEXT',
  ]) {
    try { db.run(sql); } catch { /* Existing installations already have the column. */ }
  }
  db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_lead_request_status ON economic_dispatch_leads(request_id,status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_lead_provider_active ON economic_dispatch_leads(provider_phone,status)`);
  saveDb();
}

async function getLead(leadId: string): Promise<DispatchLead> {
  await ensureSchema();
  const db = await getDb();
  const rows = db.exec('SELECT * FROM economic_dispatch_leads WHERE id=? LIMIT 1', [String(leadId)]);
  if (!rows[0]?.values?.length) throw new Error('Dispatch lead not found.');
  const values = rows[0].values[0];
  return leadFromObject(Object.fromEntries(rows[0].columns.map((column: string, index: number) => [column, values[index]])));
}

function mapSkillCandidates(skill: string, vehicleType?: string): string[] {
  const requested = String(skill || '').trim().toLowerCase();
  if (requested !== 'ride_request' && requested !== 'transport_dispatch') return [requested];
  const type = String(vehicleType || '').trim().toLowerCase();
  if (['bike', 'motorbike', 'okada', 'motorcycle'].includes(type)) return ['okada_rider', 'rider'];
  if (['keke', 'tricycle'].includes(type)) return ['keke_driver'];
  if (['taxi', 'car', 'cab'].includes(type)) return ['taxi_quick', 'informal_taxi', 'shuttle_driver'];
  return ['okada_rider', 'keke_driver', 'taxi_quick', 'informal_taxi', 'shuttle_driver'];
}

async function activeProviderPhones(requestId: string): Promise<Set<string>> {
  const participants = await getEconomicParticipants(requestId);
  return new Set(participants
    .filter((participant: EconomicParticipant) => ['delivery_provider', 'service_provider'].includes(participant.role)
      && ['invited', 'offered', 'selected', 'handover_pending', 'handed_over', 'collected', 'in_progress', 'completion_reported', 'confirmed'].includes(participant.status))
    .map((participant) => participant.providerPhone));
}

async function candidateProviders(input: { skill: string; vehicleType?: string; location?: string; latitude?: number; longitude?: number; ownerPhone: string; max: number; requestId: string }): Promise<ProviderMatch[]> {
  const active = await activeProviderPhones(input.requestId);
  const merged = new Map<string, ProviderMatch>();
  for (const candidateSkill of mapSkillCandidates(input.skill, input.vehicleType)) {
    const result = await find_worker({ skill: candidateSkill, location: input.location, latitude: input.latitude, longitude: input.longitude, ownerPhone: input.ownerPhone, max: input.max });
    for (const provider of result.providers) if (!active.has(provider.phone)) merged.set(provider.phone, provider);
  }
  return Array.from(merged.values()).slice(0, input.max);
}

async function transitionLinkedFulfilment(request: { id: string; phone: string }, status: 'searching' | 'offers_ready' | 'in_fulfillment' | 'fulfilled' | 'completed'): Promise<void> {
  const fulfilment = await getFulfilmentForEconomicRequest(request.phone, request.id);
  if (!fulfilment || ['completed', 'cancelled', 'failed'].includes(fulfilment.status)) return;
  if (fulfilment.status !== status) await transitionFulfilment(request.phone, fulfilment.id, status);
}

function textEvidence(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, 240) : undefined;
}

/**
 * Preserve a provider's completion report as evidence, but do not let a
 * provider report itself close the customer's real-world outcome.
 */
function normalizeCompletionEvidence(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Completion evidence is required before a provider can report the dispatch finished.');
  }
  const supplied = value as Record<string, unknown>;
  const reference = textEvidence(supplied.completion_reference)
    || textEvidence(supplied.trip_reference)
    || textEvidence(supplied.external_reference)
    || textEvidence(supplied.provider_confirmation_reference);
  if (!reference) {
    throw new Error('Completion evidence must include a provider, trip, or external reference.');
  }
  const completedAtSource = textEvidence(supplied.completed_at) || textEvidence(supplied.completedAt);
  if (!completedAtSource || Number.isNaN(Date.parse(completedAtSource))) {
    throw new Error('Completion evidence must include a valid completed_at timestamp.');
  }
  return {
    ...supplied,
    completion_reference: reference,
    completed_at: new Date(completedAtSource).toISOString(),
    evidence_type: 'provider_completion_report',
    provider_reported_at: new Date().toISOString(),
    verification_state: 'provider_reported_pending_owner_confirmation',
  };
}

export async function broadcastDispatch(input: { requestId: string; ownerPhone: string; skill: string; vehicleType?: string; location?: string; latitude?: number; longitude?: number; maxProviders?: number }): Promise<{ requestId: string; offers: DispatchLead[]; providers: ProviderMatch[] }> {
  await ensureSchema();
  const request = await getEconomicRequest(input.requestId);
  if (!request) throw new Error('Economic request not found');
  if (request.phone !== input.ownerPhone) throw new Error('Economic request ownership is required');
  await syncCanonicalFulfilmentForEconomicRequest({
    ownerPhone: request.phone,
    economicRequestId: request.id,
    skill: request.skill,
    requirements: request.requirements,
  });
  if (['matched', 'quoting', 'quoted', 'awaiting_confirmation', 'reserved', 'payment_pending', 'paid', 'in_fulfillment', 'fulfilled', 'completed', 'cancelled', 'disputed'].includes(String(request.status))) {
    throw new Error('This request is no longer eligible for dispatch broadcast.');
  }
  const candidates = await candidateProviders({
    skill: input.skill,
    vehicleType: input.vehicleType,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    ownerPhone: input.ownerPhone,
    max: Math.min(Math.max(input.maxProviders || 8, 1), 15),
    requestId: input.requestId,
  });
  const db = await getDb();
  const existingRows = db.exec("SELECT provider_phone FROM economic_dispatch_leads WHERE request_id=? AND status IN ('offered','accepting','accepted','arrived','completion_reported')", [input.requestId]);
  const existingProviders = new Set(existingRows[0]?.values?.map((row: unknown[]) => String(row[0])) || []);
  const offers: DispatchLead[] = [];
  for (const provider of candidates) {
    if (existingProviders.has(provider.phone)) continue;
    const id = `dlg_${crypto.randomUUID()}`;
    db.run('INSERT INTO economic_dispatch_leads (id,request_id,provider_phone,skill,status,lead_points) VALUES (?,?,?,?,?,0)', [id, input.requestId, provider.phone, provider.skill, 'offered']);
    offers.push({ id, requestId: input.requestId, providerPhone: provider.phone, skill: provider.skill, status: 'offered', leadPoints: 0, createdAt: new Date().toISOString() });
    await sendFcmPush(provider.phone, 'New Kurukoo opportunity', `A ${provider.skill.replace(/_/g, ' ')} request is available nearby. Tap to review and accept.`, `/app/requests?request=${encodeURIComponent(input.requestId)}&lead=${encodeURIComponent(id)}`, {
      conversationId: String(request.id),
      availableAction: 'accept_dispatch_lead',
      canonicalAction: 'economic.dispatch.accept',
      objectType: 'dispatch_lead',
      objectId: id,
      ownerScope: provider.phone,
      idempotencyKey: `dispatch-offer:${id}`,
      surface: 'requests',
    }).catch(() => false);
  }
  await updateEconomicRequestStatus(input.requestId, 'awaiting_match');
  await transitionLinkedFulfilment(request, 'searching');
  saveDb();
  return { requestId: input.requestId, offers, providers: candidates };
}

export async function acceptDispatchLead(input: { leadId: string; providerPhone: string }): Promise<DispatchLead> {
  const lead = await getLead(input.leadId);
  if (lead.providerPhone !== input.providerPhone) throw new Error('Only the offered provider can accept this lead.');
  if (lead.status === 'accepted') return lead;
  if (lead.status !== 'offered') throw new Error('This dispatch lead is no longer available.');

  const db = await getDb();
  db.run("UPDATE economic_dispatch_leads SET status='accepting' WHERE id=? AND provider_phone=? AND status='offered'", [input.leadId, input.providerPhone]);
  if (db.getRowsModified() !== 1) throw new Error('Another provider accepted this dispatch first.');
  const request = await getEconomicRequest(lead.requestId);
  if (!request) throw new Error('Economic request not found.');

  const leadCharge = await chargeProviderLead({ providerPhone: input.providerPhone, category: String(request.category || ''), skill: String(request.skill || ''), requestId: String(request.id) });
  if (!leadCharge.success) {
    db.run("UPDATE economic_dispatch_leads SET status='declined' WHERE id=?", [input.leadId]);
    saveDb();
    throw new Error('Provider lead requires the configured Points balance before acceptance.');
  }

  const communication = await createProviderCommunicationSession({ customerPhone: String(request.phone), providerPhone: input.providerPhone, economicRequestId: String(request.id), mode: 'webrtc_tracking' });
  db.run('UPDATE skills SET is_available=0 WHERE phone=? AND skill=?', [input.providerPhone, lead.skill]);
  await addEconomicParticipant({
    requestId: String(request.id),
    ownerPhone: String(request.phone),
    role: 'service_provider',
    providerPhone: input.providerPhone,
    capability: String(request.skill),
    status: 'selected',
    evidence: {
      dispatch_lead_id: input.leadId,
      matched_skill: lead.skill,
      lead_points: leadCharge.chargedPoints,
      selection: 'provider_accepted_dispatch_lead',
      verification_state: 'verified_provider_selected',
    },
  });
  db.run("UPDATE economic_dispatch_leads SET status='accepted',lead_points=?,communication_session_id=?,accepted_at=CURRENT_TIMESTAMP WHERE id=?", [leadCharge.chargedPoints, communication.id, input.leadId]);
  await updateEconomicRequestStatus(String(request.id), 'matched', { providerId: input.providerPhone });
  await transitionLinkedFulfilment(request, 'offers_ready');
  await sendFcmPush(input.providerPhone, 'Dispatch accepted', 'You accepted the Kurukoo request. Open the provider session to communicate and record truthful progress.', `/app/call?session=${encodeURIComponent(communication.id)}&lead=${encodeURIComponent(input.leadId)}`, {
    conversationId: String(request.id),
    availableAction: 'open_provider_session',
    canonicalAction: 'provider.communication.open',
    objectType: 'communication_session',
    objectId: communication.id,
    ownerScope: input.providerPhone,
    idempotencyKey: `dispatch-provider-session:${input.leadId}`,
    surface: 'call',
  }).catch(() => false);
  await sendFcmPush(String(request.phone), 'Provider accepted', 'A verified provider accepted your request. This records provider interest; route, timing, price, and completion still require the relevant confirmation and evidence.', `/app/requests?request=${encodeURIComponent(String(request.id))}&lead=${encodeURIComponent(input.leadId)}`, {
    conversationId: String(request.id),
    availableAction: 'open_provider_session',
    canonicalAction: 'provider.communication.open',
    objectType: 'communication_session',
    objectId: communication.id,
    ownerScope: String(request.phone),
    idempotencyKey: `dispatch-accepted:${input.leadId}`,
    surface: 'requests',
  }).catch(() => false);
  saveDb();
  return getLead(input.leadId);
}

export async function markDispatchArrived(input: { leadId: string; providerPhone: string }): Promise<DispatchLead> {
  const lead = await getLead(input.leadId);
  if (lead.providerPhone !== input.providerPhone) throw new Error('Only the accepted provider can mark arrival.');
  if (lead.status === 'arrived') return lead;
  if (lead.status !== 'accepted') throw new Error('Arrival is only valid after acceptance.');

  const db = await getDb();
  db.run("UPDATE economic_dispatch_leads SET status='arrived',arrived_at=CURRENT_TIMESTAMP WHERE id=?", [input.leadId]);
  if (lead.communicationSessionId) await updateProviderCommunicationState(lead.communicationSessionId, 'arrived');
  let request = await getEconomicRequest(lead.requestId);
  if (!request) throw new Error('Economic request not found.');
  if (request.status === 'matched') request = await updateEconomicRequestStatus(String(request.id), 'in_fulfillment', { providerId: input.providerPhone });
  await updateEconomicParticipant({
    requestId: String(request.id),
    actorPhone: input.providerPhone,
    role: 'service_provider',
    providerPhone: input.providerPhone,
    status: 'in_progress',
    evidence: {
      arrival_reported_at: new Date().toISOString(),
      dispatch_lead_id: lead.id,
      verification_state: 'provider_reported',
    },
  });
  await transitionLinkedFulfilment(request, 'in_fulfillment');
  saveDb();
  return getLead(input.leadId);
}

/**
 * Record a provider completion report. This intentionally stops at
 * `completion_reported`; it does not close the economic request or award the
 * provider until the owner confirms the reported real-world outcome.
 */
export async function completeDispatch(input: { leadId: string; providerPhone: string; evidence?: Record<string, unknown> }): Promise<DispatchLead> {
  const lead = await getLead(input.leadId);
  if (lead.providerPhone !== input.providerPhone) throw new Error('Only the accepted provider can report dispatch completion.');
  if (lead.status === 'completion_reported' || lead.status === 'completed') return lead;
  if (lead.status !== 'arrived') throw new Error('Dispatch completion can be reported only after provider arrival.');
  const completionEvidence = normalizeCompletionEvidence(input.evidence);

  let request = await getEconomicRequest(lead.requestId);
  if (!request) throw new Error('Economic request not found.');
  if (['matched', 'paid'].includes(request.status)) request = await updateEconomicRequestStatus(String(request.id), 'in_fulfillment', { providerId: input.providerPhone });
  if (request.status === 'in_fulfillment') {
    request = await updateEconomicRequestStatus(String(request.id), 'fulfilled', {
      providerId: input.providerPhone,
      fulfillment: {
        ...(request.fulfillment || {}),
        provider_completion_report: completionEvidence,
        provider_completion_reported_at: new Date().toISOString(),
        completion_verification_state: 'pending_owner_confirmation',
      },
    });
  }
  if (request.status !== 'fulfilled') throw new Error(`Dispatch completion report is not valid from Economic Request status ${request.status}`);

  const db = await getDb();
  db.run("UPDATE economic_dispatch_leads SET status='completion_reported',completion_evidence_json=?,completion_reported_at=CURRENT_TIMESTAMP WHERE id=? AND status='arrived'", [JSON.stringify(completionEvidence), input.leadId]);
  if (db.getRowsModified() !== 1) return getLead(input.leadId);
  await updateEconomicParticipant({
    requestId: String(request.id),
    actorPhone: input.providerPhone,
    role: 'service_provider',
    providerPhone: input.providerPhone,
    status: 'completion_reported',
    evidence: {
      dispatch_lead_id: lead.id,
      provider_completion_report: completionEvidence,
      completion_verification_state: 'pending_owner_confirmation',
    },
  });
  await transitionLinkedFulfilment(request, 'fulfilled');
  if (lead.communicationSessionId) await updateProviderCommunicationState(lead.communicationSessionId, 'completion_reported');
  await sendFcmPush(String(request.phone), 'Provider reported the trip complete', 'Your provider reported completion with a reference. Review and confirm only if the outcome actually occurred; Kurukoo has not marked the request done yet.', `/app/requests?request=${encodeURIComponent(String(request.id))}&lead=${encodeURIComponent(input.leadId)}`, {
    conversationId: String(request.id),
    availableAction: 'confirm_dispatch_completion',
    canonicalAction: 'economic.dispatch.confirm_completion',
    objectType: 'dispatch_lead',
    objectId: input.leadId,
    ownerScope: String(request.phone),
    idempotencyKey: `dispatch-completion-reported:${input.leadId}`,
    surface: 'requests',
  }).catch(() => false);
  saveDb();
  return getLead(input.leadId);
}

/** Confirm a provider report from the request owner's authenticated scope. */
export async function confirmDispatchCompletion(input: { leadId: string; ownerPhone: string }): Promise<DispatchLead> {
  const lead = await getLead(input.leadId);
  const request = await getEconomicRequest(lead.requestId);
  if (!request) throw new Error('Economic request not found.');
  if (request.phone !== input.ownerPhone) throw new Error('Economic request ownership is required to confirm completion.');
  if (lead.status === 'completed') return lead;
  if (lead.status !== 'completion_reported') throw new Error('A provider completion report is required before the owner can confirm this outcome.');

  const completed = await completeEconomicRequest(lead.requestId, {
    ...(request.fulfillment || {}),
    completion_confirmed_by: input.ownerPhone,
    completion_confirmed_at: new Date().toISOString(),
    completion_verification_state: 'owner_confirmed',
  });
  if (!completed.success) throw new Error(completed.message);
  const finalized = await getEconomicRequest(lead.requestId);
  if (!finalized || finalized.status !== 'completed') throw new Error('Economic Request did not reach verified completion.');

  const db = await getDb();
  db.run('UPDATE skills SET jobs_completed=COALESCE(jobs_completed,0)+1,is_available=1 WHERE phone=? AND skill=?', [lead.providerPhone, lead.skill]);
  db.run("UPDATE economic_dispatch_leads SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='completion_reported'", [input.leadId]);
  if (db.getRowsModified() !== 1) return getLead(input.leadId);
  await updateEconomicParticipant({
    requestId: String(finalized.id),
    actorPhone: input.ownerPhone,
    role: 'service_provider',
    providerPhone: lead.providerPhone,
    status: 'confirmed',
    evidence: {
      completion_confirmed_by: input.ownerPhone,
      completion_confirmed_at: new Date().toISOString(),
      completion_verification_state: 'owner_confirmed',
    },
  });
  await transitionLinkedFulfilment(finalized, 'completed');
  if (lead.communicationSessionId) await updateProviderCommunicationState(lead.communicationSessionId, 'completed').catch(() => undefined);
  await sendFcmPush(String(finalized.phone), 'Request completed', 'You confirmed the provider-reported outcome. The request is now recorded as completed and feedback is available.', `/app/requests?request=${encodeURIComponent(String(finalized.id))}&review=1`, {
    conversationId: String(finalized.id),
    availableAction: 'leave_review',
    canonicalAction: 'review.create',
    objectType: 'economic_request',
    objectId: String(finalized.id),
    ownerScope: String(finalized.phone),
    idempotencyKey: `dispatch-completed:${input.leadId}`,
    surface: 'requests',
  }).catch(() => false);
  saveDb();
  return getLead(input.leadId);
}

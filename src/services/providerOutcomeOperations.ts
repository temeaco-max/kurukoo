import { getDb } from '../database.js';

export type OutcomeAttention = 'supply' | 'provider_response' | 'payment' | 'evidence' | 'review' | 'none';

export interface OutcomeOperationItem {
  requestId: string;
  skill: string;
  category: string;
  status: string;
  ownerPhone: string;
  providerPhone: string | null;
  updatedAt: string | null;
  attention: OutcomeAttention;
  evidenceState: 'not_started' | 'provider_reported' | 'confirmed' | 'failed_or_disputed' | 'unknown';
  source: 'economic_request';
}

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function toIso(value: unknown): string | null {
  const result = String(value || '').trim();
  return result || null;
}

function evidenceState(status: string, fulfillment: Record<string, unknown>): OutcomeOperationItem['evidenceState'] {
  if (['failed', 'cancelled', 'disputed'].includes(status) || fulfillment.airtime_status === 'delivery_failed') return 'failed_or_disputed';
  if (['completed', 'fulfilled'].includes(status) || fulfillment.airtime_status === 'delivery_confirmed' || fulfillment.customer_confirmed === true) return 'confirmed';
  if (fulfillment.airtime_status === 'accepted_awaiting_delivery_evidence' || fulfillment.dispatch_completion_reported === true || fulfillment.delivery_reported === true) return 'provider_reported';
  if (['requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'quoted', 'awaiting_confirmation', 'reserved', 'payment_pending'].includes(status)) return 'not_started';
  return 'unknown';
}

function attentionFor(status: string, fulfillment: Record<string, unknown>, participantSummary: { selected: number; active: number }): OutcomeAttention {
  if (['requested', 'awaiting_match', 'partially_matched'].includes(status)) return 'supply';
  if (['matched', 'quoting'].includes(status) && participantSummary.selected > 0) return 'provider_response';
  if (['awaiting_confirmation', 'reserved', 'payment_pending'].includes(status)) return 'payment';
  if (['paid', 'in_fulfillment'].includes(status)) return 'evidence';
  if (fulfillment.airtime_status === 'delivery_failed' || status === 'disputed') return 'review';
  return 'none';
}

function boundedLimit(value: unknown): number {
  const parsed = Number(value || 80);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.floor(parsed), 250)) : 80;
}

/**
 * Read-only operational projection of the existing Economic Request, participant,
 * and fulfillment state. It creates no provider directory, workflow, or outcome
 * state and is intentionally safe for first-city/provider-cohort operations.
 */
export async function getProviderOutcomeOperations(input: { limit?: number; category?: string } = {}) {
  const db = await getDb();
  const limit = boundedLimit(input.limit);
  const category = String(input.category || '').trim().toLowerCase();
  const statement = category
    ? db.prepare(`SELECT id,phone,skill,category,status,provider_phone,fulfillment_json,updated_at FROM economic_requests WHERE lower(category)=? ORDER BY updated_at DESC LIMIT ?`)
    : db.prepare(`SELECT id,phone,skill,category,status,provider_phone,fulfillment_json,updated_at FROM economic_requests ORDER BY updated_at DESC LIMIT ?`);
  if (category) statement.bind([category, limit]); else statement.bind([limit]);
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as Record<string, unknown>);
  statement.free();

  const participantsByRequest = new Map<string, { selected: number; active: number }>();
  if (rows.length) {
    const ids = rows.map(row => String(row.id));
    const participantStatement = db.prepare(`SELECT request_id,status FROM economic_participants WHERE request_id IN (${ids.map(() => '?').join(',')})`);
    participantStatement.bind(ids);
    while (participantStatement.step()) {
      const row = participantStatement.getAsObject() as Record<string, unknown>;
      const requestId = String(row.request_id || '');
      const current = participantsByRequest.get(requestId) || { selected: 0, active: 0 };
      const participantStatus = String(row.status || '');
      if (['selected', 'confirmed'].includes(participantStatus)) current.selected += 1;
      if (['selected', 'confirmed', 'handover_pending', 'handed_over', 'collected', 'in_progress'].includes(participantStatus)) current.active += 1;
      participantsByRequest.set(requestId, current);
    }
    participantStatement.free();
  }

  const items: OutcomeOperationItem[] = rows.map(row => {
    const requestId = String(row.id || '');
    const status = String(row.status || 'requested');
    const fulfillment = parseObject(row.fulfillment_json);
    const participantSummary = participantsByRequest.get(requestId) || { selected: 0, active: 0 };
    return {
      requestId,
      skill: String(row.skill || ''),
      category: String(row.category || ''),
      status,
      ownerPhone: String(row.phone || ''),
      providerPhone: row.provider_phone ? String(row.provider_phone) : null,
      updatedAt: toIso(row.updated_at),
      attention: attentionFor(status, fulfillment, participantSummary),
      evidenceState: evidenceState(status, fulfillment),
      source: 'economic_request',
    };
  });
  const queue = (attention: OutcomeAttention) => items.filter(item => item.attention === attention);
  const categories = [...new Set(items.map(item => item.category))].sort().map(name => ({ category: name, total: items.filter(item => item.category === name).length, active: items.filter(item => item.category === name && ['paid', 'in_fulfillment'].includes(item.status)).length, confirmed: items.filter(item => item.category === name && item.evidenceState === 'confirmed').length }));
  const providers = new Map<string, { providerPhone: string; assigned: number; active: number; attention: number; confirmed: number }>();
  for (const item of items) {
    if (!item.providerPhone) continue;
    const current = providers.get(item.providerPhone) || { providerPhone: item.providerPhone, assigned: 0, active: 0, attention: 0, confirmed: 0 };
    current.assigned += 1;
    if (['paid', 'in_fulfillment'].includes(item.status)) current.active += 1;
    if (item.attention !== 'none') current.attention += 1;
    if (item.evidenceState === 'confirmed') current.confirmed += 1;
    providers.set(item.providerPhone, current);
  }
  return {
    source: 'canonical_economic_requests',
    generatedAt: new Date().toISOString(),
    filter: { category: category || null, limit },
    totals: { requests: items.length, supply: queue('supply').length, providerResponse: queue('provider_response').length, payment: queue('payment').length, evidence: queue('evidence').length, review: queue('review').length, confirmed: items.filter(item => item.evidenceState === 'confirmed').length },
    queues: { supply: queue('supply'), providerResponse: queue('provider_response'), payment: queue('payment'), evidence: queue('evidence'), review: queue('review') },
    categories,
    providers: [...providers.values()].sort((a, b) => b.attention - a.attention || b.active - a.active || a.providerPhone.localeCompare(b.providerPhone)),
    items,
  };
}

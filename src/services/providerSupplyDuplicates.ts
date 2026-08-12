import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

function normalized(value: unknown): string { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function domain(value: unknown): string { try { return value ? new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '') : ''; } catch { return ''; } }
function phone(value: unknown): string { return String(value || '').replace(/\D/g, '').slice(-10); }

export interface DuplicateCandidate { id: string; entityId: string; candidateEntityId: string; matchingSignals: string[]; confidence: number; operatorDecision: string; }

export async function detectSupplyDuplicates(entityId: string): Promise<DuplicateCandidate[]> {
  const db = await getDb();
  const targetStmt = db.prepare('SELECT * FROM provider_supply_entities WHERE id=? LIMIT 1'); targetStmt.bind([entityId]); const target = targetStmt.step() ? targetStmt.getAsObject() as any : null; targetStmt.free(); if (!target) throw new Error('Supply entity not found');
  const all = db.exec('SELECT * FROM provider_supply_entities WHERE id<>? AND status<>?',[entityId,'removed'])[0]?.values || [];
  const columns = (db.exec('PRAGMA table_info(provider_supply_entities)')[0]?.values || []).map((row: any[]) => String(row[1]));
  const output: DuplicateCandidate[] = [];
  for (const values of all) {
    const candidate = Object.fromEntries(columns.map((column: string, index: number) => [column, values[index]]));
    const signals: string[] = []; let confidence = 0;
    if (normalized(target.business_name) && normalized(target.business_name) === normalized(candidate.business_name)) { signals.push('business_name_exact'); confidence += 0.4; }
    if (domain(target.website) && domain(target.website) === domain(candidate.website)) { signals.push('website_domain_exact'); confidence += 0.3; }
    if (phone(target.public_phone) && phone(target.public_phone) === phone(candidate.public_phone)) { signals.push('public_phone_exact'); confidence += 0.25; }
    if (normalized(target.address) && normalized(target.address) === normalized(candidate.address)) { signals.push('address_exact'); confidence += 0.15; }
    if (normalized(target.normalized_state) && normalized(target.normalized_state) === normalized(candidate.normalized_state)) confidence += 0.03;
    if (normalized(target.normalized_lga) && normalized(target.normalized_lga) === normalized(candidate.normalized_lga)) confidence += 0.03;
    confidence = Math.min(1, Number(confidence.toFixed(2)));
    if (signals.length && confidence >= 0.4) {
      const id = crypto.createHash('sha256').update(`${entityId}:${String(candidate.id)}`).digest('hex').slice(0, 32);
      db.run(`INSERT INTO provider_supply_duplicates(id,entity_id,candidate_entity_id,matching_signals_json,confidence) VALUES (?,?,?,?,?) ON CONFLICT(entity_id,candidate_entity_id) DO UPDATE SET matching_signals_json=excluded.matching_signals_json,confidence=excluded.confidence`, [id, entityId, String(candidate.id), JSON.stringify(signals), confidence]);
      output.push({ id, entityId, candidateEntityId: String(candidate.id), matchingSignals: signals, confidence, operatorDecision: 'pending' });
    }
  }
  if (output.length) db.run(`UPDATE provider_supply_entities SET duplicate_review_status='possible_duplicate',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [entityId]);
  saveDb(); return output;
}

export async function listSupplyDuplicates(decision?: string): Promise<DuplicateCandidate[]> {
  const db = await getDb(); const stmt = db.prepare(`SELECT * FROM provider_supply_duplicates ${decision ? 'WHERE operator_decision=?' : ''} ORDER BY created_at ASC`); if (decision) stmt.bind([decision]); const output: DuplicateCandidate[] = [];
  while (stmt.step()) { const row = stmt.getAsObject() as any; let signals: string[] = []; try { signals = JSON.parse(String(row.matching_signals_json || '[]')); } catch {} output.push({ id: String(row.id), entityId: String(row.entity_id), candidateEntityId: String(row.candidate_entity_id), matchingSignals: signals, confidence: Number(row.confidence), operatorDecision: String(row.operator_decision) }); }
  stmt.free(); return output;
}

export async function decideSupplyDuplicate(input: { duplicateId: string; decision: 'merge' | 'reject'; operatorId: string }): Promise<DuplicateCandidate> {
  if (!['merge', 'reject'].includes(input.decision)) throw new Error('Duplicate decision must be merge or reject');
  const db = await getDb(); const stmt = db.prepare('SELECT * FROM provider_supply_duplicates WHERE id=? LIMIT 1'); stmt.bind([input.duplicateId]); const row = stmt.step() ? stmt.getAsObject() as any : null; stmt.free(); if (!row) throw new Error('Duplicate candidate not found');
  db.run('UPDATE provider_supply_duplicates SET operator_decision=?,reviewed_by_hash=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?', [input.decision, crypto.createHash('sha256').update(`${process.env.KURUKOO_SUPPLY_REGISTRY_SALT || process.env.JWT_SECRET || 'supply'}:${input.operatorId}`).digest('hex').slice(0, 32), input.duplicateId]);
  if (input.decision === 'reject') db.run("UPDATE provider_supply_entities SET duplicate_review_status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?", [row.entity_id]);
  saveDb(); return { id: String(row.id), entityId: String(row.entity_id), candidateEntityId: String(row.candidate_entity_id), matchingSignals: JSON.parse(String(row.matching_signals_json || '[]')), confidence: Number(row.confidence), operatorDecision: input.decision };
}

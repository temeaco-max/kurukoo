import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

async function ensureReviewTable() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS unknown_intent_review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT UNIQUE NOT NULL,
    candidate_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    proposed_category TEXT,
    proposed_skill TEXT,
    reviewer_id TEXT,
    reviewer_note TEXT,
    accepted_training_example TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  )`);
  return db;
}

function normalizeCandidate(text: string): string {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 1000);
}

export async function recordUnknownIntentCandidate(query: string): Promise<void> {
  const normalized = normalizeCandidate(query);
  if (!normalized) return;
  const fingerprint = crypto.createHash('sha256').update(normalized).digest('hex');
  const db = await ensureReviewTable();
  db.run(`INSERT INTO unknown_intent_review_queue (fingerprint, candidate_text)
    VALUES (?, ?)
    ON CONFLICT(fingerprint) DO UPDATE SET candidate_text=excluded.candidate_text`, [fingerprint, normalized]);
  saveDb();
}

export async function listUnknownIntentReviewCandidates(status = 'pending', limit = 100): Promise<any[]> {
  const db = await ensureReviewTable();
  const safeStatus = String(status || 'pending').slice(0, 40);
  const safeLimit = Math.max(1, Math.min(250, Math.floor(Number(limit) || 100)));
  const stmt = db.prepare(`SELECT id,fingerprint,candidate_text,status,proposed_category,proposed_skill,reviewer_id,reviewer_note,accepted_training_example,created_at,reviewed_at FROM unknown_intent_review_queue WHERE status = ? ORDER BY id ASC LIMIT ?`);
  stmt.bind([safeStatus, safeLimit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export async function reviewUnknownIntentCandidate(id: number, reviewerId: string, decision: 'accepted' | 'rejected', proposedCategory?: string, proposedSkill?: string, trainingExample?: string, note?: string): Promise<boolean> {
  const db = await ensureReviewTable();
  const status = decision === 'accepted' ? 'accepted' : 'rejected';
  db.run(`UPDATE unknown_intent_review_queue SET status=?, proposed_category=?, proposed_skill=?, reviewer_id=?, reviewer_note=?, accepted_training_example=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`, [status, proposedCategory || null, proposedSkill || null, reviewerId || null, note || null, decision === 'accepted' ? trainingExample || null : null, id]);
  const changed = db.getRowsModified() > 0;
  if (changed) saveDb();
  return changed;
}

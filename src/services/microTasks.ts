import { getDb, saveDb } from '../database.js';
import { addCredits } from './pointsEngine.js';

export type MicroTaskStatus = 'available' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
export type MicroTaskDecision = 'approved' | 'rejected';

export interface TaskEvidence {
  summary: string;
  references?: string[];
  metadata?: Record<string, string | number | boolean>;
}

function parseEvidence(raw: unknown): TaskEvidence | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && typeof parsed.summary === 'string' ? parsed as TaskEvidence : null;
  } catch { return null; }
}

function normalizeEvidence(input: unknown): TaskEvidence {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Structured task evidence is required');
  const value = input as Record<string, unknown>;
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (!summary || summary.length > 1500) throw new Error('Evidence summary is required and must be at most 1500 characters');
  const references = Array.isArray(value.references) ? value.references.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 500)).slice(0, 8) : undefined;
  const metadata = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
    ? Object.fromEntries(Object.entries(value.metadata as Record<string, unknown>).filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item)).slice(0, 12).map(([key, item]) => [key.slice(0, 80), item as string | number | boolean]))
    : undefined;
  return { summary, ...(references?.length ? { references } : {}), ...(metadata && Object.keys(metadata).length ? { metadata } : {}) };
}

export async function ensureMicroTaskSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS micro_task_rewards (
    task_id INTEGER PRIMARY KEY,
    phone TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    decision TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  const columns = db.exec(`PRAGMA table_info(micro_tasks)`)[0]?.values?.map((row: unknown[]) => String(row[1])) || [];
  const additions: Record<string, string> = {
    evidence_json: 'TEXT',
    submitted_at: 'TEXT',
    reviewed_by: 'TEXT',
    review_note: 'TEXT',
    reviewed_at: 'TEXT',
    rewarded_at: 'TEXT',
    source_type: 'TEXT',
    source_id: 'TEXT',
    verification_kind: 'TEXT',
  };
  for (const [column, declaration] of Object.entries(additions)) if (!columns.includes(column)) db.run(`ALTER TABLE micro_tasks ADD COLUMN ${column} ${declaration}`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_micro_tasks_status_assignee ON micro_tasks(status, assigned_to)`);
  saveDb();
}

function taskFromRow(row: any) {
  return {
    id: Number(row.id),
    title: String(row.title || 'Contribution task'),
    description: String(row.description || ''),
    skillTag: String(row.skill_tag || ''),
    pointsReward: Number(row.credits_reward || 0),
    status: String(row.status || 'available'),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    evidence: parseEvidence(row.evidence_json),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    rewardedAt: row.rewarded_at ? String(row.rewarded_at) : null,
    sourceType: row.source_type ? String(row.source_type) : null,
    sourceId: row.source_id ? String(row.source_id) : null,
    verificationKind: row.verification_kind ? String(row.verification_kind) : null,
  };
}

export type TopicVerificationKind = 'broad_locality' | 'factual_observation' | 'price_observation' | 'public_place_reference' | 'staleness_review';
const TOPIC_VERIFICATION_KINDS: Record<TopicVerificationKind, string> = {
  broad_locality: 'Verify the broad city or LGA context only; do not collect or publish a precise address or coordinates.',
  factual_observation: 'Verify a specific public factual observation using a cited, lawful source. Do not convert evidence into provider verification.',
  price_observation: 'Verify a dated public price observation with source context. This does not establish current availability, a quote, or a transaction price.',
  public_place_reference: 'Verify a public place or business reference from a cited source. This does not verify a provider relationship or current availability.',
  staleness_review: 'Review whether the shared public information appears stale and cite the basis for the review.',
};

export async function createTopicVerificationTask(input: { topicId: string; verificationKind: unknown; creditsReward?: unknown }): Promise<{ task: ReturnType<typeof taskFromRow>; idempotent: boolean }> {
  await ensureMicroTaskSchema();
  const kind = typeof input.verificationKind === 'string' && input.verificationKind in TOPIC_VERIFICATION_KINDS ? input.verificationKind as TopicVerificationKind : null;
  if (!kind) throw new Error('A supported Topic verification kind is required');
  const reward = Math.max(0, Math.min(30, Number.isFinite(Number(input.creditsReward)) ? Math.floor(Number(input.creditsReward)) : 10));
  const db = await getDb();
  const topicStmt = db.prepare(`SELECT title,category,status FROM topics WHERE id=? LIMIT 1`);
  topicStmt.bind([input.topicId]); const topic = topicStmt.step() ? topicStmt.getAsObject() as any : null; topicStmt.free();
  if (!topic || String(topic.status) !== 'public') throw new Error('Only public Topics can receive a contributor verification task');
  const existing = db.prepare(`SELECT * FROM micro_tasks WHERE source_type='topic' AND source_id=? AND verification_kind=? AND status IN ('available','in_progress','submitted') ORDER BY id DESC LIMIT 1`);
  existing.bind([input.topicId, kind]); const existingRow = existing.step() ? existing.getAsObject() : null; existing.free();
  if (existingRow) return { task: taskFromRow(existingRow), idempotent: true };
  db.run(`INSERT INTO micro_tasks(title,description,skill_tag,credits_reward,status,source_type,source_id,verification_kind) VALUES(?,?,?,?, 'available','topic',?,?)`, [
    `Review shared Topic: ${String(topic.title).slice(0, 100)}`,
    `${TOPIC_VERIFICATION_KINDS[kind]} Topic category: ${String(topic.category || 'not selected')}. Evidence is an observation only and never changes the Topic into a verified provider, price, availability, booking, or fulfilment record.`,
    'topic_verification', reward, input.topicId, kind,
  ]);
  const result = db.exec('SELECT * FROM micro_tasks WHERE id=last_insert_rowid()');
  const columns = result[0]?.columns || []; const values = result[0]?.values?.[0] || []; const row = Object.fromEntries(columns.map((column: string, index: number) => [column, values[index]]));
  saveDb();
  return { task: taskFromRow(row), idempotent: false };
}

export async function getAvailableTasks(_phone: string) {
  await ensureMicroTaskSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE status = 'available' ORDER BY id DESC`);
  const tasks: ReturnType<typeof taskFromRow>[] = [];
  while (stmt.step()) tasks.push(taskFromRow(stmt.getAsObject()));
  stmt.free();
  return tasks;
}

export async function getContributorTasks(phone: string) {
  await ensureMicroTaskSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE assigned_to=? AND status IN ('in_progress','submitted','approved','rejected') ORDER BY COALESCE(submitted_at, reviewed_at, id) DESC`);
  stmt.bind([phone]);
  const tasks: ReturnType<typeof taskFromRow>[] = [];
  while (stmt.step()) tasks.push(taskFromRow(stmt.getAsObject()));
  stmt.free();
  return tasks;
}

export async function getSubmittedTasks(limit = 100) {
  await ensureMicroTaskSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE status='submitted' ORDER BY submitted_at ASC LIMIT ?`);
  stmt.bind([Math.max(1, Math.min(100, Math.floor(limit)))]);
  const tasks: ReturnType<typeof taskFromRow>[] = [];
  while (stmt.step()) tasks.push(taskFromRow(stmt.getAsObject()));
  stmt.free();
  return tasks;
}

export async function acceptTask(phone: string, taskId: number) {
  await ensureMicroTaskSchema();
  const db = await getDb();
  const existing = db.prepare(`SELECT status,assigned_to FROM micro_tasks WHERE id=?`);
  existing.bind([taskId]);
  const row = existing.step() ? existing.getAsObject() as any : null;
  existing.free();
  if (!row) throw new Error('Task not found');
  if (String(row.status) === 'in_progress' && String(row.assigned_to || '') === phone) return { success: true, idempotent: true };
  if (String(row.status) !== 'available') throw new Error('Task is no longer available');
  db.run(`UPDATE micro_tasks SET status='in_progress', assigned_to=? WHERE id=? AND status='available'`, [phone, taskId]);
  saveDb();
  const check = db.prepare(`SELECT status,assigned_to FROM micro_tasks WHERE id=?`);
  check.bind([taskId]);
  const assigned = check.step() ? check.getAsObject() as any : null;
  check.free();
  if (!assigned || String(assigned.status) !== 'in_progress' || String(assigned.assigned_to || '') !== phone) throw new Error('Task is no longer available');
  return { success: true, idempotent: false };
}

export async function submitTaskEvidence(phone: string, taskId: number, evidenceInput: unknown) {
  await ensureMicroTaskSchema();
  const evidence = normalizeEvidence(evidenceInput);
  const db = await getDb();
  const stmt = db.prepare(`SELECT status,assigned_to,evidence_json FROM micro_tasks WHERE id=?`);
  stmt.bind([taskId]);
  const row = stmt.step() ? stmt.getAsObject() as any : null;
  stmt.free();
  if (!row) throw new Error('Task not found');
  if (String(row.assigned_to || '') !== phone) throw new Error('Only the assigned contributor can submit evidence');
  if (String(row.status) === 'submitted') return { success: true, idempotent: true, status: 'submitted' as const };
  if (String(row.status) !== 'in_progress') throw new Error('Task is not ready for evidence submission');
  db.run(`UPDATE micro_tasks SET status='submitted', evidence_json=?, submitted_at=CURRENT_TIMESTAMP WHERE id=? AND assigned_to=? AND status='in_progress'`, [JSON.stringify(evidence), taskId, phone]);
  saveDb();
  return { success: true, idempotent: false, status: 'submitted' as const };
}

async function rewardRecorded(db: any, taskId: number, phone: string, reward: number): Promise<boolean> {
  const ledger = db.prepare(`SELECT id FROM credit_transactions WHERE phone=? AND amount=? AND description=? LIMIT 1`);
  ledger.bind([phone, reward, `Approved micro-task #${taskId}`]);
  const exists = ledger.step();
  ledger.free();
  return exists;
}

export async function moderateTask(input: { taskId: number; moderatorPhone: string; decision: MicroTaskDecision; note?: string }): Promise<{ success: boolean; task: ReturnType<typeof taskFromRow>; reward: number; idempotent: boolean }> {
  await ensureMicroTaskSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE id=?`);
  stmt.bind([input.taskId]);
  const row = stmt.step() ? stmt.getAsObject() as any : null;
  stmt.free();
  if (!row) throw new Error('Task not found');
  const task = taskFromRow(row);
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1500) : '';
  if (task.status === input.decision) return { success: true, task, reward: task.pointsReward, idempotent: true };
  if (task.status !== 'submitted' || !task.assignedTo) throw new Error('Only submitted task evidence can be moderated');

  let reward = 0;
  if (input.decision === 'approved' && task.pointsReward > 0) {
    const rewardStmt = db.prepare(`SELECT task_id FROM micro_task_rewards WHERE task_id=?`);
    rewardStmt.bind([task.id]);
    const existingReward = rewardStmt.step();
    rewardStmt.free();
    if (!existingReward) {
      db.run(`INSERT INTO micro_task_rewards(task_id,phone,amount,decision) VALUES(?,?,?,'approved')`, [task.id, task.assignedTo, task.pointsReward]);
    }
    if (!await rewardRecorded(db, task.id, task.assignedTo, task.pointsReward)) await addCredits(task.assignedTo, task.pointsReward, `Approved micro-task #${task.id}`);
    reward = task.pointsReward;
  }

  db.run(`UPDATE micro_tasks SET status=?, reviewed_by=?, review_note=?, reviewed_at=CURRENT_TIMESTAMP, rewarded_at=? WHERE id=? AND status='submitted'`, [input.decision, input.moderatorPhone, note || null, input.decision === 'approved' && reward > 0 ? new Date().toISOString() : null, task.id]);
  saveDb();
  const updatedStmt = db.prepare(`SELECT * FROM micro_tasks WHERE id=?`);
  updatedStmt.bind([task.id]);
  const updatedRow = updatedStmt.step() ? updatedStmt.getAsObject() : row;
  updatedStmt.free();
  return { success: true, task: taskFromRow(updatedRow), reward, idempotent: false };
}

/** Compatibility boundary: a completed task is now evidence submitted, not automatically rewarded. */
export async function completeTask(phone: string, taskId: number, result: string) {
  return submitTaskEvidence(phone, taskId, { summary: String(result || '').trim() || 'Contributor marked this task ready for review.' });
}

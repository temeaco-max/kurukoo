import { getDb, saveDb } from '../database.js';
import { addPoints } from './pointsEngine.js';

export interface MicroTask {
    id: number;
    title: string;
    description?: string;
    status: string;
    assignedTo?: string;
    sourceType?: string;
    sourceId?: string;
    createdAt?: string;
    updatedAt?: string;
}

function rowToMicroTask(row: any): MicroTask {
    return {
        id: Number(row.id),
        title: String(row.title || 'Task'),
        description: row.description ? String(row.description) : undefined,
        status: String(row.status || 'available'),
        assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
        sourceType: row.source_type ? String(row.source_type) : undefined,
        sourceId: row.source_id ? String(row.source_id) : undefined,
        createdAt: row.created_at ? String(row.created_at) : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
}

/** Read-only owner-scoped task projection for shared surfaces such as Agent Briefs. */
export async function listAssignedTasks(phone: string, includeClosed = false): Promise<MicroTask[]> {
    const owner = String(phone || '').trim();
    if (!owner) return [];
    const db = await getDb();
    const sql = includeClosed
        ? `SELECT * FROM micro_tasks WHERE assigned_to = ? ORDER BY id DESC LIMIT 50`
        : `SELECT * FROM micro_tasks WHERE assigned_to = ? AND status NOT IN ('completed', 'approved', 'rejected') ORDER BY id DESC LIMIT 50`;
    const stmt = db.prepare(sql);
    stmt.bind([owner]);
    const tasks: MicroTask[] = [];
    while (stmt.step()) tasks.push(rowToMicroTask(stmt.getAsObject()));
    stmt.free();
    return tasks;
}

export async function getAvailableTasks(phone: string) {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE status = 'available'`);
    const tasks = [];
    while (stmt.step()) tasks.push(stmt.getAsObject());
    stmt.free();
    return tasks;
}

export async function acceptTask(phone: string, taskId: number) {
    const db = await getDb();
    db.run(`UPDATE micro_tasks SET status = 'in_progress', assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'available'`, [phone, taskId]);
    saveDb();
    return true;
}

export async function completeTask(phone: string, taskId: number, result: string) {
    const db = await getDb();
    const stmt = db.prepare(`SELECT credits_reward, source_type FROM micro_tasks WHERE id = ? AND assigned_to = ? AND status = 'in_progress'`);
    stmt.bind([taskId, phone]);
    let reward = 0;
    let sourceType: string | null = null;
    if (stmt.step()) {
        const row: any = stmt.getAsObject();
        reward = row.credits_reward as number;
        sourceType = row.source_type ? String(row.source_type) : null;
    }
    stmt.free();

    if (reward > 0) {
        db.run(`UPDATE micro_tasks SET status = 'completed', submitted_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [String(result || '').slice(0, 4000), taskId]);
        if (sourceType !== 'topic') await addPoints(phone, reward, `Completed micro-task #${taskId}`);
        saveDb();
        return { success: true, reward, sourceType };
    }
    return { success: false };
}

export async function createTopicVerificationTask(input: {
    topicId: string;
    verificationKind: string;
    creditsReward: number;
}) {
    const db = await getDb();
    const topic = db.prepare(`SELECT id, title, body, status FROM topics WHERE id=? LIMIT 1`);
    topic.bind([input.topicId]);
    const row = topic.step() ? topic.getAsObject() : null;
    topic.free();
    if (!row || String(row.status) !== 'public') throw new Error('Only public Topics can receive verification tasks');
    const reward = Number.isInteger(input.creditsReward) && input.creditsReward > 0 ? input.creditsReward : 0;
    if (!reward || reward > 100) throw new Error('creditsReward must be a positive integer up to 100');
    const kind = String(input.verificationKind || '').trim().slice(0, 120);
    if (!kind) throw new Error('verificationKind is required');
    const existing = db.prepare(`SELECT * FROM micro_tasks WHERE source_type='topic' AND source_id=? AND status IN ('available','in_progress','completed','approved') ORDER BY id DESC LIMIT 1`);
    existing.bind([input.topicId]);
    const prior = existing.step() ? existing.getAsObject() : null;
    existing.free();
    if (prior) return prior;
    db.run(`INSERT INTO micro_tasks(title, description, skill_tag, credits_reward, status, source_type, source_id, verification_kind) VALUES(?,?,?,?, 'available', 'topic', ?, ?)`, [
        `Review community Topic: ${String(row.title).slice(0, 120)}`,
        'Record a bounded factual observation about this public Topic. Do not turn it into provider, availability, price, booking, payment, or delivery verification.',
        'topic_verification', reward, input.topicId, kind,
    ]);
    const created = db.prepare(`SELECT * FROM micro_tasks WHERE id=last_insert_rowid()`);
    const task = created.step() ? created.getAsObject() : null;
    created.free();
    saveDb();
    return task;
}

export async function moderateTopicVerificationTask(taskId: number, adminIdentity: string, decision: string, note?: string) {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM micro_tasks WHERE id=? AND source_type='topic' LIMIT 1`);
    stmt.bind([taskId]);
    const task: any = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!task) throw new Error('Topic verification task not found');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('decision must be approved or rejected');
    if (decision === 'approved') {
        if (String(task.status) !== 'completed' || !task.assigned_to) throw new Error('Only completed verification tasks can be approved');
        if (task.approved_at) return task;
        db.run(`UPDATE micro_tasks SET status='approved', moderation_note=?, approved_by=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [note ? String(note).slice(0, 1000) : null, adminIdentity.slice(0, 128), taskId]);
        await addPoints(String(task.assigned_to), Number(task.credits_reward), `Approved Topic verification task #${taskId}`);
    } else {
        db.run(`UPDATE micro_tasks SET status='rejected', moderation_note=?, approved_by=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [note ? String(note).slice(0, 1000) : null, adminIdentity.slice(0, 128), taskId]);
    }
    saveDb();
    const updated = db.prepare(`SELECT * FROM micro_tasks WHERE id=?`);
    updated.bind([taskId]);
    const result = updated.step() ? updated.getAsObject() : null;
    updated.free();
    return result;
}

import { getDb, saveDb } from '../database.js';
import { getDailyPersonalizedQuestion } from './progressiveOnboarding.js';

/**
 * Produce the next post-onboarding profile question using the existing
 * Memory Profile preference record. This is a bounded engagement helper;
 * delivery remains owned by the canonical notification/communication layer.
 */
export async function triggerDailyEngagementCheck(phone: string): Promise<{ q: string, options: string[] } | null> {
    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS sent_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        question TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_sent_questions_phone_created ON sent_questions(phone, created_at DESC)');

    const stmt = db.prepare(`SELECT preferences FROM memory_profiles WHERE phone = ?`);
    stmt.bind([phone]);
    let prefs: any = {};
    if (stmt.step()) {
        const obj = stmt.getAsObject();
        try { prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {}; } catch { prefs = {}; }
    }
    stmt.free();

    if (prefs.onboarding_complete !== true) {
        return null;
    }

    const currentDay = Number(prefs.engagement_day || 0);
    const nextDay = currentDay + 1;
    if (nextDay > 7) {
        return null;
    }

    // The worker owns cadence. The helper also protects against accidental
    // repeated invocation during the same calendar day.
    const today = new Date().toISOString().slice(0, 10);
    if (typeof prefs.last_engagement_prompt_at === 'string' && prefs.last_engagement_prompt_at.slice(0, 10) === today) {
        return null;
    }

    const questionObj = getDailyPersonalizedQuestion(nextDay);
    prefs.engagement_day = nextDay;
    prefs.last_engagement_prompt_at = new Date().toISOString();

    db.run(`UPDATE memory_profiles SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [JSON.stringify(prefs), phone]);
    db.run(`INSERT INTO sent_questions (phone, question) VALUES (?, ?)`, [phone, questionObj.q]);
    saveDb();

    return questionObj;
}
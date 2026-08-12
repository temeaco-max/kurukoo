import { getDb, saveDb } from '../database.js';

export type DeferredStatus = 'requested' | 'awaiting_match' | 'partially_matched' | 'fulfilled' | 'abandoned';
const DEFAULT_TTL_DAYS = 7;
const DEFAULT_RECHECK_HOURS = 2;

async function initDeferredTables() {
    const db = await getDb();
    db.run(`
        CREATE TABLE IF NOT EXISTS open_intentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            intent TEXT NOT NULL,
            context TEXT,
            skill TEXT,
            location TEXT,
            status TEXT NOT NULL DEFAULT 'requested',
            resolution TEXT,
            note TEXT,
            workaround TEXT,
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            ttl_days INTEGER DEFAULT 7,
            next_check_at TEXT,
            expires_at TEXT,
            deferred_attempts INTEGER DEFAULT 0,
            economic_request_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);
    const columns = db.exec('PRAGMA table_info(open_intentions)')[0]?.values || [];
    const names = columns.map((row: any[]) => row[1]);
    const additions: Record<string, string> = {
        next_check_at: 'TEXT',
        expires_at: 'TEXT',
        deferred_attempts: 'INTEGER DEFAULT 0',
        economic_request_id: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) {
        if (!names.includes(name)) db.run(`ALTER TABLE open_intentions ADD COLUMN ${name} ${type}`);
    }
    db.run(`CREATE INDEX IF NOT EXISTS idx_open_intentions_phone_status ON open_intentions(phone, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_open_intentions_erq ON open_intentions(economic_request_id)`);
    saveDb();
}

export async function createOpenIntention(
    phone: string,
    intent: string,
    context: string,
    options: {
        skill?: string;
        location?: string;
        ttlDays?: number;
        maxAttempts?: number;
        economicRequestId?: string;
    } = {}
) {
    await initDeferredTables();
    const db = await getDb();
    const now = new Date();
    const ttlDays = Math.max(1, Math.min(7, options.ttlDays ?? DEFAULT_TTL_DAYS));
    const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    const nextCheck = new Date(now.getTime() + DEFAULT_RECHECK_HOURS * 60 * 60 * 1000);
    const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    db.run(`
        INSERT INTO open_intentions
          (phone, intent, context, skill, location, status, ttl_days, max_attempts, next_check_at, expires_at, economic_request_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?)
    `, [
        phone,
        intent,
        context,
        options.skill || null,
        options.location || null,
        ttlDays,
        maxAttempts,
        nextCheck.toISOString(),
        expires.toISOString(),
        options.economicRequestId || null,
        now.toISOString(),
        now.toISOString(),
    ]);

    saveDb();
    return getIntentionById(phone, db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0]);
}

async function getIntentionById(phone: string, id: any) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM open_intentions WHERE phone = ? AND id = ?');
    stmt.bind([phone, Number(id)]);
    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

export async function markAwaitingMatch(phone: string, intentionId: string | number) {
    return transition(phone, intentionId, 'awaiting_match');
}

export async function markPartiallyMatched(phone: string, intentionId: string | number, note?: string) {
    await transition(phone, intentionId, 'partially_matched', note);
    return incrementAttempt(phone, intentionId);
}

export async function resolveOpenIntention(phone: string, intentionId: string | number, resolution: string, note?: string, workaround?: string) {
    return transition(phone, intentionId, 'fulfilled', note, resolution, workaround);
}

export async function abandonOpenIntention(phone: string, intentionId: string | number, note?: string) {
    return transition(phone, intentionId, 'abandoned', note, 'abandoned');
}

async function transition(phone: string, intentionId: string | number, status: DeferredStatus, note?: string, resolution?: string, workaround?: string) {
    await initDeferredTables();
    const db = await getDb();
    const now = new Date().toISOString();
    db.run(`
        UPDATE open_intentions
        SET status = ?, resolution = COALESCE(?, resolution), note = COALESCE(?, note), workaround = COALESCE(?, workaround), updated_at = ?
        WHERE phone = ? AND id = ?
    `, [status, resolution || null, note || null, workaround || null, now, phone, Number(intentionId)]);
    saveDb();
    return getIntentionById(phone, intentionId);
}

export async function getIntentions(phone: string) {
    await initDeferredTables();
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM open_intentions WHERE phone = ? ORDER BY created_at DESC`);
    stmt.bind([phone]);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

/**
 * Resumable intention for storefront re-bind:
 * - still open (requested / awaiting_match / partially_matched), or
 * - recently fulfilled with provider_matched so user can continue quote/escrow.
 */
export async function getResumableIntention(phone: string): Promise<any | null> {
    await initDeferredTables();
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT * FROM open_intentions
        WHERE phone = ?
          AND (
            status IN ('requested','awaiting_match','partially_matched')
            OR (status = 'fulfilled' AND resolution = 'provider_matched'
                AND datetime(updated_at) > datetime('now', '-48 hours'))
          )
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')
               OR (status = 'fulfilled' AND resolution = 'provider_matched'))
        ORDER BY
          CASE WHEN status = 'fulfilled' AND resolution = 'provider_matched' THEN 0 ELSE 1 END,
          updated_at DESC
        LIMIT 1
    `);
    stmt.bind([phone]);
    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

export async function getIntentionByEconomicRequestId(economicRequestId: string): Promise<any | null> {
    if (!economicRequestId) return null;
    await initDeferredTables();
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM open_intentions WHERE economic_request_id = ? ORDER BY id DESC LIMIT 1`);
    stmt.bind([economicRequestId]);
    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

export async function incrementAttempt(phone: string, intentionId: string | number) {
    await initDeferredTables();
    const db = await getDb();
    db.run(
        `UPDATE open_intentions SET attempts = attempts + 1, deferred_attempts = deferred_attempts + 1, next_check_at = ?, updated_at = ? WHERE phone = ? AND id = ?`,
        [new Date(Date.now() + DEFAULT_RECHECK_HOURS * 60 * 60 * 1000).toISOString(), new Date().toISOString(), phone, Number(intentionId)]
    );
    saveDb();
    return getIntentionById(phone, intentionId);
}

/** Called by the 2-hour worker to return intentions ready for another matching pass. */
export async function getDueIntentions(limit = 100) {
    await initDeferredTables();
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT * FROM open_intentions
        WHERE status IN ('requested','awaiting_match','partially_matched')
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
          AND (next_check_at IS NULL OR datetime(next_check_at) <= datetime('now'))
          AND attempts < max_attempts
        ORDER BY next_check_at ASC LIMIT ?
    `);
    stmt.bind([limit]);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

/** Nightly expiration pass. */
export async function expireDeferredIntentions() {
    await initDeferredTables();
    const db = await getDb();
    db.run(`UPDATE open_intentions SET status = 'abandoned', resolution = 'expired', updated_at = CURRENT_TIMESTAMP WHERE status IN ('requested','awaiting_match','partially_matched') AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')`);
    saveDb();
}

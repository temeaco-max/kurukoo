import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';

const router = Router();

async function ensureSavedTable() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS saved_items (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'context',
    title TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    source_id TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, kind, source_id)
  )`);
  return db;
}

function owner(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function parseMetadata(value: unknown) {
  try { return value ? JSON.parse(String(value)) : {}; } catch { return {}; }
}

router.get('/saved', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const db = await ensureSavedTable();
  const statement = db.prepare('SELECT * FROM saved_items WHERE phone=? ORDER BY updated_at DESC, created_at DESC');
  statement.bind([phone]);
  const items: any[] = [];
  while (statement.step()) {
    const row = statement.getAsObject() as any;
    items.push({ ...row, metadata: parseMetadata(row.metadata) });
  }
  statement.free();
  res.json({ items });
});

router.post('/saved', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const kind = String(req.body?.kind || 'context').trim().slice(0, 80);
  const title = String(req.body?.title || '').trim().slice(0, 300);
  const description = req.body?.description ? String(req.body.description).trim().slice(0, 2000) : null;
  const sourceUrl = req.body?.source_url ? String(req.body.source_url).trim().slice(0, 2000) : null;
  const sourceId = req.body?.source_id ? String(req.body.source_id).trim().slice(0, 300) : null;
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? JSON.stringify(req.body.metadata) : '{}';
  if (!title) return res.status(400).json({ error: 'title is required' });
  const db = await ensureSavedTable();
  const id = crypto.randomUUID();
  db.run(`INSERT INTO saved_items (id,phone,kind,title,description,source_url,source_id,metadata)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(phone,kind,source_id) DO UPDATE SET
            title=excluded.title, description=excluded.description, source_url=excluded.source_url,
            metadata=excluded.metadata, updated_at=CURRENT_TIMESTAMP`,
    [id, phone, kind, title, description, sourceUrl, sourceId, metadata]);
  saveDb();
  res.status(201).json({ success: true, id });
});

router.delete('/saved/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const id = String(req.params.id || '');
  const db = await ensureSavedTable();
  db.run('DELETE FROM saved_items WHERE id=? AND phone=?', [id, phone]);
  saveDb();
  res.json({ success: true });
});

export default router;

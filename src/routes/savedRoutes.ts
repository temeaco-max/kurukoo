import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';

const router = Router();

async function ensureSavedTable() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS saved_items (id TEXT PRIMARY KEY,phone TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'context',title TEXT NOT NULL,description TEXT,source_url TEXT,source_id TEXT,metadata TEXT DEFAULT '{}',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(phone,kind,source_id))`);
  return db;
}

const owner = (req: AuthRequest) => req.user?.phone ? String(req.user.phone) : null;
const meta = (v: unknown) => { try { return v ? JSON.parse(String(v)) : {}; } catch { return {}; } };
const identityKey = (kind: string, sourceId: string | null, title: string) => sourceId || `${kind}:${title.toLowerCase().replace(/\s+/g, ' ').slice(0, 280)}`;

router.get('/saved', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const db = await ensureSavedTable();
  const s = db.prepare('SELECT * FROM saved_items WHERE phone=? ORDER BY updated_at DESC, created_at DESC');
  s.bind([phone]);
  const items: any[] = [];
  while (s.step()) {
    const row = s.getAsObject() as any;
    items.push({ ...row, metadata: meta(row.metadata) });
  }
  s.free();
  return res.json({ items });
});

router.post('/saved', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const kind = String(req.body?.kind || 'context').trim().slice(0, 80);
  const title = String(req.body?.title || '').trim().slice(0, 300);
  if (!title) return res.status(400).json({ error: 'title is required' });
  const description = req.body?.description ? String(req.body.description).trim().slice(0, 2000) : null;
  const sourceUrl = req.body?.source_url ? String(req.body.source_url).trim().slice(0, 2000) : null;
  const rawSourceId = req.body?.source_id ? String(req.body.source_id).trim().slice(0, 300) : null;
  const sourceId = identityKey(kind, rawSourceId, title);
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? JSON.stringify(req.body.metadata) : '{}';
  const db = await ensureSavedTable();
  db.run(`INSERT INTO saved_items (id,phone,kind,title,description,source_url,source_id,metadata) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(phone,kind,source_id) DO UPDATE SET title=excluded.title,description=excluded.description,source_url=excluded.source_url,metadata=excluded.metadata,updated_at=CURRENT_TIMESTAMP`, [crypto.randomUUID(), phone, kind, title, description, sourceUrl, sourceId, metadata]);
  saveDb();
  return res.status(201).json({ success: true, sourceId });
});

router.delete('/saved/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const db = await ensureSavedTable();
  db.run('DELETE FROM saved_items WHERE id=? AND phone=?', [String(req.params.id || ''), phone]);
  saveDb();
  return res.json({ success: true });
});

export default router;

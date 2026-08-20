import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../database.js';
import { assertHighWritePersistence } from './highWritePersistence.js';
import { classifyMessageTier, ensureLivingMemorySchema } from './livingMemoryEngine.js';
import { getProfile } from './memoryProfile.js';

export interface ChatMessageInput {
  phone: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  channel?: string;
  conversationId?: string;
  cardData?: unknown;
  metadata?: unknown;
}
export interface ChatHistoryOptions {
  conversationId?: string;
  limit?: number;
  beforeId?: number;
}

export async function ensureChatSchema(db: any): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    title TEXT,
    channel TEXT DEFAULT 'unified',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_conversations_phone_updated ON chat_conversations(phone, updated_at DESC);`);
  db.run(`CREATE TABLE IF NOT EXISTS chat_message_meta (
    message_id INTEGER PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    metadata TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_meta_conversation ON chat_message_meta(conversation_id, message_id DESC);`);
  db.run(`CREATE TABLE IF NOT EXISTS chat_attachments (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    message_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_attachments_owner_expiry ON chat_attachments(phone, expires_at);`);
  try {
    await ensureLivingMemorySchema();
  } catch {
    /* non-fatal at boot */
  }
}

async function dbReady(): Promise<any> {
  assertHighWritePersistence('messages_conversations');
  const db = await getDb();
  await ensureChatSchema(db);
  return db;
}

export async function ensureConversation(
  phone: string,
  conversationId?: string,
  channel = 'unified',
  title?: string,
  createNew = false
): Promise<string> {
  const db = await dbReady();
  if (conversationId) {
    const stmt = db.prepare(`SELECT id FROM chat_conversations WHERE id = ? AND phone = ?`);
    stmt.bind([conversationId, phone]);
    const exists = stmt.step();
    stmt.free();
    if (exists) return conversationId;
  }

  if (createNew) {
    const id = randomUUID();
    db.run(`INSERT INTO chat_conversations (id, phone, title, channel) VALUES (?, ?, ?, ?)`, [id, phone, title || null, channel || 'unified']);
    saveDb();
    return id;
  }

  const latest = db.prepare(`SELECT id FROM chat_conversations WHERE phone = ? ORDER BY updated_at DESC LIMIT 1`);
  latest.bind([phone]);
  if (latest.step()) {
    const id = String(latest.getAsObject().id);
    latest.free();
    db.run(`UPDATE chat_conversations SET channel = 'unified', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND phone = ?`, [
      id,
      phone,
    ]);
    return id;
  }
  latest.free();

  const id = randomUUID();
  db.run(`INSERT INTO chat_conversations (id, phone, title, channel) VALUES (?, ?, ?, 'unified')`, [
    id,
    phone,
    title || null,
  ]);
  saveDb();
  return id;
}

export async function appendChatMessage(
  input: ChatMessageInput
): Promise<{ id: number; conversationId: string }> {
  const db = await dbReady();

  // Memory Profile is the single source of truth for conversation context.
  // Read it through the canonical service before persisting the message so
  // every channel observes the same profile boundary and access is auditable.
  await getProfile(input.phone, 'chatConversation');

  const conversationId = await ensureConversation(
    input.phone,
    input.conversationId,
    'unified',
    input.sender === 'user' ? input.content.slice(0, 80) : undefined,
    input.sender === 'user' && !input.conversationId && ['web', 'web_qr'].includes(input.channel || 'web')
  );

  db.run(`INSERT INTO messages (phone, sender, content, channel, card_data, memory_tier, memory_status, relevance_score, thread_id) VALUES (?, ?, ?, ?, ?, 'episodic', 'active', 0.55, ?)`, [
    input.phone,
    input.sender,
    input.content,
    input.channel || 'web',
    input.cardData == null ? null : JSON.stringify(input.cardData),
    conversationId,
  ]);

  const result = db.exec(`SELECT last_insert_rowid() AS id`);
  const id = Number(result?.[0]?.values?.[0]?.[0] || 0);

  db.run(`INSERT OR REPLACE INTO chat_message_meta (message_id, conversation_id, metadata) VALUES (?, ?, ?)`, [
    id,
    conversationId,
    input.metadata == null ? null : JSON.stringify(input.metadata),
  ]);
  db.run(
    `UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP, title = CASE WHEN title IS NULL AND ? = 'user' THEN ? ELSE title END WHERE id = ? AND phone = ?`,
    [input.sender, input.content.slice(0, 80), conversationId, input.phone]
  );
  saveDb();

  // Reinforce tier classification (idempotent)
  if (id > 0) {
    try {
      await classifyMessageTier(id, 'episodic');
    } catch {
      /* ignore */
    }
  }

  return { id, conversationId };
}

export async function listChatConversations(phone: string, limit = 50): Promise<any[]> {
  const db = await dbReady();
  const stmt = db.prepare(
    `SELECT id, phone, title, channel, created_at, updated_at FROM chat_conversations WHERE phone = ? ORDER BY updated_at DESC LIMIT ?`
  );
  stmt.bind([phone, Math.min(Math.max(limit, 1), 100)]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export async function listChatMessages(phone: string, options: ChatHistoryOptions = {}): Promise<any[]> {
  const db = await dbReady();
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const params: any[] = [phone];
  let sql = `SELECT m.*, cm.conversation_id, cm.metadata, cm.attachment_url, cm.attachment_name, cm.attachment_type FROM messages m LEFT JOIN chat_message_meta cm ON cm.message_id = m.id WHERE m.phone = ?`;
  if (options.conversationId) {
    sql += ` AND cm.conversation_id = ?`;
    params.push(options.conversationId);
  }
  if (options.beforeId) {
    sql += ` AND m.id < ?`;
    params.push(options.beforeId);
  }
  sql += ` ORDER BY m.id DESC LIMIT ?`;
  params.push(limit);
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.reverse();
}

export async function deleteChatMessage(phone: string, messageId: number): Promise<boolean> {
  const db = await dbReady();
  const stmt = db.prepare(`SELECT id FROM messages WHERE id = ? AND phone = ?`);
  stmt.bind([messageId, phone]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) return false;
  db.run(`DELETE FROM chat_message_meta WHERE message_id = ?`, [messageId]);
  db.run(`DELETE FROM messages WHERE id = ? AND phone = ?`, [messageId, phone]);
  saveDb();
  return true;
}

export async function clearChatConversation(phone: string, conversationId: string): Promise<number> {
  const db = await dbReady();
  const idsStmt = db.prepare(`SELECT message_id FROM chat_message_meta WHERE conversation_id = ?`);
  idsStmt.bind([conversationId]);
  const ids: number[] = [];
  while (idsStmt.step()) ids.push(Number(idsStmt.getAsObject().message_id));
  idsStmt.free();
  for (const id of ids) db.run(`DELETE FROM messages WHERE id = ? AND phone = ?`, [id, phone]);
  db.run(`DELETE FROM chat_message_meta WHERE conversation_id = ?`, [conversationId]);
  db.run(`DELETE FROM chat_conversations WHERE id = ? AND phone = ?`, [conversationId, phone]);
  saveDb();
  return ids.length;
}

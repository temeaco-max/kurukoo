import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../database.js';
import { classifyMessageTier, ensureLivingMemorySchema } from './livingMemoryEngine.js';
import { getProfile } from './memoryProfile.js';
import { deleteChatAttachment } from './chatAttachmentService.js';

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
  try {
    await ensureLivingMemorySchema();
  } catch {
    /* non-fatal at boot */
  }
}

async function dbReady(): Promise<any> {
  const db = await getDb();
  await ensureChatSchema(db);
  return db;
}

export async function ensureConversation(
  phone: string,
  conversationId?: string,
  channel = 'unified',
  title?: string
): Promise<string> {
  const db = await dbReady();
  if (conversationId) {
    const stmt = db.prepare(`SELECT id FROM chat_conversations WHERE id = ? AND phone = ?`);
    stmt.bind([conversationId, phone]);
    const exists = stmt.step();
    stmt.free();
    if (exists) return conversationId;
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
    input.sender === 'user' ? input.content.slice(0, 80) : undefined
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

function attachmentIdsFromMetadata(value: unknown): Set<string> {
  const ids = new Set<string>();
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  const id = parsed && typeof parsed === 'object' && typeof (parsed as { attachment?: { id?: unknown } }).attachment?.id === 'string'
    ? String((parsed as { attachment: { id: string } }).attachment.id).trim()
    : '';
  if (/^[0-9a-f-]{36}$/i.test(id)) ids.add(id);
  return ids;
}

async function removeUnreferencedAttachments(phone: string, candidateIds: Set<string>): Promise<void> {
  if (!candidateIds.size) return;
  const db = await dbReady();
  const statement = db.prepare(`SELECT cm.metadata FROM chat_message_meta cm JOIN messages m ON m.id = cm.message_id WHERE m.phone = ? AND cm.metadata IS NOT NULL`);
  statement.bind([phone]);
  const referenced = new Set<string>();
  while (statement.step()) for (const id of attachmentIdsFromMetadata(statement.getAsObject().metadata)) referenced.add(id);
  statement.free();
  for (const id of candidateIds) if (!referenced.has(id)) await deleteChatAttachment(id, phone);
}

/** A bounded owner-scoped account-export projection; attachment bytes remain in the private attachment owner. */
export async function exportChatHistory(phone: string, limit = 250): Promise<any[]> {
  const db = await dbReady();
  const statement = db.prepare(`SELECT m.id, m.sender, m.content, m.channel, m.created_at, cm.conversation_id, cm.metadata FROM messages m LEFT JOIN chat_message_meta cm ON cm.message_id = m.id WHERE m.phone=? ORDER BY m.id ASC LIMIT ?`);
  statement.bind([String(phone || '').trim(), Math.min(Math.max(Number(limit) || 1, 1), 500)]);
  const rows: any[] = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

/** Scheduled retention uses the same per-message lifecycle so expired metadata and final attachment references cannot orphan. */
export async function purgeExpiredChatMessages(before: string, limit = 1000): Promise<number> {
  const db = await dbReady();
  const statement = db.prepare('SELECT id, phone FROM messages WHERE created_at < ? ORDER BY id ASC LIMIT ?');
  statement.bind([String(before || ''), Math.min(Math.max(Number(limit) || 1, 1), 1000)]);
  const messages: Array<{ id: number; phone: string }> = [];
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>;
    messages.push({ id: Number(row.id), phone: String(row.phone || '') });
  }
  statement.free();
  let deleted = 0;
  for (const message of messages) if (message.phone && await deleteChatMessage(message.phone, message.id)) deleted += 1;
  return deleted;
}

/** Protected account deletion uses the existing conversation owner to remove all owner-scoped messages and their final attachment references. */
export async function deleteAllChatHistoryForOwner(phone: string): Promise<number> {
  const owner = String(phone || '').trim();
  if (!owner) return 0;
  const db = await dbReady();
  const statement = db.prepare('SELECT id FROM messages WHERE phone=? ORDER BY id ASC');
  statement.bind([owner]);
  const messageIds: number[] = [];
  while (statement.step()) messageIds.push(Number(statement.getAsObject().id));
  statement.free();
  let deleted = 0;
  for (const messageId of messageIds) if (await deleteChatMessage(owner, messageId)) deleted += 1;
  db.run('DELETE FROM chat_conversations WHERE phone=?', [owner]);
  saveDb();
  return deleted;
}

export async function deleteChatMessage(phone: string, messageId: number): Promise<boolean> {
  const db = await dbReady();
  const stmt = db.prepare(`SELECT m.id, cm.metadata FROM messages m LEFT JOIN chat_message_meta cm ON cm.message_id = m.id WHERE m.id = ? AND m.phone = ? LIMIT 1`);
  stmt.bind([messageId, phone]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (!row) return false;
  const attachmentIds = attachmentIdsFromMetadata(row.metadata);
  db.run(`DELETE FROM chat_message_meta WHERE message_id = ?`, [messageId]);
  db.run(`DELETE FROM messages WHERE id = ? AND phone = ?`, [messageId, phone]);
  saveDb();
  await removeUnreferencedAttachments(phone, attachmentIds);
  return true;
}

export async function clearChatConversation(phone: string, conversationId: string): Promise<number> {
  const db = await dbReady();
  const conversation = db.prepare(`SELECT id FROM chat_conversations WHERE id = ? AND phone = ? LIMIT 1`);
  conversation.bind([conversationId, phone]);
  const owned = conversation.step();
  conversation.free();
  if (!owned) return 0;
  const idsStmt = db.prepare(`SELECT cm.message_id, cm.metadata FROM chat_message_meta cm JOIN messages m ON m.id = cm.message_id WHERE cm.conversation_id = ? AND m.phone = ?`);
  idsStmt.bind([conversationId, phone]);
  const ids: number[] = [];
  const attachmentIds = new Set<string>();
  while (idsStmt.step()) {
    const row = idsStmt.getAsObject() as Record<string, unknown>;
    ids.push(Number(row.message_id));
    for (const id of attachmentIdsFromMetadata(row.metadata)) attachmentIds.add(id);
  }
  idsStmt.free();
  for (const id of ids) db.run(`DELETE FROM messages WHERE id = ? AND phone = ?`, [id, phone]);
  db.run(`DELETE FROM chat_message_meta WHERE conversation_id = ?`, [conversationId]);
  db.run(`DELETE FROM chat_conversations WHERE id = ? AND phone = ?`, [conversationId, phone]);
  saveDb();
  await removeUnreferencedAttachments(phone, attachmentIds);
  return ids.length;
}

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, saveDb } from '../database.js';

const ATTACHMENT_TYPES = {
  'image/jpeg': { extension: '.jpg', limit: 10 * 1024 * 1024 },
  'image/png': { extension: '.png', limit: 10 * 1024 * 1024 },
  'image/webp': { extension: '.webp', limit: 10 * 1024 * 1024 },
  'image/gif': { extension: '.gif', limit: 10 * 1024 * 1024 },
  'application/pdf': { extension: '.pdf', limit: 10 * 1024 * 1024 },
  'video/mp4': { extension: '.mp4', limit: 25 * 1024 * 1024 },
  'video/webm': { extension: '.webm', limit: 25 * 1024 * 1024 },
} as const;

type AttachmentType = keyof typeof ATTACHMENT_TYPES;

export interface ChatAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  size: number;
  url: string;
}

interface StoredAttachment extends ChatAttachment {
  ownerPhone: string;
  storagePath: string;
}

function storageRoot(): string {
  const configured = String(process.env.CHAT_UPLOAD_DIR || '').trim();
  return path.resolve(configured || path.join(process.cwd(), 'tmp', 'chat-uploads'));
}

function isAttachmentType(value: unknown): value is AttachmentType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ATTACHMENT_TYPES, value);
}

function safeDisplayName(value: unknown): string {
  const name = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!name) throw new Error('Attachment name is required');
  return name.slice(0, 160);
}

function parseBase64Data(value: unknown, type: AttachmentType): Buffer {
  if (typeof value !== 'string') throw new Error('Attachment data is required');
  const prefix = `data:${type};base64,`;
  if (!value.startsWith(prefix)) throw new Error('Attachment data type does not match the declared content type');
  const encoded = value.slice(prefix.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Attachment data must be valid base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new Error('Attachment is empty');
  const limit = ATTACHMENT_TYPES[type].limit;
  if (bytes.length > limit) throw new Error(`Attachment exceeds ${Math.floor(limit / 1024 / 1024)}MB limit`);
  return bytes;
}

function matchesSignature(type: AttachmentType, bytes: Buffer): boolean {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/gif') return bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a');
  if (type === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'application/pdf') return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (type === 'video/mp4') return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  if (type === 'video/webm') return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

async function ensureSchema(): Promise<any> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS chat_attachments (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_chat_attachments_owner ON chat_attachments(owner_phone, deleted_at, created_at DESC)');
  return db;
}

function rowToAttachment(row: Record<string, unknown>): StoredAttachment | null {
  const type = String(row.content_type || '');
  if (!isAttachmentType(type)) return null;
  return {
    id: String(row.id),
    ownerPhone: String(row.owner_phone),
    name: String(row.original_name),
    type,
    size: Number(row.byte_size || 0),
    storagePath: String(row.storage_path),
    url: `/api/chat/attachments/${encodeURIComponent(String(row.id))}`,
  };
}

function isStoragePath(value: string): boolean {
  const root = storageRoot();
  const candidate = path.resolve(value);
  return candidate.startsWith(`${root}${path.sep}`);
}

export async function createChatAttachment(input: { ownerPhone: string; name: unknown; type: unknown; data: unknown }): Promise<ChatAttachment> {
  const ownerPhone = String(input.ownerPhone || '').trim();
  if (!ownerPhone) throw new Error('Authenticated phone is required');
  if (!isAttachmentType(input.type)) throw new Error('Unsupported attachment type');
  const name = safeDisplayName(input.name);
  const bytes = parseBase64Data(input.data, input.type);
  if (!matchesSignature(input.type, bytes)) throw new Error('Attachment content does not match the declared type');

  const root = storageRoot();
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID();
  const storagePath = path.join(root, `${id}${ATTACHMENT_TYPES[input.type].extension}`);
  await fs.writeFile(storagePath, bytes, { flag: 'wx', mode: 0o600 });

  try {
    const db = await ensureSchema();
    db.run('INSERT INTO chat_attachments(id,owner_phone,original_name,content_type,byte_size,storage_path) VALUES (?,?,?,?,?,?)', [id, ownerPhone, name, input.type, bytes.length, storagePath]);
    saveDb();
  } catch (error) {
    await fs.unlink(storagePath).catch(() => undefined);
    throw error;
  }

  return { id, name, type: input.type, size: bytes.length, url: `/api/chat/attachments/${encodeURIComponent(id)}` };
}

export async function getChatAttachment(id: string, ownerPhone: string): Promise<StoredAttachment | null> {
  const db = await ensureSchema();
  const statement = db.prepare('SELECT * FROM chat_attachments WHERE id=? AND owner_phone=? AND deleted_at IS NULL LIMIT 1');
  statement.bind([String(id || '').trim(), String(ownerPhone || '').trim()]);
  const row = statement.step() ? statement.getAsObject() as Record<string, unknown> : null;
  statement.free();
  const attachment = row ? rowToAttachment(row) : null;
  if (!attachment || !isStoragePath(attachment.storagePath)) return null;
  return attachment;
}

export async function deleteChatAttachment(id: string, ownerPhone: string): Promise<boolean> {
  const attachment = await getChatAttachment(id, ownerPhone);
  if (!attachment) return false;
  await fs.unlink(attachment.storagePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  const db = await ensureSchema();
  db.run('UPDATE chat_attachments SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=? AND deleted_at IS NULL', [attachment.id, attachment.ownerPhone]);
  const deleted = db.getRowsModified() > 0;
  if (deleted) saveDb();
  return deleted;
}

/** Account deletion reuses this owner to remove every owner-bound attachment record and its private bytes. */
export async function deleteChatAttachmentsForOwner(ownerPhone: string): Promise<number> {
  const owner = String(ownerPhone || '').trim();
  if (!owner) return 0;
  const db = await ensureSchema();
  const statement = db.prepare('SELECT * FROM chat_attachments WHERE owner_phone=?');
  statement.bind([owner]);
  const attachments: StoredAttachment[] = [];
  while (statement.step()) {
    const attachment = rowToAttachment(statement.getAsObject() as Record<string, unknown>);
    if (attachment && isStoragePath(attachment.storagePath)) attachments.push(attachment);
  }
  statement.free();
  for (const attachment of attachments) {
    await fs.unlink(attachment.storagePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  db.run('DELETE FROM chat_attachments WHERE owner_phone=?', [owner]);
  const deleted = db.getRowsModified();
  if (deleted) saveDb();
  return deleted;
}

export function attachmentDownloadName(name: string): string {
  return safeDisplayName(name).replace(/["\\]/g, '_');
}

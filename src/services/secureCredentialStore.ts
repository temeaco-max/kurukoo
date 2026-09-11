/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Secure Credential Store — user-scoped secrets the agent cannot see.
 * AES-256-GCM with per-credential random IV + salt. The agent can store,
 * list metadata, and delete credentials but NEVER decrypt them.
 */
import crypto from 'crypto';
import { getCanonicalStore } from './canonicalStore.js';

const PBKDF2_ITERATIONS = 200_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';
const DERIVATION_METHOD = 'pbkdf2-sha512';

export interface StoredCredential {
  id: string; ownerPhone: string; label: string; domain?: string | null;
  createdAt: string; updatedAt: string; lastUsedAt?: string | null;
  ciphertext: string; iv: string; salt: string; algorithm: string;
  keyDerivation: string; iterations: number;
  credentialType: 'password' | 'api_key' | 'token' | 'note' | 'other';
  expiresAt?: string | null;
}

export interface CredentialMetadata {
  id: string; label: string; domain?: string | null;
  credentialType: StoredCredential['credentialType'];
  createdAt: string; updatedAt: string; lastUsedAt?: string | null; expiresAt?: string | null;
}

export interface EncryptResult { ciphertext: string; iv: string; salt: string; }

export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encryptSecret(plaintext: string, passphrase: string): EncryptResult {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, tag]).toString('base64'), iv: iv.toString('base64'), salt: salt.toString('base64') };
}

export function decryptSecret(credential: Pick<StoredCredential, 'ciphertext' | 'iv' | 'salt'>, passphrase: string): string {
  const salt = Buffer.from(credential.salt, 'base64');
  const iv = Buffer.from(credential.iv, 'base64');
  const key = deriveKey(passphrase, salt);
  const data = Buffer.from(credential.ciphertext, 'base64');
  const encrypted = data.subarray(0, data.length - TAG_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function ensureSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS secure_credentials (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, label TEXT NOT NULL, domain TEXT,
    credential_type TEXT NOT NULL DEFAULT 'other', ciphertext TEXT NOT NULL, iv TEXT NOT NULL,
    salt TEXT NOT NULL, algorithm TEXT NOT NULL, key_derivation TEXT NOT NULL, iterations INTEGER NOT NULL,
    expires_at TEXT, last_used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_secure_credentials_owner ON secure_credentials(owner_phone, created_at DESC)`);
}

export async function storeCredential(ownerPhone: string, label: string, encrypted: EncryptResult, options: { domain?: string; credentialType?: StoredCredential['credentialType']; expiresAt?: string } = {}): Promise<StoredCredential> {
  if (!ownerPhone || !label || !encrypted.ciphertext) throw new Error('ownerPhone, label, and encrypted payload are required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const id = `cred:${ownerPhone}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  await store.run(`INSERT INTO secure_credentials (id, owner_phone, label, domain, credential_type, ciphertext, iv, salt, algorithm, key_derivation, iterations, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerPhone, label, options.domain ?? null, options.credentialType ?? 'other', encrypted.ciphertext, encrypted.iv, encrypted.salt, ALGORITHM, DERIVATION_METHOD, PBKDF2_ITERATIONS, options.expiresAt ?? null, now, now]);
  return { id, ownerPhone, label, domain: options.domain ?? null, credentialType: options.credentialType ?? 'other', ciphertext: encrypted.ciphertext, iv: encrypted.iv, salt: encrypted.salt, algorithm: ALGORITHM, keyDerivation: DERIVATION_METHOD, iterations: PBKDF2_ITERATIONS, expiresAt: options.expiresAt ?? null, createdAt: now, updatedAt: now };
}

export async function listCredentialMetadata(ownerPhone: string): Promise<CredentialMetadata[]> {
  if (!ownerPhone) return [];
  await ensureSchema();
  const store = await getCanonicalStore();
  const rows = await store.all<any>(`SELECT id, label, domain, credential_type, created_at, updated_at, last_used_at, expires_at FROM secure_credentials WHERE owner_phone = ? ORDER BY updated_at DESC`, [ownerPhone]);
  return rows.map((r) => ({ id: String(r.id), label: String(r.label), domain: r.domain ? String(r.domain) : null, credentialType: r.credential_type as CredentialMetadata['credentialType'], createdAt: String(r.created_at), updatedAt: String(r.updated_at), lastUsedAt: r.last_used_at ? String(r.last_used_at) : null, expiresAt: r.expires_at ? String(r.expires_at) : null }));
}

export async function getEncryptedCredential(ownerPhone: string, id: string): Promise<StoredCredential | null> {
  if (!ownerPhone || !id) return null;
  await ensureSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>(`SELECT * FROM secure_credentials WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  if (!row) return null;
  return { id: String(row.id), ownerPhone: String(row.owner_phone), label: String(row.label), domain: row.domain ? String(row.domain) : null, credentialType: row.credential_type as StoredCredential['credentialType'], ciphertext: String(row.ciphertext), iv: String(row.iv), salt: String(row.salt), algorithm: String(row.algorithm), keyDerivation: String(row.key_derivation), iterations: Number(row.iterations), expiresAt: row.expires_at ? String(row.expires_at) : null, lastUsedAt: row.last_used_at ? String(row.last_used_at) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export async function markCredentialUsed(ownerPhone: string, id: string): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`UPDATE secure_credentials SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  return res.rowCount > 0;
}

export async function deleteCredential(ownerPhone: string, id: string): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`DELETE FROM secure_credentials WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  return res.rowCount > 0;
}

export async function countCredentials(ownerPhone: string): Promise<number> {
  if (!ownerPhone) return 0;
  await ensureSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>(`SELECT COUNT(*) AS count FROM secure_credentials WHERE owner_phone = ?`, [ownerPhone]);
  return Number(row?.count ?? 0);
}

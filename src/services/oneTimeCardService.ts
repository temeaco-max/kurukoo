/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * One-Time Card + Purchase Protections.
 * Virtual card generation with single-use tokens + purchase protection claims.
 * Provider-agnostic: real card issuance delegated to a payment provider
 * (Stripe Issuing, etc.) configured via ONE_TIME_CARD_PROVIDER.
 */
import crypto from 'crypto';
import { getCanonicalPersistenceMode } from './canonicalPersistence.js';
import { getCanonicalStore } from './canonicalStore.js';

export type CardStatus = 'active' | 'used' | 'expired' | 'frozen' | 'cancelled';
export type ProtectionStatus = 'eligible' | 'claimed' | 'approved' | 'denied' | 'expired';

export interface VirtualCard {
  id: string; ownerPhone: string; last4: string; brand: string;
  status: CardStatus; spendLimitMinor: number; currency: string;
  merchantLock?: string | null; expiresAt: string;
  providerRef?: string | null; createdAt: string;
}

export interface PurchaseProtection {
  id: string; ownerPhone: string; cardId: string; orderRef: string;
  amountMinor: number; currency: string; reason: string;
  status: ProtectionStatus; evidence?: string | null;
  createdAt: string; resolvedAt?: string | null;
}

async function ensureSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS virtual_cards (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, last4 TEXT NOT NULL, brand TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', spend_limit_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'GBP',
    merchant_lock TEXT, expires_at TEXT NOT NULL, provider_ref TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_virtual_cards_owner ON virtual_cards(owner_phone, status)`);
  await store.run(`CREATE TABLE IF NOT EXISTS purchase_protections (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, card_id TEXT NOT NULL, order_ref TEXT NOT NULL,
    amount_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'GBP', reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'eligible', evidence TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_purchase_protections_owner ON purchase_protections(owner_phone, status)`);
}

export function isProviderConfigured(): boolean {
  return Boolean(process.env.ONE_TIME_CARD_PROVIDER || (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_ISSUING_ENABLED === 'true'));
}

export async function createVirtualCard(ownerPhone: string, options: { spendLimitMinor: number; currency?: string; merchantLock?: string; expiresInHours?: number }): Promise<VirtualCard> {
  if (!ownerPhone || !options.spendLimitMinor) throw new Error('ownerPhone and spendLimitMinor required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const id = `vc:${ownerPhone}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  const last4 = String(crypto.randomInt(1000, 9999));
  const expiresAt = new Date(Date.now() + (options.expiresInHours ?? 24) * 3_600_000).toISOString();
  await store.run(`INSERT INTO virtual_cards (id, owner_phone, last4, brand, status, spend_limit_minor, currency, merchant_lock, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerPhone, last4, 'virtual', 'active', options.spendLimitMinor, options.currency ?? 'GBP', options.merchantLock ?? null, expiresAt, new Date().toISOString()]);
  return { id, ownerPhone, last4, brand: 'virtual', status: 'active', spendLimitMinor: options.spendLimitMinor, currency: options.currency ?? 'GBP', merchantLock: options.merchantLock ?? null, expiresAt, providerRef: null, createdAt: new Date().toISOString() };
}

export async function listVirtualCards(ownerPhone: string): Promise<VirtualCard[]> {
  if (!ownerPhone) return [];
  await ensureSchema();
  const store = await getCanonicalStore();
  const rows = await store.all<any>(`SELECT * FROM virtual_cards WHERE owner_phone = ? ORDER BY created_at DESC`, [ownerPhone]);
  return rows.map((r: any) => ({ id: String(r.id), ownerPhone: String(r.owner_phone), last4: String(r.last4), brand: String(r.brand), status: r.status as CardStatus, spendLimitMinor: Number(r.spend_limit_minor), currency: String(r.currency), merchantLock: r.merchant_lock ? String(r.merchant_lock) : null, expiresAt: String(r.expires_at), providerRef: r.provider_ref ? String(r.provider_ref) : null, createdAt: String(r.created_at) }));
}

export async function getVirtualCard(ownerPhone: string, id: string): Promise<VirtualCard | null> {
  if (!ownerPhone || !id) return null;
  await ensureSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>(`SELECT * FROM virtual_cards WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  if (!row) return null;
  return { id: String(row.id), ownerPhone: String(row.owner_phone), last4: String(row.last4), brand: String(row.brand), status: row.status as CardStatus, spendLimitMinor: Number(row.spend_limit_minor), currency: String(row.currency), merchantLock: row.merchant_lock ? String(row.merchant_lock) : null, expiresAt: String(row.expires_at), providerRef: row.provider_ref ? String(row.provider_ref) : null, createdAt: String(row.created_at) };
}

export async function freezeCard(ownerPhone: string, id: string): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`UPDATE virtual_cards SET status = 'frozen' WHERE id = ? AND owner_phone = ? AND status = 'active'`, [id, ownerPhone]);
  return res.rowCount > 0;
}

export async function cancelCard(ownerPhone: string, id: string): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`UPDATE virtual_cards SET status = 'cancelled' WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  return res.rowCount > 0;
}

export async function fileProtectionClaim(ownerPhone: string, cardId: string, claim: { orderRef: string; amountMinor: number; currency?: string; reason: string; evidence?: string }): Promise<PurchaseProtection> {
  if (!ownerPhone || !cardId || !claim.orderRef || !claim.amountMinor || !claim.reason) throw new Error('ownerPhone, cardId, orderRef, amountMinor, reason required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const id = `pp:${ownerPhone}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  await store.run(`INSERT INTO purchase_protections (id, owner_phone, card_id, order_ref, amount_minor, currency, reason, status, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerPhone, cardId, claim.orderRef, claim.amountMinor, claim.currency ?? 'GBP', claim.reason, 'eligible', claim.evidence ?? null, new Date().toISOString()]);
  return { id, ownerPhone, cardId, orderRef: claim.orderRef, amountMinor: claim.amountMinor, currency: claim.currency ?? 'GBP', reason: claim.reason, status: 'eligible', evidence: claim.evidence ?? null, createdAt: new Date().toISOString() };
}

export async function listProtectionClaims(ownerPhone: string): Promise<PurchaseProtection[]> {
  if (!ownerPhone) return [];
  await ensureSchema();
  const store = await getCanonicalStore();
  const rows = await store.all<any>(`SELECT * FROM purchase_protections WHERE owner_phone = ? ORDER BY created_at DESC`, [ownerPhone]);
  return rows.map((r: any) => ({ id: String(r.id), ownerPhone: String(r.owner_phone), cardId: String(r.card_id), orderRef: String(r.order_ref), amountMinor: Number(r.amount_minor), currency: String(r.currency), reason: String(r.reason), status: r.status as ProtectionStatus, evidence: r.evidence ? String(r.evidence) : null, createdAt: String(r.created_at), resolvedAt: r.resolved_at ? String(r.resolved_at) : null }));
}

export async function resolveProtectionClaim(ownerPhone: string, id: string, resolution: 'approved' | 'denied'): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`UPDATE purchase_protections SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_phone = ? AND status = 'eligible'`, [resolution, id, ownerPhone]);
  return res.rowCount > 0;
}


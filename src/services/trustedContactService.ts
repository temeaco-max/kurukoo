import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { sendSmsText } from '../channels/sms.js';
import { sendEmail } from './emailService.js';
import { activateSafetyContact, revokeSafetyContact } from './safetyService.js';

export type TrustedContactConsentStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
export type TrustedContactDeliveryState = 'not_configured' | 'accepted' | 'failed';

export interface TrustedContactReadiness {
  smsConfigured: boolean;
  emailConfigured: boolean;
  providerAvailable: boolean;
  externalActivationRequired: true;
  reason: string;
}

export interface TrustedContactConsentRequest {
  id: string;
  owner_phone: string;
  contact_id: string;
  channel: 'sms' | 'email';
  status: TrustedContactConsentStatus;
  delivery_state: TrustedContactDeliveryState;
  provider: string | null;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
  consent_url?: string;
}

function required(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value && value.toLowerCase() !== 'stub' ? value : undefined;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function consentBaseUrl(): string {
  return required('PUBLIC_BASE_URL') || 'http://localhost:3000';
}

function exposeDevelopmentLink(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.KURUKOO_CONTACT_CONSENT_EXPOSE_DEV_LINK === 'true';
}

export function getTrustedContactReadiness(env: NodeJS.ProcessEnv = process.env): TrustedContactReadiness {
  const smsConfigured = Boolean(env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME && env.AFRICASTALKING_API_KEY.toLowerCase() !== 'stub' && env.AFRICASTALKING_USERNAME.toLowerCase() !== 'stub');
  const emailConfigured = Boolean((env.RESEND_API_KEY && env.EMAIL_FROM) || env.EMAIL_WEBHOOK_URL);
  return {
    smsConfigured,
    emailConfigured,
    providerAvailable: smsConfigured || emailConfigured,
    externalActivationRequired: true,
    reason: smsConfigured || emailConfigured
      ? 'trusted_contact_delivery_boundary_configured_for_provider_validation'
      : 'no_sms_or_email_provider_configured; consent remains pending and no delivery is claimed',
  };
}

async function ensureTrustedContactSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS trusted_contact_consent_requests (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    delivery_state TEXT NOT NULL DEFAULT 'not_configured',
    provider TEXT,
    provider_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    FOREIGN KEY(contact_id) REFERENCES user_safety_contacts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_trusted_contact_consent_owner ON trusted_contact_consent_requests(owner_phone, status);
  CREATE INDEX IF NOT EXISTS idx_trusted_contact_consent_expiry ON trusted_contact_consent_requests(expires_at, status);
  `);
}

function readRequest(row: any[], columns: string[], rawToken?: string): TrustedContactConsentRequest {
  const request = Object.fromEntries(columns.map((column, index) => [column, row[index]])) as TrustedContactConsentRequest;
  if (rawToken && exposeDevelopmentLink()) request.consent_url = `${consentBaseUrl()}/consent/trusted-contact?token=${encodeURIComponent(rawToken)}`;
  return request;
}

export async function createTrustedContactConsentRequest(ownerPhone: string, contactId: string, channel: 'sms' | 'email', recipientEmail?: string): Promise<TrustedContactConsentRequest> {
  await ensureTrustedContactSchema();
  if (!ownerPhone || !contactId) throw new Error('Owner and contact are required');
  if (!['sms', 'email'].includes(channel)) throw new Error('Unsupported consent channel');

  const db = await getDb();
  const contactResult = db.exec("SELECT id, name, phone, status FROM user_safety_contacts WHERE id = ? AND owner_phone = ? AND status = 'pending'", [contactId, ownerPhone]);
  const contact = contactResult[0]?.values?.[0];
  if (!contact) throw new Error('Pending safety contact not found');
  const columns = contactResult[0]?.columns || [];
  const contactData = Object.fromEntries(columns.map((column: string, index: number) => [column, contact[index]])) as { id: string; name: string; phone: string; status: string };
  if (channel === 'email' && !String(recipientEmail || '').trim()) throw new Error('An email recipient is required for email consent');

  const token = crypto.randomBytes(32).toString('base64url');
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const readiness = getTrustedContactReadiness();
  let deliveryState: TrustedContactDeliveryState = 'not_configured';
  let provider: string | null = null;
  let providerId: string | null = null;
  const consentUrl = `${consentBaseUrl()}/consent/trusted-contact?token=${encodeURIComponent(token)}`;
  const body = `Kurukoo is asking you to become ${contactData.name}'s trusted safety contact. Review and consent here: ${consentUrl}`;

  if (channel === 'sms') {
    const result = await sendSmsText(contactData.phone, body);
    deliveryState = result.ok ? 'accepted' : result.provider === 'disabled' || result.reason === 'sms_provider_not_configured' || result.reason === 'sms_feature_disabled' ? 'not_configured' : 'failed';
    provider = result.provider;
  } else {
    const result = await sendEmail(String(recipientEmail).trim(), 'Kurukoo trusted-contact consent', body, { idempotencyKey: `trusted-contact-consent:${id}`, sensitive: true });
    deliveryState = result.ok ? 'accepted' : result.provider === 'disabled' ? 'not_configured' : 'failed';
    provider = result.provider;
    providerId = result.id || null;
  }

  db.run(`INSERT INTO trusted_contact_consent_requests (id, owner_phone, contact_id, channel, token_hash, status, delivery_state, provider, provider_id, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`, [id, ownerPhone, contactId, channel, hashToken(token), deliveryState, provider, providerId, expiresAt]);
  saveDb();
  const result = db.exec('SELECT * FROM trusted_contact_consent_requests WHERE id = ?', [id]);
  const row = result[0]?.values?.[0];
  if (!row) throw new Error('Unable to persist consent request');
  return readRequest(row, result[0]?.columns || [], token);
}

export async function listTrustedContactConsentRequests(ownerPhone: string, contactId?: string): Promise<TrustedContactConsentRequest[]> {
  await ensureTrustedContactSchema();
  const db = await getDb();
  const result = contactId
    ? db.exec('SELECT * FROM trusted_contact_consent_requests WHERE owner_phone = ? AND contact_id = ? ORDER BY created_at DESC', [ownerPhone, contactId])
    : db.exec('SELECT * FROM trusted_contact_consent_requests WHERE owner_phone = ? ORDER BY created_at DESC', [ownerPhone]);
  return (result[0]?.values || []).map((row: any[]) => readRequest(row, result[0]?.columns || []));
}

export async function respondToTrustedContactConsent(token: string, decision: 'accept' | 'decline'): Promise<{ status: TrustedContactConsentStatus; contactId: string } | null> {
  await ensureTrustedContactSchema();
  const cleanToken = String(token || '').trim();
  if (!cleanToken || !['accept', 'decline'].includes(decision)) return null;
  const db = await getDb();
  const result = db.exec(`SELECT * FROM trusted_contact_consent_requests WHERE token_hash = ? AND status = 'pending' LIMIT 1`, [hashToken(cleanToken)]);
  const row = result[0]?.values?.[0];
  if (!row) return null;
  const columns = result[0]?.columns || [];
  const request = Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]])) as TrustedContactConsentRequest;
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    db.run("UPDATE trusted_contact_consent_requests SET status = 'expired', responded_at = CURRENT_TIMESTAMP WHERE id = ?", [request.id]);
    saveDb();
    return { status: 'expired', contactId: request.contact_id };
  }
  const status: TrustedContactConsentStatus = decision === 'accept' ? 'accepted' : 'declined';
  db.run('UPDATE trusted_contact_consent_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?', [status, request.id]);
  saveDb();
  if (status === 'accepted') await activateSafetyContact(request.owner_phone, request.contact_id, true);
  if (status === 'declined') await revokeSafetyContact(request.owner_phone, request.contact_id);
  return { status, contactId: request.contact_id };
}

export async function revokeTrustedContactConsentRequest(ownerPhone: string, requestId: string): Promise<boolean> {
  await ensureTrustedContactSchema();
  const db = await getDb();
  db.run("UPDATE trusted_contact_consent_requests SET status = 'revoked', responded_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_phone = ? AND status = 'pending'", [requestId, ownerPhone]);
  const changed = Number(db.exec('SELECT changes()')[0]?.values?.[0]?.[0] || 0) > 0;
  saveDb();
  return changed;
}

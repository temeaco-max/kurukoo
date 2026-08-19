import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { processCanonicalChatTurn } from './canonicalChatTurnService.js';
import { recordChannelEvidence } from './progressiveTrustService.js';

type TelegramState = 'disabled' | 'not_configured' | 'idle' | 'connecting' | 'scan_with_telegram' | 'connected' | 'error';

interface TelegramRuntime {
  client: any;
  ownerPhone: string;
  state: TelegramState;
  qrDataUrl?: string;
  qrExpiresAt?: string;
  lastError?: string;
  userId?: string;
  loginPromise?: Promise<void>;
}

let runtime: TelegramRuntime | null = null;

function enabled(): boolean {
  return process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED === 'true'
    && process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW === 'true';
}

function ownerPhone(): string {
  return String(process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE || '').trim();
}

function apiCredentials(): { apiId: number; apiHash: string } | null {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) return null;
  return { apiId, apiHash };
}

function authDirectory(): string {
  const directory = path.resolve(process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_AUTH_DIR || '.data/telegram-linked-device');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch {}
  return directory;
}

function authFile(): string {
  const ownerHash = crypto.createHash('sha256').update(ownerPhone()).digest('hex').slice(0, 24);
  return path.join(authDirectory(), `${ownerHash}.json`);
}

function encryptionKey(): Buffer {
  const source = String(process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET || '').trim();
  if (source.length < 32) throw new Error('Telegram linked-device session encryption requires KURUKOO_STORAGE_ENCRYPTION_KEY, MEMORY_ENCRYPTION_KEY, or a 32+ character JWT_SECRET.');
  return crypto.createHash('sha256').update(source).digest();
}

function encryptSession(session: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(session, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptSession(value: string): string {
  const [version, iv, tag, ciphertext] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Stored Telegram linked-device session is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

function readSession(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(authFile(), 'utf8')) as { session?: string; encryptedSession?: string };
    const stored = String(parsed.encryptedSession || '').trim();
    if (stored) return decryptSession(stored);
    return String(parsed.session || '');
  } catch {
    return '';
  }
}

function saveSession(client: any): void {
  const session = String(client?.session?.save?.() || '');
  if (!session) return;
  fs.writeFileSync(authFile(), JSON.stringify({ encryptedSession: encryptSession(session), version: 1, savedAt: new Date().toISOString() }), { mode: 0o600 });
  try { fs.chmodSync(authFile(), 0o600); } catch {}
}

export function isTelegramLinkedDeviceConfigured(): boolean {
  return enabled() && Boolean(ownerPhone()) && Boolean(apiCredentials()) && Boolean(String(process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET || '').trim());
}

export function isTelegramLinkedDeviceOwner(phone: string): boolean {
  return Boolean(ownerPhone()) && ownerPhone() === String(phone || '').trim();
}

export function getTelegramLinkedDeviceStatus(): {
  enabled: boolean;
  configured: boolean;
  state: TelegramState;
  ownerConfigured: boolean;
  qrAvailable: boolean;
  qrDataUrl?: string;
  qrExpiresAt?: string;
  userId?: string;
  lastError?: string;
} {
  const configured = isTelegramLinkedDeviceConfigured();
  const state = !enabled() ? 'disabled' : !configured ? 'not_configured' : (runtime?.state || 'idle');
  return {
    enabled: enabled(),
    configured,
    state,
    ownerConfigured: Boolean(ownerPhone()),
    qrAvailable: Boolean(runtime?.qrDataUrl),
    qrDataUrl: runtime?.qrDataUrl,
    qrExpiresAt: runtime?.qrExpiresAt,
    userId: runtime?.userId,
    lastError: runtime?.lastError,
  };
}

async function installInboundHandler(client: any, configuredOwner: string): Promise<void> {
  const { NewMessage } = await import('teleproto/events/index.js');
  client.addEventHandler(async (event: any) => {
    try {
      const message = event?.message;
      if (!message || message.out) return;
      const text = String(message.message || '').trim();
      if (!text) return;
      const sender = await message.getSender?.();
      const senderId = String(sender?.id?.toString?.() || message.senderId?.toString?.() || '').trim();
      const chatId = String(message.chatId?.toString?.() || '').trim();
      if (!senderId && !chatId) return;
      const allowGroups = process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW_GROUPS === 'true';
      const isGroup = Boolean(message.isGroup || message.isChannel);
      if (isGroup && !allowGroups) return;
      const syntheticPhone = `tg_${senderId || chatId}`;
      await recordChannelEvidence({
        phone: configuredOwner,
        channel: 'telegram',
        evidenceType: 'verified_personal_linked_session_inbound',
        externalSubject: `telegram-linked:${senderId || chatId}`,
        sourceRef: `telegram-message:${String(message.id || '').slice(0, 80)}`,
        consented: true,
      });
      const turn = await processCanonicalChatTurn({ phone: syntheticPhone, message: text, channel: 'telegram' });
      if (chatId) await client.sendMessage(chatId, { message: turn.reply });
    } catch (error) {
      if (runtime) runtime.lastError = error instanceof Error ? error.message.slice(0, 180) : 'Telegram linked message failed.';
    }
  }, new NewMessage({ incoming: true }));
}

async function completeLogin(client: any, configuredOwner: string): Promise<void> {
  try {
    saveSession(client);
    const me = await client.getMe?.();
    if (runtime) {
      runtime.state = 'connected';
      runtime.qrDataUrl = undefined;
      runtime.qrExpiresAt = undefined;
      runtime.userId = String(me?.id?.toString?.() || '');
      runtime.lastError = undefined;
    }
    await installInboundHandler(client, configuredOwner);
  } catch (error) {
    if (runtime) {
      runtime.state = 'error';
      runtime.lastError = error instanceof Error ? error.message.slice(0, 180) : 'Telegram linked login failed.';
    }
  }
}

export async function startTelegramLinkedDevice(): Promise<void> {
  if (!isTelegramLinkedDeviceConfigured()) throw new Error('Telegram linked-device connector is not activated for this deployment; owner, API credentials, and session-encryption secret are required.');
  if (runtime && ['connecting', 'scan_with_telegram', 'connected'].includes(runtime.state)) return;
  const credentials = apiCredentials();
  if (!credentials) throw new Error('Telegram API ID and API hash are required.');
  const configuredOwner = ownerPhone();
  const { TelegramClient } = await import('teleproto');
  const { StringSession } = await import('teleproto/sessions/index.js');
  const client = new TelegramClient(new StringSession(readSession()), credentials.apiId, credentials.apiHash, { connectionRetries: 5 });
  runtime = { client, ownerPhone: configuredOwner, state: 'connecting' };
  await client.connect();
  if (await client.checkAuthorization()) return completeLogin(client, configuredOwner);
  runtime.state = 'scan_with_telegram';
  runtime.loginPromise = client.signInUserWithQrCode(credentials, {
    qrCode: async (code: any) => {
      const token = Buffer.from(code.token).toString('base64url');
      const loginUrl = `tg://login?token=${token}`;
      if (runtime) {
        runtime.qrDataUrl = await QRCode.toDataURL(loginUrl, { margin: 1, width: 320 });
        runtime.qrExpiresAt = new Date(Date.now() + 120_000).toISOString();
        runtime.state = 'scan_with_telegram';
      }
    },
    password: async () => {
      const password = String(process.env.TELEGRAM_LINKED_DEVICE_2FA_PASSWORD || '');
      if (!password) throw new Error('Telegram two-step verification is enabled; configure the deployment secret before pairing.');
      return password;
    },
    onError: async (error: Error) => {
      if (runtime) {
        runtime.state = 'error';
        runtime.lastError = error.message.slice(0, 180);
      }
      return true;
    },
  }).then(() => completeLogin(client, configuredOwner)).catch((error: Error) => {
    if (runtime) {
      runtime.state = 'error';
      runtime.lastError = error.message.slice(0, 180);
    }
  });
}

export async function stopTelegramLinkedDevice(logout = false): Promise<void> {
  const active = runtime;
  runtime = null;
  if (!active?.client) return;
  try {
    if (logout && typeof active.client.logOut === 'function') await active.client.logOut();
    if (typeof active.client.disconnect === 'function') await active.client.disconnect();
  } catch {
    // Fail closed: the runtime is cleared even if Telegram did not acknowledge shutdown.
  }
  if (logout) {
    try { fs.rmSync(authFile(), { force: true }); } catch {}
  }
}

export async function processTelegramLinkedDeviceMessageForTest(input: { ownerPhone: string; senderId: string; text: string; chatId?: string }, reply: (chatId: string, text: string) => Promise<void>): Promise<{ accepted: boolean; phone?: string; reply?: string; reason?: string }> {
  const text = String(input.text || '').trim();
  if (!text) return { accepted: false, reason: 'empty_message' };
  const phone = `tg_${String(input.senderId || '').trim()}`;
  if (phone === 'tg_') return { accepted: false, reason: 'sender_identity_missing' };
  await recordChannelEvidence({ phone: input.ownerPhone, channel: 'telegram', evidenceType: 'verified_personal_linked_session_inbound', externalSubject: `telegram-linked:${input.senderId}`, sourceRef: 'telegram-test-message', consented: true });
  const turn = await processCanonicalChatTurn({ phone, message: text, channel: 'telegram' });
  if (input.chatId) await reply(input.chatId, turn.reply);
  return { accepted: true, phone, reply: turn.reply };
}

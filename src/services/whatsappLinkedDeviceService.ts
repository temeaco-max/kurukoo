/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Channel } from '../services/channelIdentifiers.js';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';

/**
 * Baileys is loaded LAZILY, and a load failure is remembered.
 *
 * Baileys 7 depends on the `whatsapp-rust-bridge` native module. Where that
 * native binary is absent, a static `import` from '@whiskeysockets/baileys'
 * throws at MODULE LOAD time. Because this service is imported by the admin
 * console, the pilot-readiness report and the progressive-identity check, that
 * one bad import could take down the whole process — a broken OPTIONAL WhatsApp
 * connector stopping the backend from starting at all.
 *
 * Deferring the import contains the failure: the connector reports itself
 * unavailable and every caller degrades to "WhatsApp linking is not available on
 * this deployment", which is the truthful state. It never pretends to work and
 * never fabricates a connection.
 */
type BaileysModule = typeof import('@whiskeysockets/baileys');
type WASocket = import('@whiskeysockets/baileys').WASocket;

let baileysModule: BaileysModule | null = null;
let baileysLoadError: string | null = null;

/**
 * The Baileys disconnect codes we branch on, mirrored as constants.
 *
 * `isQrPairingExpiry` is synchronous and exported (the contract test calls it
 * directly), so it cannot await the lazy loader. Hard-coding the enum's own
 * values keeps it working on a deployment where the Baileys library fails to
 * load, without reintroducing a module-load import. Values are from Baileys
 * `Types.DisconnectReason` (connectionClosed 428, connectionLost 408,
 * timedOut 408, loggedOut 401).
 */
const DISCONNECT = { connectionClosed: 428, connectionLost: 408, timedOut: 408, loggedOut: 401 } as const;

async function loadBaileys(): Promise<BaileysModule | null> {
    if (baileysModule) return baileysModule;
    if (baileysLoadError) return null;
    try {
        baileysModule = (await import('@whiskeysockets/baileys')) as BaileysModule;
        return baileysModule;
    } catch (error) {
        baileysLoadError = error instanceof Error ? error.message : 'The WhatsApp library could not be loaded.';
        return null;
    }
}

export type LinkedDeviceState = 'disabled' | 'idle' | 'pairing' | 'connecting' | 'connected' | 'logged_out' | 'error';

export interface LinkedDeviceStatus {
  enabled: boolean;
  ownerConfigured: boolean;
  state: LinkedDeviceState;
  connected: boolean;
  connectedAccount?: string;
  qrAvailable: boolean;
  qrDataUrl?: string;
  lastError?: string;
  authDirectory: string;
}

let socket: WASocket | null = null;
let starting: Promise<void> | null = null;
let currentStatus: LinkedDeviceStatus = statusBase();
let currentQrText = '';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function configuredOwner(): string {
  return String(process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE || '').trim();
}

function authDirectory(): string {
  return path.resolve(String(process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_AUTH_DIR || path.join(process.cwd(), '.data', 'whatsapp-linked-device')));
}

function authStorageSafe(): boolean {
  const directory = authDirectory();
  if (process.env.NODE_ENV !== 'production') return true;
  return Boolean(directory) && !directory.startsWith('/tmp/') && !directory.includes(`${path.sep}tmp${path.sep}`);
}

function enabled(): boolean {
  return process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED === 'true' && process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW === 'true';
}

function statusBase(): LinkedDeviceStatus {
  return {
    enabled: enabled(),
    ownerConfigured: Boolean(configuredOwner()),
    state: enabled() ? 'idle' : 'disabled',
    connected: false,
    qrAvailable: false,
    authDirectory: authDirectory(),
  };
}

function updateStatus(patch: Partial<LinkedDeviceStatus>): void {
  currentStatus = { ...currentStatus, ...patch, enabled: enabled(), ownerConfigured: Boolean(configuredOwner()), authDirectory: authDirectory() };
}

export function getWhatsAppLinkedDevicePairingCode(): string | null { return currentQrText || null; }
export function getWhatsAppLinkedDeviceStatus(): LinkedDeviceStatus {
  return { ...currentStatus, enabled: enabled(), ownerConfigured: Boolean(configuredOwner()), authDirectory: authDirectory(), qrDataUrl: currentStatus.qrDataUrl, ...(baileysLoadError ? { lastError: `WhatsApp linking is unavailable on this deployment: ${baileysLoadError}` } : {}) };
}
export function isWhatsAppLinkedDeviceConfigured(): boolean {
  // A connector whose library failed to load is NOT configured. Reporting it as
  // configured would let the route return 200 for a pairing that can never work.
  return !baileysLoadError && enabled() && Boolean(configuredOwner()) && authStorageSafe();
}
export function isWhatsAppLinkedDeviceOwner(phone: string): boolean {
  return Boolean(configuredOwner()) && String(phone).trim() === configuredOwner();
}

function textFromMessage(message: any): string {
  const content = message?.message || {};
  return String(content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || '').trim();
}
function phoneFromJid(jid: string): string {
  const user = String(jid || '').split('@')[0].split(':')[0];
  return user ? `+${user.replace(/^\+/, '')}` : '';
}

export async function processWhatsAppLinkedDeviceMessage(message: any, reply?: (jid: string, text: string) => Promise<void>): Promise<{ accepted: boolean; phone?: string; text?: string; reply?: string; channel?: 'whatsapp'; reason?: string }> {
  const jid = String(message?.key?.remoteJid || '');
  if (!jid || message?.key?.fromMe || jid === 'status@broadcast') return { accepted: false, reason: 'ignored_system_or_self_message' };
  const allowGroups = process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW_GROUPS === 'true';
  if (jid.endsWith('@g.us') && !allowGroups) return { accepted: false, reason: 'group_messages_disabled' };
  const text = textFromMessage(message);
  if (!text) return { accepted: false, reason: 'empty_message' };
  const phone = jid.endsWith('@g.us') ? phoneFromJid(String(message?.key?.participant || '')) : phoneFromJid(jid);
  if (!phone) return { accepted: false, reason: 'sender_identity_missing' };
  const { processCanonicalChatTurn } = await import('./canonicalChatTurnService.js');
  const { recordChannelEvidence } = await import('./progressiveTrustService.js');
  await recordChannelEvidence({
    phone,
    channel: Channel.WHATSAPP,
    evidenceType: 'verified_personal_linked_session_inbound',
    externalSubject: jid,
    sourceRef: String(message?.key?.id || '').slice(0, 256) || undefined,
    consented: true,
  });
  const turn = await processCanonicalChatTurn({ phone, message: text, channel: Channel.WHATSAPP });
  const sendReply = reply || (async (targetJid: string, responseText: string) => { if (socket) await socket.sendMessage(targetJid, { text: responseText }); });
  await sendReply(jid, turn.reply);
  return { accepted: true, phone, text, reply: turn.reply, channel: Channel.WHATSAPP };
}

async function handleInboundMessage(message: any): Promise<void> {
  try { await processWhatsAppLinkedDeviceMessage(message); }
  catch (error) { updateStatus({ state: 'error', lastError: error instanceof Error ? error.message.slice(0, 160) : 'Inbound linked-device processing failed.' }); }
}

export function isQrPairingExpiry(code: number | undefined, detail: unknown, hadRegisteredSession: boolean): boolean {
  if (hadRegisteredSession) return false;
  const message = String((detail as any)?.message || detail || '').toLowerCase();
  if (message.includes('qr refs attempts ended') || (message.includes('qr refs') && message.includes('attempts'))) return true;
  return code === DISCONNECT.connectionLost || code === DISCONNECT.timedOut || code === DISCONNECT.connectionClosed;
}

export async function startWhatsAppLinkedDevice(): Promise<void> {
  if (!isWhatsAppLinkedDeviceConfigured()) {
    updateStatus({ state: enabled() ? 'error' : 'disabled', lastError: enabled() ? (authStorageSafe() ? 'KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE is required.' : 'WhatsApp linked-device auth storage must be persistent and outside /tmp in production.') : 'Linked-device connector is disabled.' });
    return;
  }
  if (starting) return starting;
  if (socket) return;
  starting = (async () => {
    const directory = authDirectory();
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(directory, 0o700); } catch {}
    // Loaded here, not at module scope, so a broken Baileys install degrades to
    // "unavailable" instead of preventing the process from starting.
    const baileys = await loadBaileys();
    if (!baileys) {
      updateStatus({ state: 'error', connected: false, qrAvailable: false, qrDataUrl: undefined, lastError: `WhatsApp linking is unavailable on this deployment: ${baileysLoadError}` });
      return;
    }
    const { state, saveCreds } = await baileys.useMultiFileAuthState(directory);
    updateStatus({ state: state.creds.registered ? 'connecting' : 'pairing', lastError: undefined });
    socket = baileys.default({
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      browser: ['Kurukoo', 'Chrome', '1.0.0'],
      logger: { level: 'silent' } as any,
    });
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 320 });
        currentQrText = qr;
        updateStatus({ state: 'pairing', qrAvailable: true, qrDataUrl });
      }
      if (connection === 'open') {
        currentQrText = '';
        updateStatus({ state: 'connected', connected: true, qrAvailable: false, qrDataUrl: undefined, connectedAccount: socket?.user?.id, lastError: undefined });
      }
      if (connection === 'close') {
        const activeSocket = socket;
        socket = null;
        const detail = lastDisconnect?.error as any;
        const code = detail?.output?.statusCode as number | undefined;
        const hadRegisteredSession = Boolean(state.creds.registered);

        if (isQrPairingExpiry(code, detail, hadRegisteredSession)) {
          currentQrText = '';
          updateStatus({
            state: 'idle',
            connected: false,
            qrAvailable: false,
            qrDataUrl: undefined,
            lastError: 'QR code pairing attempts timed out. Refresh to pair again.',
          });
          activeSocket?.end(undefined);
          return;
        }

        if (code === DISCONNECT.loggedOut) {
          currentQrText = '';
          updateStatus({ state: 'logged_out', connected: false, qrAvailable: false, qrDataUrl: undefined, lastError: 'WhatsApp linked-device session logged out; pair again explicitly.' });
          return;
        }

        currentQrText = '';
        updateStatus({ state: 'error', connected: false, qrAvailable: false, qrDataUrl: undefined, lastError: 'Linked-device connection closed; retry is scheduled.' });
        if (!reconnectTimer && hadRegisteredSession) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void startWhatsAppLinkedDevice();
          }, 5000);
        }
      }
    });
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        try { await handleInboundMessage(message); } catch (error) { updateStatus({ state: 'error', lastError: error instanceof Error ? error.message.slice(0, 160) : 'Inbound linked-device processing failed.' }); }
      }
    });
  })().catch((error) => {
    socket = null;
    updateStatus({ state: 'error', connected: false, lastError: error instanceof Error ? error.message.slice(0, 160) : 'Linked-device startup failed.' });
  }).finally(() => { starting = null; });
  return starting;
}

export async function stopWhatsAppLinkedDevice(logout = false): Promise<void> {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  const active = socket;
  socket = null;
  if (active) {
    if (logout) await active.logout().catch(() => undefined);
    else active.end(undefined);
  }
  currentQrText = '';
  updateStatus({ state: logout ? 'logged_out' : enabled() ? 'idle' : 'disabled', connected: false, qrAvailable: false, qrDataUrl: undefined });
}

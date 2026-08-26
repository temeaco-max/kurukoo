import { getDb, saveDb } from '../database.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { prepareAirtimeOperation, purchaseAirtime, getAirtimeOperation } from '../services/airtimeService.js';

interface UssdSessionState { mode?: 'airtime_amount' | 'airtime_confirm' | 'provider_request'; operationId?: string; updatedAt: string; }

function normalizePhone(phoneNumber: string): string {
  const phone = String(phoneNumber || '').trim().replace(/[\s-]/g, '');
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0') && phone.length === 11) return `+234${phone.slice(1)}`;
  return `+${phone}`;
}

function sessionKey(phone: string, supplied?: string): string { return String(supplied || `ussd:${phone}`).slice(0, 256); }
function parseState(value: unknown): UssdSessionState { try { return { ...(JSON.parse(String(value || '{}')) || {}), updatedAt: new Date().toISOString() }; } catch { return { updatedAt: new Date().toISOString() }; } }

async function ensureUssdSessionTable(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS ussd_sessions (session_id TEXT PRIMARY KEY, phone TEXT NOT NULL, state_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  saveDb();
}
async function readSession(sessionId: string): Promise<UssdSessionState> {
  await ensureUssdSessionTable(); const db = await getDb(); const rows = db.exec('SELECT state_json FROM ussd_sessions WHERE session_id=? LIMIT 1', [sessionId]);
  return parseState(rows[0]?.values?.[0]?.[0]);
}
async function writeSession(sessionId: string, phone: string, state: UssdSessionState): Promise<void> {
  await ensureUssdSessionTable(); const db = await getDb();
  db.run(`INSERT INTO ussd_sessions(session_id,phone,state_json,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET state_json=excluded.state_json,updated_at=CURRENT_TIMESTAMP`, [sessionId, phone, JSON.stringify({ ...state, updatedAt: new Date().toISOString() })]); saveDb();
}
async function clearSession(sessionId: string): Promise<void> { const db = await getDb(); db.run('DELETE FROM ussd_sessions WHERE session_id=?', [sessionId]); saveDb(); }
function amountMinor(input: string): number | null { const value = Number(String(input || '').replace(/[₦,\s]/g, '')); return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null; }
function mask(phone: string): string { return phone.length < 8 ? phone : `${phone.slice(0, 4)}••••${phone.slice(-4)}`; }

async function recordConversation(phone: string, text: string, response: string): Promise<void> {
  const conversation = await appendChatMessage({ phone, sender: 'user', content: text || 'HOME', channel: 'ussd', metadata: { channel: 'ussd', inbound: true } });
  await appendChatMessage({ phone, sender: 'assistant', content: response, channel: 'ussd', conversationId: conversation.conversationId, metadata: { channel: 'ussd', outbound: true } });
}

export async function handleUssdRequest(phoneNumber: string, text: string, meta: { sessionId?: string; serviceCode?: string } = {}): Promise<string> {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return 'END Unable to identify your Kurukoo account. Please try again.';
  const sessionId = sessionKey(phone, meta.sessionId);
  const state = await readSession(sessionId);
  const parts = String(text || '').split('*').filter(Boolean);
  let response = '';

  if (!parts.length) {
    await clearSession(sessionId);
    response = 'CON Welcome to Kurukoo\n1. Buy airtime\n2. Find a provider\n3. Check airtime request';
  } else if (parts[0] === '1') {
    if (parts.length === 1) {
      await writeSession(sessionId, phone, { mode: 'airtime_amount', updatedAt: new Date().toISOString() });
      response = 'CON How much airtime should Kurukoo prepare in NGN?';
    } else if (parts.length === 2) {
      const minor = amountMinor(parts[1]);
      if (!minor) response = 'CON Enter a valid positive airtime amount in NGN.';
      else {
        const operation = await prepareAirtimeOperation({ ownerPhone: phone, recipient: phone, amountMinor: minor, currency: 'NGN', idempotencyKey: `ussd:airtime:${sessionId}:${minor}` });
        await writeSession(sessionId, phone, { mode: 'airtime_confirm', operationId: operation.id, updatedAt: new Date().toISOString() });
        response = `CON Buy NGN ${(minor / 100).toFixed(2)} airtime for ${mask(phone)}?\n1. Confirm\n2. Cancel`;
      }
    } else {
      const operationId = state.operationId || (await prepareAirtimeOperation({ ownerPhone: phone, recipient: phone, amountMinor: amountMinor(parts[1]) || 0, currency: 'NGN', idempotencyKey: `ussd:airtime:${sessionId}:${amountMinor(parts[1]) || 0}` })).id;
      if (parts[2] !== '1') { await clearSession(sessionId); response = 'END Airtime purchase cancelled. No provider request was sent.'; }
      else {
        const operation = await purchaseAirtime({ ownerPhone: phone, operationId, idempotencyKey: `ussd:airtime:purchase:${sessionId}:${operationId}` });
        await clearSession(sessionId);
        response = operation.status === 'pending_provider' ? 'END Airtime purchase was accepted and is awaiting provider confirmation.' : operation.status === 'completed' ? 'END Airtime delivery was confirmed.' : 'END Airtime purchase was not completed.';
      }
    }
  } else if (parts[0] === '2') {
    if (parts.length === 1) { await writeSession(sessionId, phone, { mode: 'provider_request', updatedAt: new Date().toISOString() }); response = 'CON Reply with what you need and your area. Example: plumber in Ikeja'; }
    else { await clearSession(sessionId); response = 'END Your request was recorded in the Kurukoo conversation. Continue in Web Chat or SMS to review matching providers and quotes.'; }
  } else if (parts[0] === '3') {
    const operationId = state.operationId;
    const operation = operationId ? await getAirtimeOperation(phone, operationId) : null;
    response = operation ? `END Airtime request status: ${operation.status}.` : 'END No active airtime request is linked to this USSD session.';
  } else response = 'END Invalid selection. Please dial again.';

  await recordConversation(phone, text || 'HOME', response);
  return response;
}

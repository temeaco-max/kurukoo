import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-linked-chat-contract-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_SMOLLM2_LOCAL = 'false';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW_GROUPS = 'false';
process.env.JWT_SECRET = 'linked-chat-contract-secret-0123456789';
process.on('exit', () => { try { fs.rmSync(dbPath, { force: true }); } catch {} });

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { processWhatsAppLinkedDeviceMessage } = await import('../src/services/whatsappLinkedDeviceService.js');
const { getSmolLM2RuntimeStatus } = await import('../src/services/smolLm2Service.js');
const { getDb } = await import('../src/database.js');

const phone = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(phone, 'Linked Session Contract Tester');
const outbound: Array<{ jid: string; text: string }> = [];
const result = await processWhatsAppLinkedDeviceMessage({
  key: { remoteJid: `${phone.slice(1)}@s.whatsapp.net`, fromMe: false },
  message: { conversation: 'What should I know before using Kurukoo?' },
}, async (jid, text) => { outbound.push({ jid, text }); });

assert.equal(result.accepted, true);
assert.equal(result.phone, phone);
assert.ok(result.reply?.trim(), 'Canonical Chat should produce a reply');
assert.equal(outbound.length, 1, 'Linked session should receive exactly one reply');
assert.equal(outbound[0].jid, `${phone.slice(1)}@s.whatsapp.net`);
assert.ok(outbound[0].text.trim());

const runtime = getSmolLM2RuntimeStatus();
assert.equal(runtime.source, 'fallback', 'CI contract must remain truthful when no local checkpoint is provisioned');
assert.equal(runtime.executionMode, 'deterministic_fallback');
assert.equal(runtime.actualModel, 'template-fallback');
assert.equal(runtime.available, false);

const db = await getDb();
const rows = db.exec("SELECT type, producer, owner_phone, payload_json FROM coordinator_events WHERE type='chat.turn.completed' ORDER BY created_at DESC LIMIT 5")[0]?.values || [];
assert.ok(rows.length >= 1, 'Linked Chat turn should emit durable coordinator telemetry');
const matching = rows.find((row: any[]) => String(row[2]) === phone);
assert.ok(matching, 'Chat coordinator telemetry should retain protected owner linkage');
const payload = JSON.parse(String(matching[3] || '{}'));
assert.equal(payload.channel, 'whatsapp');
assert.equal(payload.modelProvider, 'Kurukoo Template');

console.log(JSON.stringify({
  ok: true,
  accepted: result.accepted,
  modelSource: runtime.source,
  executionMode: runtime.executionMode,
  actualModel: runtime.actualModel,
  outboundReplyPreview: outbound[0].text.slice(0, 180),
  coordinatorEvent: {
    type: matching[0],
    producer: matching[1],
    ownerLinked: true,
    channel: payload.channel,
    modelProvider: payload.modelProvider,
  },
}, null, 2));
console.log('Linked-session inbound WhatsApp route contract passed through canonical Chat with truthful bounded fallback, outbound reply, and durable coordinator telemetry. Real local SmolLM2 remains covered by test:smollm2-local.');

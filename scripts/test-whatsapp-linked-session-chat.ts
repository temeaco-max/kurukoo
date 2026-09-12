/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-linked-chat-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_SMOLLM2_LOCAL = 'true';
process.env.SMOLLM2_MODEL = 'smollm2:360m';
process.env.SMOLLM2_MAX_NEW_TOKENS = '96';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW_GROUPS = 'false';
process.env.JWT_SECRET = 'linked-chat-test-secret-0123456789';
process.on('exit', () => { try { fs.rmSync(dbPath, { force: true }); } catch {} });

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { processWhatsAppLinkedDeviceMessage } = await import('../src/services/whatsappLinkedDeviceService.js');
const { getSmolLM2RuntimeStatus } = await import('../src/services/smolLm2Service.js');
const { getDb } = await import('../src/database.js');

const phone = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(phone, 'Linked Session Tester');
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
const smollm2 = getSmolLM2RuntimeStatus();
assert.equal(smollm2.source, 'local');
assert.equal(smollm2.available, true);
assert.equal(smollm2.model.split('/').pop(), 'smollm2:360m');

const db = await getDb();
const rows = db.exec("SELECT type, producer, owner_phone, payload_json FROM coordinator_events WHERE type='chat.turn.completed' ORDER BY created_at DESC LIMIT 5")[0]?.values || [];
assert.ok(rows.length >= 1, 'Linked Chat turn should emit durable coordinator telemetry');
const matching = rows.find((row: any[]) => String(row[2]) === phone);
assert.ok(matching, 'Chat coordinator telemetry should retain protected owner linkage');
const payload = JSON.parse(String(matching[3] || '{}'));
assert.equal(payload.channel, 'whatsapp');
assert.ok(['SmolLM2', 'Kurukoo Template'].includes(String(payload.modelProvider)), 'Linked Chat must attribute either direct SmolLM2 or its truthful quality-guard template fallback');
console.log(JSON.stringify({ ok: true, accepted: result.accepted, modelSource: smollm2.source, model: smollm2.model, outboundReplyPreview: outbound[0].text.slice(0, 180), coordinatorEvent: { type: matching[0], producer: matching[1], ownerLinked: true, channel: payload.channel, modelProvider: payload.modelProvider } }, null, 2));
console.log('Simulated linked-session inbound WhatsApp message routed through local SmolLM2, canonical Chat, outbound reply, and coordinator telemetry.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const token = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngData = `data:image/png;base64,${pngBytes.toString('base64')}`;
const dbPath = path.join(os.tmpdir(), `kurukoo-attachments-${process.pid}-${Date.now()}.sqlite`);
const storagePath = path.join(os.tmpdir(), `kurukoo-attachments-${process.pid}-${Date.now()}`);

process.env.DB_PATH = dbPath;
process.env.CHAT_UPLOAD_DIR = storagePath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'chat_attachment_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const owner = '+2347000000811';
const otherOwner = '+2347000000812';
const headers = (phone: string) => ({ Authorization: `Bearer ${token(phone)}`, 'Content-Type': 'application/json' });

try {
  const anonymous = await fetch(`${baseUrl}/api/chat/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'file.png', type: 'image/png', data: pngData }) });
  assert.equal(anonymous.status, 401, 'attachment upload must require an authenticated user rather than creating a guest-owned file');

  const fakeImage = await fetch(`${baseUrl}/api/chat/attachments`, { method: 'POST', headers: headers(owner), body: JSON.stringify({ name: 'attachment-security-test.html', type: 'image/png', data: `data:image/png;base64,${Buffer.from('<!doctype html><script>test</script>').toString('base64')}` }) });
  assert.equal(fakeImage.status, 400, 'declared image content must pass signature validation rather than trusting a filename or client MIME declaration');

  const uploaded = await fetch(`${baseUrl}/api/chat/attachments`, { method: 'POST', headers: headers(owner), body: JSON.stringify({ name: 'attachment-security-test.html', type: 'image/png', data: pngData }) });
  const uploadPayload = await uploaded.json() as { attachment?: { id?: string; url?: string; name?: string; type?: string; size?: number } };
  assert.equal(uploaded.status, 201, JSON.stringify(uploadPayload));
  const attachment = uploadPayload.attachment;
  assert.ok(attachment?.id && attachment.url, 'successful attachment upload must return an opaque attachment identity and canonical route');
  assert.match(String(attachment.url), /^\/api\/chat\/attachments\/[0-9a-f-]{36}$/i, 'attachments must not receive a public static URL');
  assert.equal(attachment?.name, 'attachment-security-test.html', 'original display name may be retained but must not decide stored extension or response execution');
  assert.equal(attachment?.type, 'image/png');
  assert.equal(attachment?.size, pngBytes.length);
  const storedFiles = await fs.readdir(storagePath);
  assert.deepEqual(storedFiles.map((name) => path.extname(name)), ['.png'], 'private storage must choose the extension from the validated content type, not the supplied filename');

  const anonymousRead = await fetch(`${baseUrl}${attachment!.url}`);
  assert.equal(anonymousRead.status, 401, 'anonymous callers cannot retrieve private chat attachment bytes');
  const foreignRead = await fetch(`${baseUrl}${attachment!.url}`, { headers: headers(otherOwner) });
  assert.equal(foreignRead.status, 404, 'other authenticated owners cannot retrieve another user’s attachment');
  const ownRead = await fetch(`${baseUrl}${attachment!.url}`, { headers: headers(owner) });
  assert.equal(ownRead.status, 200, 'the uploading owner may retrieve their attachment');
  assert.equal(ownRead.headers.get('content-type'), 'image/png');
  assert.match(String(ownRead.headers.get('content-disposition')), /^attachment;/i, 'retrieval must force download instead of rendering uploaded content inline');
  assert.equal(ownRead.headers.get('x-content-type-options'), 'nosniff');
  assert.match(String(ownRead.headers.get('cache-control')), /private, no-store/i);

  const guestStream = await fetch(`${baseUrl}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Attach this', channel: 'web', attachment: { id: attachment!.id } }) });
  assert.equal(guestStream.status, 401, 'guest chat cannot attach a private uploaded file');
  const foreignStream = await fetch(`${baseUrl}/api/chat/stream`, { method: 'POST', headers: headers(otherOwner), body: JSON.stringify({ message: 'Attach this', channel: 'web', attachment: { id: attachment!.id } }) });
  assert.equal(foreignStream.status, 404, 'the chat stream must reject cross-owner attachment metadata before it persists a message');

  const deleted = await fetch(`${baseUrl}${attachment!.url}`, { method: 'DELETE', headers: headers(owner) });
  assert.equal(deleted.status, 200, 'the uploading owner may delete an unattached private file');
  const afterDelete = await fetch(`${baseUrl}${attachment!.url}`, { headers: headers(owner) });
  assert.equal(afterDelete.status, 404, 'deleted attachment metadata and bytes must no longer be retrievable');
  assert.deepEqual(await fs.readdir(storagePath), [], 'owner deletion must remove the private attachment bytes');

  const retainedForAccountDeletion = await fetch(`${baseUrl}/api/chat/attachments`, { method: 'POST', headers: headers(owner), body: JSON.stringify({ name: 'account-deletion.png', type: 'image/png', data: pngData }) });
  const retainedPayload = await retainedForAccountDeletion.json() as { attachment?: { url?: string } };
  assert.equal(retainedForAccountDeletion.status, 201, JSON.stringify(retainedPayload));
  assert.equal((await fs.readdir(storagePath)).length, 1, 'the account-deletion test requires a remaining private attachment');
  const accountDeleted = await fetch(`${baseUrl}/api/user/delete`, { method: 'POST', headers: headers(owner) });
  assert.equal(accountDeleted.status, 200, 'the protected account-deletion lifecycle must complete for the attachment owner');
  assert.deepEqual(await fs.readdir(storagePath), [], 'account deletion must remove private attachment bytes through the canonical attachment owner');
  const afterAccountDeletion = await fetch(`${baseUrl}${retainedPayload.attachment!.url}`, { headers: headers(owner) });
  assert.equal(afterAccountDeletion.status, 404, 'account deletion must remove attachment metadata as well as bytes');

  console.log('Chat attachment regression passed');
  console.log('Verified: authenticated upload, strict base64/signature validation, private storage, owner-only download/delete, account-deletion cleanup, forced download headers, no public static URL, and stream-level owner validation.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(storagePath, { recursive: true, force: true });
  for (const suffix of ['', '-journal', '-wal', '-shm']) await fs.rm(`${dbPath}${suffix}`, { force: true });
}

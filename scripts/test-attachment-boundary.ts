import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectAttachmentSecurity, attachmentSecurityReadiness } from '../src/services/attachmentSecurityBoundary.js';
const attachmentService = fs.readFileSync(new URL('../src/services/chatAttachmentService.ts', import.meta.url), 'utf8');

const source = fs.readFileSync(new URL('../src/routes/chatRouter.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /public[\\/]uploads[\\/]chat/, 'attachments must not default to a public static directory');
assert.match(source, /function privateAttachmentDir\(\)/, 'private attachment directory authority must exist');
assert.match(source, /CHAT_UPLOAD_DIR/, 'deployment-specific private storage path must remain configurable');
assert.match(source, /startsWith\(`\$\{publicRoot\}\$\{path\.sep\}`\)/, 'configured public paths must be rejected');
assert.match(attachmentService, /phone TEXT NOT NULL/, 'attachment metadata must bind an owner phone');
assert.match(attachmentService, /WHERE id=\? AND phone=\?/, 'retrieval and deletion must enforce owner binding');
assert.match(attachmentService, /expires_at>CURRENT_TIMESTAMP/, 'expired attachments must not be served');
assert.match(attachmentService, /cleanupExpired/, 'expired files must be cleaned up');
assert.match(source, /router\.delete\('\/attachments\/:id'/, 'owners must have a deletion path');
assert.match(attachmentService, /Unsupported attachment type/, 'MIME allow-list must remain enforced');
assert.match(attachmentService, /Attachment exceeds/, 'size limits must remain enforced');
assert.match(source, /\/api\/chat\/attachments\//, 'attachment URLs must resolve through an authenticated API boundary');

const safe = inspectAttachmentSecurity({ data: Buffer.from('safe text'), mimeType: 'text/plain', filename: 'note.txt' });
assert.equal(safe.state, 'accepted');
assert.ok(/^[a-f0-9]{64}$/.test(safe.sha256), 'accepted attachment must have a SHA-256 hash');

const script = inspectAttachmentSecurity({ data: Buffer.from('<script>alert(1)</script>'), mimeType: 'text/plain', filename: 'note.txt' });
assert.equal(script.state, 'rejected');

const pngLike = inspectAttachmentSecurity({ data: Buffer.from('not a png'), mimeType: 'image/png', filename: 'image.png' });
assert.equal(pngLike.state, 'rejected');
assert.equal(attachmentSecurityReadiness({ KURUKOO_MALWARE_SCANNER: 'builtin' }).configured, true);
console.log('Attachment boundary regression passed: private storage, owner binding, cleanup, deletion, validation, security inspection, and non-public access are enforced.');

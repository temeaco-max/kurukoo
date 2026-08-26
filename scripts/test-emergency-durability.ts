import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.argv[2] === '--child') {
  const dbPath = process.argv[3];
  const phone = process.argv[4];
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = dbPath;
  process.env.MEMORY_ENCRYPTION_KEY = 'emergency-durable-test-key';
  const { getEmergencySession } = await import('../src/services/emergencyService.js');
  const session = await getEmergencySession(phone);
  assert.equal(session?.serviceType, 'ambulance');
  assert.equal(session?.dialState, 'unavailable');
  console.log('persisted-ok');
} else {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-emergency-durable-'));
  const dbPath = path.join(tempDir, 'emergency.sqlite');
  const owner = `anon_emergency_durable_${process.pid}`;
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = dbPath;
  process.env.MEMORY_ENCRYPTION_KEY = 'emergency-durable-test-key';

  try {
    const { handleEmergencyTurn, getEmergencySession } = await import('../src/services/emergencyService.js');
    const created = await handleEmergencyTurn(owner, 'I need an ambulance near Ikeja');
    assert.ok(created?.session, 'Emergency session should be created');
    assert.equal(created?.session?.serviceType, 'ambulance');
    assert.equal(created?.session?.dialState, 'unavailable');
    assert.equal(created?.cardData?.truthful, true);
    assert.equal(created?.cardData?.session?.id, undefined, 'Client card must not expose the internal session ID');
    const localRead = await getEmergencySession(owner);
    assert.equal(localRead?.location?.value, 'Ikeja');
    assert.equal(await getEmergencySession('anon_other_emergency_owner'), null, 'Emergency sessions must remain owner-scoped');

    const child = spawnSync('npx', ['tsx', 'scripts/test-emergency-durability.ts', '--child', dbPath, owner], {
      cwd: process.cwd(), env: { ...process.env, DB_PATH: dbPath }, encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, /persisted-ok/);
    console.log('Emergency durability regression passed: active owner-scoped session survived a process restart boundary without exposing identifiers or claiming external dialing.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

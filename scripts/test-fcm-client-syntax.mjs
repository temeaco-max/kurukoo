/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.cwd(), 'frontend/public/js/fcm-client.js');
if (!fs.existsSync(target)) {
  throw new Error(`Missing FCM client: ${target}`);
}

const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'node --check failed\n');
  process.exit(result.status || 1);
}

console.log(JSON.stringify({ ok: true, file: 'frontend/public/js/fcm-client.js', syntax: 'valid' }));

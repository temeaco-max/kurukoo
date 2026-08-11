import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const hookPath = execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
  encoding: 'utf8',
}).trim();
fs.mkdirSync(path.dirname(hookPath), { recursive: true });
fs.writeFileSync(
  hookPath,
  '#!/usr/bin/env sh\n# Installed by npm run hooks:install\nnpm run secrets:staged\n',
  { mode: 0o755 },
);
console.log(`Installed Kurukoo pre-commit secret check at ${hookPath}`);

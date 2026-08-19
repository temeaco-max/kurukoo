import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const suiteName = process.argv[2];
if (!suiteName) {
  console.error('Usage: node scripts/run-test-suite.mjs <npm-script-name>');
  process.exit(2);
}

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const suite = packageJson.scripts?.[suiteName];
if (typeof suite !== 'string' || !suite.trim()) {
  console.error(`Unknown npm suite: ${suiteName}`);
  process.exit(2);
}

const commands = suite.split(/\s+&&\s+/).map(command => command.trim()).filter(Boolean);
const configuredTimeout = Number(process.env.KURUKOO_TEST_COMMAND_TIMEOUT_MS || 180_000);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? Math.min(Math.floor(configuredTimeout), 600_000)
  : 180_000;
let firstFailure = 0;

for (let index = 0; index < commands.length; index += 1) {
  const command = commands[index];
  const match = command.match(/^npm run ([A-Za-z0-9:_-]+)$/);
  if (!match) {
    console.error(`Unsupported suite command: ${command}`);
    process.exit(2);
  }
  const startedAt = Date.now();
  console.log(`\n[Suite ${suiteName}] ${index + 1}/${commands.length}: ${match[1]}`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', match[1]], {
    stdio: 'inherit',
    env: process.env,
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
  const elapsedMs = Date.now() - startedAt;
  if (result.error || result.signal) {
    const timedOut = result.error?.code === 'ETIMEDOUT';
    firstFailure ||= 1;
    console.error(`\nSuite ${suiteName} stopped at ${match[1]} after ${elapsedMs}ms${timedOut ? ` (timeout ${timeoutMs}ms)` : ''}.`);
    process.exit(firstFailure);
  }
  const code = typeof result.status === 'number' ? result.status : 1;
  if (code !== 0) {
    firstFailure ||= code;
    console.error(`\nSuite ${suiteName} stopped at ${match[1]} after ${elapsedMs}ms with exit code ${code}.`);
    process.exit(firstFailure);
  }
  console.log(`[Suite ${suiteName}] ${match[1]} passed in ${elapsedMs}ms.`);
}

console.log(`\nSuite ${suiteName} passed ${commands.length} commands.`);
process.exit(0);

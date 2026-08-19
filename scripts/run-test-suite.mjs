import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
const artifactDir = path.resolve('.artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
const logFile = path.join(artifactDir, `${suiteName}.log`);
const log = (line) => {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  console.log(line);
};
fs.writeFileSync(logFile, '');

function killProcessTree(child, signal = 'SIGTERM') {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try { child.kill(signal); } catch {}
  }
}

function runCommand(scriptName) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmExecutable, ['run', scriptName], {
      stdio: 'inherit',
      env: process.env,
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, elapsedMs: Date.now() - startedAt });
    };
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      log(`[Suite ${suiteName}] ${scriptName} exceeded ${timeoutMs}ms; terminating process group.`);
      killProcessTree(child, 'SIGTERM');
      setTimeout(() => {
        if (!settled) killProcessTree(child, 'SIGKILL');
      }, 10_000).unref();
    }, timeoutMs);
    timer.unref();

    child.once('error', (error) => finish({ error, signal: null, status: null, timedOut }));
    child.once('close', (status, signal) => finish({ error: null, signal, status, timedOut }));
  });
}

let firstFailure = 0;
for (let index = 0; index < commands.length; index += 1) {
  const command = commands[index];
  const match = command.match(/^npm run ([A-Za-z0-9:_-]+)$/);
  if (!match) {
    log(`UNSUPPORTED ${command}`);
    process.exit(2);
  }
  const scriptName = match[1];
  log(`[Suite ${suiteName}] ${index + 1}/${commands.length}: ${scriptName}`);
  const result = await runCommand(scriptName);
  if (result.error || result.signal || result.status !== 0) {
    firstFailure ||= typeof result.status === 'number' && result.status > 0 ? result.status : 1;
    log(`FAIL ${scriptName} after ${result.elapsedMs}ms${result.timedOut ? ` (timeout ${timeoutMs}ms)` : result.signal ? ` (signal ${result.signal})` : ` with exit code ${result.status ?? 1}`}`);
    process.exit(firstFailure);
  }
  log(`[Suite ${suiteName}] ${scriptName} passed in ${result.elapsedMs}ms.`);
}

log(`PASS ${suiteName} passed ${commands.length} commands.`);
process.exit(0);

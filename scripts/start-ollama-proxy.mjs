#!/usr/bin/env node
/*
 * Startup script for LiteLLM-replacement Ollama proxy.
 *
 * Starts both Ollama (if not running) and the LiteLLM proxy,
 * then keeps running until killed.
 *
 * Usage:
 *   node scripts/start-ollama-proxy.mjs
 *
 *   For remote Ollama, set the env var:
 *   OLLAMA_REMOTE_HOST=http://remote.host:11434 node scripts/start-ollama-proxy.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const proxyScript = join(__dirname, 'litellm-ollama-proxy.mjs');

// Check if Ollama is running
function checkOllama() {
  try {
    const result = execSync('curl -s --max-time 3 http://localhost:11434/api/tags', { stdio: 'pipe' });
    JSON.parse(result.toString());
    return true;
  } catch {
    return false;
  }
}

// Check if Ollama binary exists
function findOllama() {
  const candidates = [
    '/usr/local/opt/ollama/bin/ollama',
    '/opt/homebrew/bin/ollama',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const ollamaBin = findOllama();

// Start Ollama if not running
if (!checkOllama() && ollamaBin) {
  console.log('[start-ollama-proxy] Starting Ollama server...');
  const ollama = spawn(ollamaBin, ['serve'], { stdio: 'inherit', detached: true });
  ollama.unref();
  // Wait for Ollama to be ready
  for (let i = 0; i < 15; i++) {
    if (checkOllama()) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (checkOllama()) {
    console.log('[start-ollama-proxy] Ollama server is running on :11434');
  } else {
    console.error('[start-ollama-proxy] WARNING: Ollama server could not be started');
  }
} else if (checkOllama()) {
  console.log('[start-ollama-proxy] Ollama already running on :11434');
} else {
  console.error('[start-ollama-proxy] Ollama binary not found. Install via: brew install ollama');
}

// Start the proxy
console.log('[start-ollama-proxy] Starting LiteLLM proxy on :4000...');
if (process.env.OLLAMA_REMOTE_HOST) {
  console.log('[start-ollama-proxy] Remote Ollama: ' + process.env.OLLAMA_REMOTE_HOST);
} else {
  console.log('[start-ollama-proxy] No remote Ollama configured (OLLAMA_REMOTE_HOST not set)');
}

const proxy = spawn(process.execPath, [proxyScript], { stdio: 'inherit' });
proxy.on('exit', (code) => {
  console.log(`[start-ollama-proxy] Proxy exited with code ${code}`);
  process.exit(code || 0);
});

// Graceful shutdown
process.on('SIGTERM', () => proxy.kill());
process.on('SIGINT', () => proxy.kill());

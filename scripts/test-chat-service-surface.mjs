import assert from 'node:assert/strict';
import fs from 'node:fs';

const chatScript = fs.readFileSync(new URL('../public/js/kurukoo-primary-chat.js', import.meta.url), 'utf8');
const chatShell = fs.readFileSync(new URL('../public/chat/index.html', import.meta.url), 'utf8');
const roadmap = fs.readFileSync(new URL('../docs/product/SERVICE_EXECUTION_ROADMAP_2026-08-27.md', import.meta.url), 'utf8');

assert.match(chatScript, /\[\['Help me get somewhere', 'Get somewhere'\], \['Remind me about something', 'Set a reminder'\], \['Check a device or connection', 'Check a device'\], \['Find someone to help with this', 'Find help'\]\]/);
assert.match(chatShell, /data-prompt="Check a device or connection"[^>]*>[\s\S]*?Check a device/);
assert.match(chatShell, /data-prompt="Find someone to help with this"[^>]*>[\s\S]*?Find help/);
assert.doesNotMatch(chatScript, /if \(\$\('welcome'\)\) await loadAgentBrief\(\)/);
assert.match(chatScript, /loadNearbyInspector\(state\.surfaceView\);\s*await loadAgentBrief\(\);/);
assert.match(roadmap, /Chat the universal action surface/);
assert.match(roadmap, /Explicitly not claimed/);

console.log('Chat service-surface contract passed: outcome-first entry prompts and return-to-Kurukoo Agent Brief loading are protected.');

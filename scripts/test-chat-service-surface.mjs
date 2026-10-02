/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const chatScript = fs.readFileSync(new URL('../frontend/public/js/kurukoo-primary-chat.js', import.meta.url), 'utf8');
const chatShell = fs.readFileSync(new URL('../frontend/public/chat/index.html', import.meta.url), 'utf8');
const roadmap = fs.readFileSync(new URL('../docs/product/SERVICE_EXECUTION_ROADMAP_2026-08-27.md', import.meta.url), 'utf8');

const entryPrompts=[['Help me get somewhere','Get somewhere'],['Remind me about something','Set a reminder'],['Check a device or connection','Check a device'],['Find someone to help with this','Find help']];let searchFrom=0;for(const [prompt,label] of entryPrompts){const at=chatScript.slice(searchFrom).search(new RegExp(`\\[\\s*["']${prompt}["']\\s*,\\s*["']${label}["']\\s*\\]`));assert.ok(at>=0,`chat entry prompt missing or out of order: ${prompt}`);searchFrom+=at+1;}
assert.match(chatShell, /data-prompt="Check a device or connection"[^>]*>[\s\S]*?Check a device/);
assert.match(chatShell, /data-prompt="Find someone to help with this"[^>]*>[\s\S]*?Find help/);
assert.doesNotMatch(chatScript, /if \(\$\('welcome'\)\) await loadAgentBrief\(\)/);
assert.match(chatScript, /loadNearbyInspector\(state\.surfaceView\);\s*await loadAgentBrief\(\);/);
assert.match(roadmap, /Chat the universal action surface/);
assert.match(roadmap, /Explicitly not claimed/);

console.log('Chat service-surface contract passed: outcome-first entry prompts and return-to-Kurukoo Agent Brief loading are protected.');

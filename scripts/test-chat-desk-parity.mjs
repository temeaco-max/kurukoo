/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const chatHtml = fs.readFileSync(path.join(root, 'frontend/public/chat/index.html'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'src/services/chatSidebarFoundation.ts'), 'utf8');
const deskRuntime = fs.readFileSync(path.join(root, 'frontend/public/js/kurukoo-desk-system.js'), 'utf8');

const required = [
  ['New conversation', 'new-chat'],
  ['Requests', 'requests'],
  ['Tasks', 'tasks'],
  ['Discover', 'discover'],
  ['Connect', 'connect'],
  ['Topics', 'topics'],
  ['Recent conversations', 'history-list'],
  ['Top up', 'topup'],
  ['Subscription', 'subscription'],
  ['Memory', 'memory'],
  ['Safety & check-ins', 'safety'],
  ['Settings', 'settings'],
  ['Cart', 'cart'],
  ['Points', 'points'],
  ['Notifications', 'notification-toggle'],
];

const missingChat = required.filter(([, token]) => !chatHtml.includes(token));
const missingFoundation = required.filter(([label]) => !foundation.includes(label));
const runtimeRequired = [
  'k-desk-header-points',
  'k-desk-header-cart',
  'k-desk-header-notifications',
  'kurukoo-drawer-workspace',
  'kurukoo-drawer-context',
  '/chat',
  '/requests',
  '/tasks',
  '/connect',
  '/discover',
  '/topics',
  '/reminders',
  '/saved',
  '/memory',
  '/safety',
  '/settings',
  '/top-up',
  '/subscriptions',
  '/points',
  '/cart',
];
const missingRuntime = runtimeRequired.filter((token) => !deskRuntime.includes(token));

if (missingChat.length || missingFoundation.length || missingRuntime.length) {
  console.error(JSON.stringify({ missingChat, missingFoundation, missingRuntime }, null, 2));
  process.exit(1);
}

console.log(`Chat/Desk parity OK: ${required.length} shared capability markers, header Cart/Points/Notifications, and contextual drawers are represented.`);

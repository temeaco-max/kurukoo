/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredChannels = ['whatsapp', 'telegram', 'sms', 'email', 'ivr', 'ussd'];
const failures = [];

const registryPath = path.join(root, 'src/channels/channelRegistry.ts');
const basePath = path.join(root, 'src/channels/baseChannelService.ts');
const conversationPath = path.join(root, 'src/services/chatConversationService.ts');
const messageTablePath = path.join(root, 'src/database.ts');

for (const file of [registryPath, basePath, conversationPath, messageTablePath]) {
    if (!fs.existsSync(file)) failures.push(`Missing messaging core file: ${path.relative(root, file)}`);
}

if (fs.existsSync(registryPath)) {
    const registry = fs.readFileSync(registryPath, 'utf8');
    for (const channel of requiredChannels) {
        if (!registry.includes(channel)) failures.push(`Channel is not registered: ${channel}`);
    }
    if (!registry.includes("'./whatsapp.js'")) {
        failures.push('WhatsApp must resolve through src/channels/whatsapp.ts');
    }
}

if (fs.existsSync(basePath)) {
    const base = fs.readFileSync(basePath, 'utf8');
    for (const required of ['appendChatMessage', 'routeIntent', 'conversationId']) {
        if (!base.includes(required)) failures.push(`Base channel handler missing unified behavior: ${required}`);
    }
}

if (fs.existsSync(conversationPath)) {
    const conversation = fs.readFileSync(conversationPath, 'utf8');
    for (const required of ['conversationId', 'appendChatMessage']) {
        if (!conversation.includes(required)) failures.push(`Conversation service missing required integration: ${required}`);
    }
    // Memory Profile is the canonical identity/context source. Accept either
    // a direct SQL reference or the canonical memoryProfile service boundary.
    const hasMemoryProfileBoundary =
        conversation.includes('memory_profiles') ||
        conversation.includes("./memoryProfile.js") ||
        conversation.includes('getProfile(');
    if (!hasMemoryProfileBoundary) {
        failures.push('Conversation service missing required integration: memory profile');
    }
}

if (fs.existsSync(messageTablePath)) {
    const database = fs.readFileSync(messageTablePath, 'utf8');
    if (!database.includes('CREATE TABLE IF NOT EXISTS messages')) {
        failures.push('Unified messages table definition not found');
    }
}

// Legacy channel-specific chat clients are prohibited from becoming alternate sources of truth.
const prohibitedLegacyClients = [
    'frontend/public/js/kurukoo-home-chat.js',
    'frontend/public/js/kurukoo-chat.js'
];
for (const file of prohibitedLegacyClients) {
    if (fs.existsSync(path.join(root, file))) failures.push(`Legacy chat client remains: ${file}`);
}

if (failures.length) {
    console.error('Messaging architecture audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(`Messaging architecture audit passed: ${requiredChannels.length} transports registered on one conversation stack.`);

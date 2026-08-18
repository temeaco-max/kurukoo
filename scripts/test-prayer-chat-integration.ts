import { detectPrayerRequest } from '../src/services/prayerChatSurface.js';
import { ensurePrayerCapability } from '../src/services/prayerCapability.js';
import { getCapabilityRegistration } from '../src/services/capabilityRegistry.js';

async function main(): Promise<void> {
  ensurePrayerCapability();
  if (!getCapabilityRegistration('skill.prayer')) throw new Error('Prayer capability is not registered.');
  const positives = [
    'Please pray for me and my business.',
    'Can you pray with me tonight?',
    'I need a prayer for prosperity.',
    'Please make dua for my family.',
    'Bless me as I start this new job.',
  ];
  for (const message of positives) if (!detectPrayerRequest(message)) throw new Error(`Prayer request was not detected: ${message}`);
  const negatives = [
    'I need a plumber.',
    'What is a prayer?',
  ];
  for (const message of negatives) if (detectPrayerRequest(message)) throw new Error(`Non-prayer message was incorrectly detected: ${message}`);
  console.log('Prayer Chat integration detection contract passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

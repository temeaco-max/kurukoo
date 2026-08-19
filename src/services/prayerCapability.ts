import { registerComposableSkillExtension } from './capabilityExtensionService.js';
import { createPrayerRoutine, generatePrayer } from './prayerAgentService.js';

let registered = false;

export function ensurePrayerCapability(): void {
  if (registered) return;

  registerComposableSkillExtension({
    name: 'prayer',
    family: 'spiritual-support',
    capabilities: ['atomic.observe'],
    requiredInputs: [{ key: 'topic', label: 'Prayer topic', required: false }],
    optionalInputs: [
      { key: 'name', label: 'Name to include' }, { key: 'tradition', label: 'Prayer tradition' }, { key: 'tone', label: 'Prayer tone' },
      { key: 'length', label: 'Prayer length' }, { key: 'dueAt', label: 'Routine time' }, { key: 'recurrence', label: 'Routine recurrence' },
    ],
    actions: ['understand', 'clarify', 'pray', 'audio', 'routine', 'review', 'cancel', 'resume'],
    permissions: ['authenticated_owner'],
    risk: 'low_risk',
    mode: 'structured_action',
    owner: ['prayerAgentService', 'canonicalChatTurnService', 'agentRuntime', 'capabilityRegistry'],
    activationState: 'locally_available',
    source: 'prayerAgentService',
    executionAdapter: {
      owner: 'prayerAgentService',
      actions: ['understand', 'clarify', 'pray', 'audio', 'routine', 'review', 'cancel', 'resume'],
      mode: 'structured_action',
      execute: async (context) => {
        const args = context.arguments || {};
        const topic = String(args.topic || '').trim();
        if (context.action === 'understand' || context.action === 'clarify') {
          return { status: 'needs_user', message: topic ? 'I can pray about that. Tell me the tradition or style you would like, or I can keep it general.' : 'What would you like me to pray about?' };
        }
        if (context.action === 'pray' || context.action === 'audio') {
          if (!topic) return { status: 'needs_user', message: 'Tell me what you would like prayer for.' };
          const rawLength = String(args.length || '');
          const length = ['short', 'medium', 'long'].includes(rawLength) ? (rawLength as 'short' | 'medium' | 'long') : 'medium';
          const result = await generatePrayer({
            phone: context.phone, conversationId: context.conversationId, topic,
            name: args.name ? String(args.name) : undefined, tradition: args.tradition as any,
            tone: args.tone ? String(args.tone) : undefined, length,
          });
          return { status: 'completed', message: result.prayer, canonicalFacts: { agentId: result.agentId, tradition: result.tradition, provider: result.provider, model: result.model, modality: context.action === 'audio' ? 'audio_ready' : 'text' }, evidenceLevel: 'canonical_service', externalActivation: 'locally_available', nextActions: [{ action: 'audio', label: 'Pray it aloud' }, { action: 'routine', label: 'Make this a prayer routine' }] };
        }
        if (context.action === 'routine') {
          if (!topic || !args.dueAt) return { status: 'needs_user', message: 'Tell me what you want prayed for and when you want your prayer routine to begin.' };
          const reminder = await createPrayerRoutine({
            phone: context.phone, conversationId: context.conversationId, topic, dueAt: String(args.dueAt),
            recurrence: args.recurrence === 'weekly' ? 'weekly' : 'daily', tradition: args.tradition as any, name: args.name ? String(args.name) : undefined,
          });
          return { status: 'completed', message: `Your prayer routine is scheduled for ${reminder.due_at}.`, canonicalFacts: { reminderId: reminder.id, dueAt: reminder.due_at, recurrence: reminder.recurrence, prayerTopic: topic }, evidenceLevel: 'canonical_service', externalActivation: 'locally_available', nextActions: [{ action: 'review', label: 'Review prayer routine' }] };
        }
        return { status: 'needs_user', message: 'Tell me whether you want a prayer, spoken prayer, or a recurring prayer routine.' };
      },
    },
  });

  registered = true;
}

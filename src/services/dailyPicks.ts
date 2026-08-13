import { getOpportunitiesForFeed } from './opportunityEngine.js';

/**
 * Legacy compatibility projection for callers that still request one Daily Pick.
 * Daily Picks do not own inventory, pricing, delivery, rewards, or a second
 * recommendation engine: they surface the existing owner-scoped opportunity feed.
 */
export async function getDailyPick(phone?: string) {
  const owner = String(phone || '').trim();
  if (!owner) {
    return {
      kind: 'empty' as const,
      title: 'No connected picks yet',
      description: 'Sign in and use Kurukoo to create a request, reminder, or other supported context.',
    };
  }
  const [opportunity] = await getOpportunitiesForFeed(owner);
  if (!opportunity) {
    return {
      kind: 'empty' as const,
      title: 'No connected picks yet',
      description: 'Start a conversation to create a request or reminder. Kurukoo does not invent product, price, delivery, or community activity.',
    };
  }
  return {
    kind: 'opportunity' as const,
    title: opportunity.title,
    description: opportunity.subtitle,
    ctaText: opportunity.ctaText,
    ctaLink: opportunity.ctaLink,
    sourceType: opportunity.sourceType,
    disclosure: opportunity.disclosure,
  };
}

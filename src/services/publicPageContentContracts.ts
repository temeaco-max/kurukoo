export interface PublicPageContentContract {
  route: string;
  purpose: string;
  audience: string[];
  requiredSections: string[];
  requiredActions: string[];
  requiredStates: string[];
  seo: { indexable: boolean; title: boolean; description: boolean; canonical: boolean; structuredData?: string[]; internalLinks: boolean };
  truthBoundary: string;
  userOutcome: string;
  perspective: 'user';
}

const base = (
  route: string,
  purpose: string,
  requiredSections: string[],
  requiredActions: string[] = [],
  truthBoundary = 'Public content must only claim capabilities, availability, providers, evidence and fulfilment that the repository or approved source can substantiate.',
  userOutcome = 'Help the visitor understand what Kurukoo can do for them and give them a clear next action.',
): PublicPageContentContract => ({
  route,
  purpose,
  audience: ['public'],
  requiredSections,
  requiredActions,
  requiredStates: ['loading', 'empty', 'error', 'normal'],
  seo: { indexable: true, title: true, description: true, canonical: true, internalLinks: true },
  truthBoundary,
  userOutcome,
  perspective: 'user',
});

export const PUBLIC_PAGE_CONTENT_CONTRACTS: readonly PublicPageContentContract[] = [
  base('/', 'Explain Kurukoo clearly and move visitors into the product.', ['product promise', 'how Kurukoo works', 'core capabilities', 'real-world examples', 'trust/evidence explanation', 'channels/clients', 'pricing entry', 'FAQ', 'primary CTA'], ['start chat', 'sign up'], undefined, 'Help visitors see that Kurukoo is a service for getting things done and invite them to start with their own need.'),
  base('/about', 'Explain what Kurukoo is, why it exists, and what it is becoming.', ['mission', 'product definition', 'operating model', 'people/ecosystem', 'trust and boundaries', 'roadmap context'], ['start chat'], undefined, 'Help people understand the service and why it exists without requiring knowledge of its internal architecture.'),
  base('/features', 'Explain what Kurukoo can do in human product language.', ['conversational Agent', 'Desk', 'Discover', 'Requests', 'Tasks', 'Connect', 'Memory', 'Agents', 'Network', 'Economic coordination', 'Safety', 'cross-client experience', 'FAQ'], ['open chat', 'sign up'], undefined, 'Show useful things a person can ask Kurukoo to help accomplish.'),
  base('/explore', 'Let visitors understand the breadth of Kurukoo capabilities and categories.', ['capability taxonomy', 'categories', 'examples', 'agent handoff', 'discovery handoff', 'how capabilities become real outcomes'], ['open chat', 'explore capability'], undefined, 'Help visitors start from a need and discover examples of what Kurukoo may be able to do.'),
  base('/discover', 'Public discovery surface for activity, Topics, Opportunities and relevant options.', ['For You or public equivalent', 'Nearby', 'Today/Daily Picks', 'Topics', 'Opportunities', 'Explore Kurukoo', 'source/provenance', 'sponsored disclosure', 'empty-state alternatives'], ['open item', 'open chat', 'save/watch/follow where authenticated'], undefined, 'Help people find something useful and continue it through Kurukoo.'),
  base('/network', 'Explain the people, providers, businesses, contributors and agents participating in Kurukoo.', ['network definition', 'participant types', 'verification/evidence', 'discovery and coordination', 'availability boundaries', 'join/partner paths'], ['become provider/partner', 'open chat'], undefined, 'Explain who or what Kurukoo can involve when getting something done requires another participant.'),
  base('/channels', 'Explain supported Kurukoo access channels and their readiness boundaries.', ['Web', 'PWA', 'iOS', 'Android', 'supported external channels', 'readiness/availability', 'privacy/security', 'setup path'], ['open chat', 'start setup'], undefined, 'Help people understand where they can reach Kurukoo and how work continues across supported channels.'),
  base('/topics', 'Public shared-content surface for durable Topics.', ['topic index', 'taxonomy/filtering', 'topic detail entry', 'replies/community context', 'moderation/reporting explanation', 'related Topics', 'Chat handoff'], ['open topic', 'join conversation'], undefined, 'Help people find, understand and continue useful shared information.'),
  base('/resources', 'Resource library for learning and product usage.', ['resource taxonomy', 'featured resources', 'resource cards', 'detail/article template', 'related resources', 'updated metadata', 'Chat handoff'], ['open resource', 'open chat'], undefined, 'Help people learn something useful or learn how Kurukoo can help them do something.'),
  base('/help', 'Help and support entry point.', ['search/help navigation', 'getting started', 'account/auth help', 'Chat help', 'Requests/Tasks/Connect help', 'payments/subscriptions help', 'safety/help escalation', 'contact support', 'FAQ'], ['search help', 'contact support', 'open chat'], undefined, 'Help a person resolve an issue and return to getting something done.'),
  base('/contact', 'Give people legitimate ways to contact Kurukoo.', ['reason selector', 'support contact', 'partnership contact', 'press/media', 'advertising contact', 'privacy/legal contact', 'expected response semantics', 'abuse/safety route'], ['submit contact', 'open help'], undefined, 'Give people a clear path to the right human or support process.'),
  base('/pricing', 'Explain plans, pricing logic and what is or is not currently active.', ['plans', 'entitlements', 'consumer/provider/business/agent relevance', 'billing cycle', 'regional caveats', 'payment readiness', 'FAQ', 'upgrade path'], ['compare plans', 'sign up'], undefined, 'Help people understand what access or paid options are available before they choose.'),
  base('/partners', 'Explain ecosystem partnership opportunities.', ['partner types', 'benefits', 'integration models', 'requirements', 'trust/compliance', 'lead/contact path'], ['become partner', 'contact'], undefined, 'Help a potential partner understand how working with Kurukoo can help people get things done.'),
  base('/advertise', 'Explain how approved advertising works on Kurukoo.', ['inventory/surfaces', 'audiences', 'placement rules', 'sponsorship disclosure', 'pricing/eligibility', 'creative requirements', 'measurement', 'contact CTA'], ['start advertising enquiry', 'contact'], undefined, 'Help businesses understand where approved promotion can appear without confusing advertising with guaranteed demand.'),
  base('/blog', 'Publish Kurukoo product, ecosystem and educational content.', ['article index', 'categories', 'article detail', 'author/date', 'related content', 'SEO metadata', 'newsletter/Chat continuation where appropriate'], ['open article', 'search content'], undefined, 'Help people learn useful things and understand how Kurukoo can help in everyday life.'),
  base('/careers', 'Explain real opportunities to work with Kurukoo.', ['company context', 'open roles', 'role detail', 'application path', 'equal opportunity/privacy notice'], ['view role', 'apply'], undefined, 'Help prospective contributors understand how they can help build and operate Kurukoo.'),
  base('/developers', 'Explain Kurukoo as a platform and how developers can build with it.', ['platform overview', 'architecture model', 'API/SDK entry', 'authentication', 'webhooks/events', 'rate limits', 'examples', 'security/trust', 'support'], ['open API docs', 'open developer resources'], undefined, 'Help developers build useful capabilities and integrations that can help Kurukoo get more things done.'),
  base('/developers/api', 'Technical API documentation.', ['getting started', 'authentication', 'resources', 'request/response examples', 'errors', 'webhooks', 'idempotency', 'rate limits', 'versioning', 'security', 'changelog'], ['copy example', 'test endpoint where supported'], undefined, 'Help developers successfully integrate with Kurukoo while preserving canonical ownership and truth.'),
  base('/legal', 'Legal/privacy/safety/disclaimer index and durable legal documents.', ['terms', 'privacy', 'cookies', 'acceptable use', 'safety/disclaimer', 'provider/marketplace boundaries', 'refund/dispute/payment terms', 'document version/date'], ['open document'], undefined, 'Help people understand their rights, responsibilities and the boundaries of the service.'),
  base('/cookies', 'Explain cookies and consent categories.', ['necessary cookies', 'analytics/performance', 'preferences', 'consent controls', 'retention', 'third-party services', 'privacy contact'], ['manage consent'], undefined, 'Help people make an informed choice about optional data use.'),
] as const;

export function getPublicPageContentContract(route: string): PublicPageContentContract | undefined {
  return PUBLIC_PAGE_CONTENT_CONTRACTS.find(item => item.route === route);
}

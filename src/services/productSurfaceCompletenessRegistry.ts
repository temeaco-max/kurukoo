/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
export type SurfaceDomain = 'agent' | 'subscriptions' | 'providers' | 'public' | 'chat' | 'monetisation' | 'admin' | 'brand' | 'client-parity';

export interface ProductSurfaceCompletenessContract {
  id: string;
  domain: SurfaceDomain;
  purpose: string;
  requiredRepresentations: string[];
  requiredStates: string[];
  canonicalUrls: string[];
  owner: string;
}

const stateSet = ['loading', 'empty', 'ready', 'pending', 'needs_input', 'unavailable', 'error', 'success', 'cancelled', 'recovery'];

export const PRODUCT_SURFACE_COMPLETENESS: readonly ProductSurfaceCompletenessContract[] = [
  {
    id: 'agent-chat', domain: 'agent', owner: 'canonicalChatTurnService',
    purpose: 'Conversational intelligence through which the user asks Kurukoo to understand, coordinate and act.',
    requiredRepresentations: ['conversation history', 'message stream', 'composer', 'attachments', 'voice', 'streaming state', 'context drawer', 'request cards', 'task/goal cards', 'memory context', 'search', 'notifications', 'safety interruption', 'authentication continuation'],
    requiredStates: [...stateSet, 'typing', 'voice_connecting', 'voice_active', 'agent_paused', 'agent_cancelled'],
    canonicalUrls: ['/chat', '/chat/:conversationId', '/share/:shareId'],
  },
  {
    id: 'agents', domain: 'agent', owner: 'agentRuntime',
    purpose: 'Manage bounded autonomous agents and their goals, scope, risk and execution state.',
    requiredRepresentations: ['agent identity', 'persona', 'goals', 'runtime state', 'tool/capability scope', 'risk/approval', 'budget/usage', 'action history', 'evidence', 'pause/resume/cancel'],
    requiredStates: [...stateSet, 'running', 'paused', 'blocked', 'approval_required'],
    canonicalUrls: ['/agents', '/agents/:id'],
  },
  {
    id: 'subscriptions', domain: 'subscriptions', owner: 'subscription',
    purpose: 'Show plan, entitlement, billing and change/cancel state truthfully for consumers, providers, businesses and agents.',
    requiredRepresentations: ['current plan', 'plan comparison', 'entitlements', 'regional pricing', 'billing readiness', 'trial/expiry', 'upgrade/downgrade', 'cancel/reactivate', 'payment boundary', 'confirmation/recovery'],
    requiredStates: [...stateSet, 'trial', 'expired', 'renewal_due', 'payment_required'],
    canonicalUrls: ['/subscriptions'],
  },
  {
    id: 'providers', domain: 'providers', owner: 'providerEntity + trust/review lifecycle',
    purpose: 'Let people evaluate, select and coordinate real-world providers without collapsing identity, verification, availability and fulfilment into one claim.',
    requiredRepresentations: ['profile', 'capabilities', 'verification', 'evidence', 'availability', 'presence', 'coverage', 'ratings', 'reviews', 'lead state', 'offers/quotes', 'communication', 'request participation', 'fulfilment', 'disputes'],
    requiredStates: ['loading', 'empty', 'verified', 'unverified', 'available', 'unavailable', 'busy', 'pending', 'quote_ready', 'in_progress', 'fulfilled', 'cancelled', 'disputed', 'recovery'],
    canonicalUrls: ['/discover', '/requests/:id', '/chat/:conversationId'],
  },
  {
    id: 'public-content', domain: 'public', owner: 'publicRoutes + contentRoutes + seoService',
    purpose: 'Explain what Kurukoo is, answer public search intent and guide users into the product.',
    requiredRepresentations: ['overview/about', 'features', 'discover', 'network', 'channels', 'topics', 'resources', 'help/support', 'contact', 'pricing', 'partners', 'advertise', 'careers', 'blog/media', 'developers', 'legal/terms/privacy/safety', 'cookies', 'disclaimers'],
    requiredStates: ['published', 'updated', 'draft_or_unavailable', '404', 'offline'],
    canonicalUrls: ['/about', '/features', '/discover', '/network', '/channels', '/topics', '/resources', '/help', '/contact', '/pricing', '/partners', '/advertise', '/careers', '/blog', '/developers', '/legal', '/cookies'],
  },
  {
    id: 'monetisation', domain: 'monetisation', owner: 'economicRequest + payment + points + advertising + commission services',
    purpose: 'Represent every Kurukoo revenue/economic mechanism with truthful user and operator interfaces.',
    requiredRepresentations: ['subscriptions', 'Points', 'top-up', 'wallet', 'provider leads', 'checkout', 'quotes', 'payment boundary', 'escrow', 'commission', 'referrals/rewards', 'affiliate/sourced products', 'advertising/campaigns', 'promoted discovery', 'refund/dispute/recovery'],
    requiredStates: ['configured', 'eligible', 'confirmation_required', 'payment_pending', 'payment_verified', 'settled', 'failed', 'cancelled', 'refunded', 'disputed', 'not_configured'],
    canonicalUrls: ['/subscriptions', '/points', '/top-up', '/wallet', '/requests/:id', '/checkout', '/admin/revenue', '/admin/advertising'],
  },
  {
    id: 'admin-keys-config', domain: 'admin', owner: 'admin configuration boundary',
    purpose: 'Give operators safe visibility into API keys, provider credentials, environment configuration and feature readiness without exposing secrets.',
    requiredRepresentations: ['variable/key catalogue', 'subsystem/provider', 'required/optional', 'configured/unconfigured', 'enabled/disabled', 'safe fingerprint', 'last validation', 'dependency/features', 'reload/rotation boundary', 'documentation'],
    requiredStates: ['configured', 'missing', 'invalid', 'expired', 'rotation_required', 'not_applicable', 'blocked'],
    canonicalUrls: ['/admin/settings', '/admin/integrations'],
  },
  {
    id: 'brand-system', domain: 'brand', owner: 'shared brand asset/icon system',
    purpose: 'Keep Kurukoo logo, wordmark, app icon and iconography optically consistent across every client and page.',
    requiredRepresentations: ['logo icon', 'wordmark', 'favicon', 'app icon', 'header logo', 'auth logo', 'footer logo', 'navigation icons', 'action icons', 'status icons'],
    requiredStates: ['light', 'dark', 'small', 'medium', 'large', 'high-contrast'],
    canonicalUrls: [],
  },
  {
    id: 'client-parity', domain: 'client-parity', owner: 'Web/PWA/iOS/Android platform contract',
    purpose: 'Keep the same product/resource vocabulary and state semantics across web, PWA and native apps.',
    requiredRepresentations: ['Desk', 'Agent/Chat', 'Discover', 'Requests', 'Tasks', 'Connect', 'Notifications', 'Memory where supported', 'durable object deep links', 'auth continuation', 'QR/deep links', 'offline/reconnect', 'push notification state'],
    requiredStates: ['available', 'authenticated', 'guest', 'offline', 'reconnecting', 'permission_required', 'unsupported'],
    canonicalUrls: ['/desk', '/chat', '/discover', '/requests', '/tasks', '/connect'],
  },
] as const;

export function getProductSurfaceCompleteness(id: string) {
  return PRODUCT_SURFACE_COMPLETENESS.find(surface => surface.id === id);
}

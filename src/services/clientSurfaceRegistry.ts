export type ClientFamily = 'web' | 'pwa' | 'native' | 'admin';
export type SurfaceState = 'represented' | 'implemented' | 'contract_tested' | 'external_activation' | 'device_verification';
export type PrimaryNavigation = 'agent' | 'discover' | 'requests' | 'tasks' | 'connect' | 'more' | 'marketing' | 'workspace' | 'admin' | 'secondary';

export interface ClientSurface {
  id: string;
  label: string;
  family: ClientFamily;
  route: string;
  primaryNavigation: PrimaryNavigation;
  semanticOwners: string[];
  states: SurfaceState[];
  responsive: boolean;
  nativeOnly?: boolean;
}

export const CLIENT_SURFACES: readonly ClientSurface[] = [
  // Public product / discovery
  { id: 'web-marketing', label: 'Marketing website', family: 'web', route: '/', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'marketing-content'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-about', label: 'About', family: 'web', route: '/about', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'company-content'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-features', label: 'Features', family: 'web', route: '/features', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'featureRegistry', 'product-content'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-how-it-works', label: 'How it works', family: 'web', route: '/how-it-works', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'product-system-map'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-explore', label: 'Explore Kurukoo', family: 'web', route: '/explore', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'skills', 'skillFlows'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-discover-public', label: 'Discover', family: 'web', route: '/discover', primaryNavigation: 'marketing', semanticOwners: ['discoveryRoutes', 'nearbyPulse', 'opportunityEngine'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-network', label: 'Network', family: 'web', route: '/network', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'provider-discovery'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-channels', label: 'Channels', family: 'web', route: '/channels', primaryNavigation: 'marketing', semanticOwners: ['externalIntegrationReadiness', 'pilotReadiness'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-topics-public', label: 'Topics', family: 'web', route: '/topics', primaryNavigation: 'marketing', semanticOwners: ['topicRoutes', 'topicService', 'community-context'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-resources', label: 'Resources', family: 'web', route: '/resources', primaryNavigation: 'marketing', semanticOwners: ['contentRoutes', 'contentManager', 'seoService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-help', label: 'Help & Support', family: 'web', route: '/help', primaryNavigation: 'marketing', semanticOwners: ['contentRoutes', 'support'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-contact', label: 'Contact', family: 'web', route: '/contact', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'support'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-pricing', label: 'Pricing', family: 'web', route: '/pricing', primaryNavigation: 'marketing', semanticOwners: ['pricingRoutes', 'subscription'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-partners', label: 'Partners', family: 'web', route: '/partners', primaryNavigation: 'marketing', semanticOwners: ['partnerRoutes', 'provider-network'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-advertise', label: 'Advertise', family: 'web', route: '/advertise', primaryNavigation: 'marketing', semanticOwners: ['adManager', 'publicRoutes'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-blog', label: 'Blog / Kuru Media', family: 'web', route: '/blog', primaryNavigation: 'marketing', semanticOwners: ['contentRoutes', 'seoService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-careers', label: 'Careers', family: 'web', route: '/careers', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'company-content'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-legal', label: 'Legal, privacy & disclaimers', family: 'web', route: '/legal', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'legal-content', 'privacy'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-cookies', label: 'Cookies', family: 'web', route: '/cookies', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'privacy'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-developers', label: 'Developers', family: 'web', route: '/developers', primaryNavigation: 'marketing', semanticOwners: ['contentRoutes', 'developer-docs'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-api-docs', label: 'API documentation', family: 'web', route: '/developers/api', primaryNavigation: 'marketing', semanticOwners: ['contentRoutes', 'developer-docs'], states: ['represented', 'implemented'], responsive: true },

  // Authenticated browser OS — clean URLs
  { id: 'web-desk', label: 'Desk', family: 'web', route: '/desk', primaryNavigation: 'workspace', semanticOwners: ['appSurfaceRoutes', 'pageContentContracts', 'conversationWorkspace'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-chat', label: 'Agent', family: 'web', route: '/chat', primaryNavigation: 'agent', semanticOwners: ['canonicalChatTurnService', 'contextArbitration', 'conversationWorkspace'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-chat-conversation', label: 'Conversation', family: 'web', route: '/chat/:conversationId', primaryNavigation: 'agent', semanticOwners: ['canonicalChatTurnService', 'conversationWorkspace'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-discover', label: 'Discover', family: 'web', route: '/discover', primaryNavigation: 'discover', semanticOwners: ['discoveryRoutes', 'nearbyPulse', 'opportunityEngine'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-topics', label: 'Topics', family: 'web', route: '/topics', primaryNavigation: 'secondary', semanticOwners: ['topicRoutes', 'topicService', 'community-context'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-requests', label: 'Requests', family: 'web', route: '/requests', primaryNavigation: 'requests', semanticOwners: ['economicRequest', 'order', 'checkout'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-request-detail', label: 'Request detail', family: 'web', route: '/requests/:requestId', primaryNavigation: 'requests', semanticOwners: ['economicRequest', 'order', 'checkout', 'providerDiscovery'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-reminders', label: 'Reminders', family: 'web', route: '/reminders', primaryNavigation: 'secondary', semanticOwners: ['reminderService', 'notificationService', 'backgroundServices'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-saved', label: 'Saved', family: 'web', route: '/saved', primaryNavigation: 'secondary', semanticOwners: ['savedItems', 'offerEngine', 'memoryProfile'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-cart', label: 'Cart', family: 'web', route: '/cart', primaryNavigation: 'secondary', semanticOwners: ['cart', 'order', 'economicRequest'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-tasks', label: 'Tasks', family: 'web', route: '/tasks', primaryNavigation: 'tasks', semanticOwners: ['task', 'agentRuntime', 'reminderService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-task-detail', label: 'Task detail', family: 'web', route: '/tasks/:taskId', primaryNavigation: 'tasks', semanticOwners: ['task', 'agentRuntime', 'reminderService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-connect', label: 'Connect', family: 'web', route: '/connect', primaryNavigation: 'connect', semanticOwners: ['connectionRoutes', 'externalIntegrationReadiness', 'artifactService'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-agents', label: 'Agents', family: 'web', route: '/agents', primaryNavigation: 'secondary', semanticOwners: ['agentRuntime', 'agentRouter'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-agent-detail', label: 'Agent detail', family: 'web', route: '/agents/:agentId', primaryNavigation: 'secondary', semanticOwners: ['agentRuntime', 'agentRouter'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-capabilities', label: 'Capabilities', family: 'web', route: '/capabilities', primaryNavigation: 'secondary', semanticOwners: ['capabilityRegistry', 'capabilityPortfolio'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-opportunities', label: 'Opportunities', family: 'web', route: '/opportunities', primaryNavigation: 'secondary', semanticOwners: ['opportunityEngine', 'dailyPicks'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-opportunity-detail', label: 'Opportunity detail', family: 'web', route: '/opportunities/:opportunityId', primaryNavigation: 'secondary', semanticOwners: ['opportunityEngine', 'dailyPicks'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-wallet', label: 'Wallet', family: 'web', route: '/wallet', primaryNavigation: 'secondary', semanticOwners: ['directWallet', 'payment', 'points', 'subscription'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-points', label: 'Points', family: 'web', route: '/points', primaryNavigation: 'secondary', semanticOwners: ['points'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-top-up', label: 'Top Up', family: 'web', route: '/top-up', primaryNavigation: 'secondary', semanticOwners: ['topup', 'payment'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-subscriptions', label: 'Subscriptions', family: 'web', route: '/subscriptions', primaryNavigation: 'secondary', semanticOwners: ['subscription'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-checkout', label: 'Checkout', family: 'web', route: '/checkout', primaryNavigation: 'secondary', semanticOwners: ['checkout', 'economicRequest', 'payment'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-confirmations', label: 'Confirmations', family: 'web', route: '/confirmations', primaryNavigation: 'secondary', semanticOwners: ['checkoutConfirmation', 'economicRequest'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-memory', label: 'Memory', family: 'web', route: '/memory', primaryNavigation: 'secondary', semanticOwners: ['memoryProfile'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-notifications', label: 'Notifications', family: 'web', route: '/notifications', primaryNavigation: 'secondary', semanticOwners: ['notificationService', 'notificationQueue'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-artifacts', label: 'Artifacts', family: 'web', route: '/artifacts', primaryNavigation: 'secondary', semanticOwners: ['artifactService', 'storageRouter'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-prayer', label: 'Prayer Companion', family: 'web', route: '/prayer', primaryNavigation: 'secondary', semanticOwners: ['prayerAgent', 'agentRuntime', 'voiceService', 'artifactService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-call', label: 'Kurukoo Call', family: 'web', route: '/call', primaryNavigation: 'secondary', semanticOwners: ['voiceService', 'webrtcSignalling', 'deviceLinks'], states: ['represented', 'implemented', 'external_activation'], responsive: true },
  { id: 'web-safety', label: 'Safety', family: 'web', route: '/safety', primaryNavigation: 'secondary', semanticOwners: ['safetyService', 'interactionPolicy', 'notificationService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-settings', label: 'Settings', family: 'web', route: '/settings', primaryNavigation: 'secondary', semanticOwners: ['auth', 'memoryProfile', 'notificationService', 'connectionRoutes'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-share', label: 'Shared conversation', family: 'web', route: '/share/:shareId', primaryNavigation: 'secondary', semanticOwners: ['conversationWorkspace', 'share'], states: ['represented', 'implemented'], responsive: true },

  // PWA / native clients
  { id: 'pwa-shell', label: 'PWA application shell', family: 'pwa', route: '/desk', primaryNavigation: 'workspace', semanticOwners: ['canonical API', 'service worker', 'clientSurfaceRegistry'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'native-ios', label: 'iOS application', family: 'native', route: 'native://ios', primaryNavigation: 'agent', semanticOwners: ['canonical API', 'native device adapters', 'clientSurfaceRegistry'], states: ['represented', 'implemented', 'device_verification'], responsive: false, nativeOnly: true },
  { id: 'native-android', label: 'Android application', family: 'native', route: 'native://android', primaryNavigation: 'agent', semanticOwners: ['canonical API', 'native device adapters', 'clientSurfaceRegistry'], states: ['represented', 'implemented', 'device_verification'], responsive: false, nativeOnly: true },

  // Admin control plane — clean paths
  { id: 'admin-control-room', label: 'Admin Control Room', family: 'admin', route: '/admin', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'audit', 'externalIntegrationReadiness'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-conversations', label: 'Admin Conversations', family: 'admin', route: '/admin/conversations', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'conversationWorkspace'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-providers', label: 'Admin Providers', family: 'admin', route: '/admin/providers', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'providerEntity', 'trust/readiness'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-requests', label: 'Admin Requests', family: 'admin', route: '/admin/requests', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'economicRequest', 'audit'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-compliance', label: 'Admin Compliance', family: 'admin', route: '/admin/compliance', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'trust/readiness', 'privacyBridge'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-notifications', label: 'Admin Notifications', family: 'admin', route: '/admin/notifications', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'notificationService', 'notificationQueue'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-integrations', label: 'Admin Integrations', family: 'admin', route: '/admin/integrations', primaryNavigation: 'admin', semanticOwners: ['adminPlatformRoutes', 'externalIntegrationReadiness'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-ai', label: 'Admin AI operations', family: 'admin', route: '/admin/agents', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'aiProviderHealth', 'aiCostTelemetry'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-users', label: 'Admin Users', family: 'admin', route: '/admin/users', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'auth'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-pricing', label: 'Admin Pricing', family: 'admin', route: '/admin/pricing', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'pricingService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-referrals', label: 'Admin Referrals', family: 'admin', route: '/admin/referrals', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'referralService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-commissions', label: 'Admin Commissions', family: 'admin', route: '/admin/commissions', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'commissionService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-partnerships', label: 'Admin Partnerships', family: 'admin', route: '/admin/partnerships', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'partnerRoutes'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-trust', label: 'Admin Trust', family: 'admin', route: '/admin/trust', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'trustRoutes', 'providerVerification'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-social', label: 'Admin Social', family: 'admin', route: '/admin/social', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'socialScheduler'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-creators', label: 'Admin Creators', family: 'admin', route: '/admin/creators', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'content'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-analytics', label: 'Admin Analytics', family: 'admin', route: '/admin/analytics', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'analyticsEngine'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-revenue', label: 'Admin Revenue', family: 'admin', route: '/admin/revenue', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'commercialLedger', 'payment'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-marketing', label: 'Admin Marketing', family: 'admin', route: '/admin/marketing', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'adManager'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-advertising', label: 'Admin Advertising', family: 'admin', route: '/admin/advertising', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'adManager'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-content', label: 'Admin Content', family: 'admin', route: '/admin/content', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'content'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-curation', label: 'Admin Curation', family: 'admin', route: '/admin/curation', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'curationService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-settings', label: 'Admin Settings', family: 'admin', route: '/admin/settings', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'featureFlags', 'externalIntegrationReadiness', 'adminConfigMetadata'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-seo', label: 'Admin SEO', family: 'admin', route: '/admin/seo', primaryNavigation: 'admin', semanticOwners: ['seoAdminRoutes', 'seoService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'admin-roadmap', label: 'Admin Roadmap', family: 'admin', route: '/admin/roadmap', primaryNavigation: 'admin', semanticOwners: ['adminRoutes'], states: ['represented', 'implemented'], responsive: true },
];

export const MOBILE_PRIMARY_NAVIGATION = ['agent', 'discover', 'requests', 'tasks', 'more'] as const;
export const DESKTOP_AUTHENTICATED_HOME = 'web-desk' as const;

export function getClientSurface(id: string): ClientSurface | undefined { return CLIENT_SURFACES.find(surface => surface.id === id); }
export function getClientSurfaces(family: ClientFamily): ClientSurface[] { return CLIENT_SURFACES.filter(surface => surface.family === family); }
export function assertClientSurfaceOwnership(id: string, family: ClientFamily): ClientSurface { const surface = getClientSurface(id); if (!surface) throw new Error(`Unknown Kurukoo client surface: ${id}`); if (surface.family !== family) throw new Error(`Client surface ${id} belongs to ${surface.family}, not ${family}`); return surface; }

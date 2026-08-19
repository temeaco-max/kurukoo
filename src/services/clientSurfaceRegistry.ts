export type ClientFamily = 'web' | 'pwa' | 'native' | 'admin';
export type SurfaceState = 'represented' | 'implemented' | 'contract_tested' | 'external_activation' | 'device_verification';

export interface ClientSurface {
  id: string;
  label: string;
  family: ClientFamily;
  route: string;
  primaryNavigation: 'agent' | 'discover' | 'requests' | 'tasks' | 'connect' | 'marketing' | 'workspace' | 'admin' | 'secondary';
  semanticOwners: string[];
  states: SurfaceState[];
  responsive: boolean;
  nativeOnly?: boolean;
}

export const CLIENT_SURFACES: readonly ClientSurface[] = [
  { id: 'web-marketing', label: 'Marketing website', family: 'web', route: '/', primaryNavigation: 'marketing', semanticOwners: ['publicRoutes', 'marketing-content'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-chat', label: 'Web Chat', family: 'web', route: '/chat', primaryNavigation: 'agent', semanticOwners: ['canonicalChatTurnService', 'contextArbitration', 'conversationWorkspace'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-discover', label: 'Discover', family: 'web', route: '/discover', primaryNavigation: 'discover', semanticOwners: ['discoveryRoutes', 'nearbyPulse', 'opportunityEngine'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-requests', label: 'Requests', family: 'web', route: '/requests', primaryNavigation: 'requests', semanticOwners: ['economicRequest', 'order', 'checkout'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-tasks', label: 'Tasks', family: 'web', route: '/tasks', primaryNavigation: 'tasks', semanticOwners: ['task', 'agentRuntime', 'reminderService'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-connect', label: 'Connect', family: 'web', route: '/connect', primaryNavigation: 'connect', semanticOwners: ['connectionRoutes', 'externalIntegrationReadiness', 'artifactService'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'web-agents', label: 'Agents', family: 'web', route: '/agents', primaryNavigation: 'agent', semanticOwners: ['agentRuntime', 'agentRouter'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-wallet', label: 'Wallet / Points / Top Up', family: 'web', route: '/wallet', primaryNavigation: 'secondary', semanticOwners: ['payment', 'points', 'subscription'], states: ['represented', 'implemented'], responsive: true },
  { id: 'web-artifacts', label: 'Artifact History', family: 'web', route: '/artifacts', primaryNavigation: 'secondary', semanticOwners: ['artifactService', 'storageRouter'], states: ['represented', 'implemented'], responsive: true },
  { id: 'pwa-shell', label: 'PWA mobile app shell', family: 'pwa', route: '/', primaryNavigation: 'agent', semanticOwners: ['canonical API', 'service worker'], states: ['represented', 'implemented', 'contract_tested'], responsive: true },
  { id: 'native-ios', label: 'iOS application', family: 'native', route: 'native://ios', primaryNavigation: 'agent', semanticOwners: ['canonical API', 'native device adapters'], states: ['represented', 'implemented', 'device_verification'], responsive: false, nativeOnly: true },
  { id: 'native-android', label: 'Android application', family: 'native', route: 'native://android', primaryNavigation: 'agent', semanticOwners: ['canonical API', 'native device adapters'], states: ['represented', 'implemented', 'device_verification'], responsive: false, nativeOnly: true },
  { id: 'admin-control-room', label: 'Admin Control Room', family: 'admin', route: '/admin', primaryNavigation: 'admin', semanticOwners: ['adminRoutes', 'audit', 'externalIntegrationReadiness'], states: ['represented', 'implemented'], responsive: true },
];

export const MOBILE_PRIMARY_NAVIGATION = ['agent', 'discover', 'requests', 'tasks', 'connect'] as const;

export function getClientSurface(id: string): ClientSurface | undefined {
  return CLIENT_SURFACES.find(surface => surface.id === id);
}

export function getClientSurfaces(family: ClientFamily): ClientSurface[] {
  return CLIENT_SURFACES.filter(surface => surface.family === family);
}

export function assertClientSurfaceOwnership(id: string, family: ClientFamily): ClientSurface {
  const surface = getClientSurface(id);
  if (!surface) throw new Error(`Unknown Kurukoo client surface: ${id}`);
  if (surface.family !== family) throw new Error(`Client surface ${id} belongs to ${surface.family}, not ${family}`);
  return surface;
}

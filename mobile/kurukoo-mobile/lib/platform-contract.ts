/**
 * Cross-client implementation contract for platform work added after the Expo
 * shell was created. This is deliberately a contract/registry, not a second
 * backend authority: native surfaces call the canonical web/API owners.
 */
export type MobileCapabilityArea =
  | "discover"
  | "chat"
  | "notifications"
  | "agents"
  | "economic_requests"
  | "memory"
  | "provider_network"
  | "ai_runtime"
  | "safety"
  | "credentials"
  | "admin";

export type MobileCapabilityStatus = "implemented" | "client_ready" | "server_only" | "external_required" | "admin_only";

export interface MobileCapabilityContract {
  id: string;
  area: MobileCapabilityArea;
  title: string;
  status: MobileCapabilityStatus;
  canonicalOwner: string;
  nativeRoute: string | null;
  api: string[];
  notes: string;
}

/**
 * Keep this list complete when a new cross-platform backend capability lands.
 * `server_only` means no native UI is required yet; `client_ready` means the
 * native framework exists and the user surface can be built without changing
 * the ownership model; `external_required` means provider/device credentials
 * still decide runtime activation.
 */
export const MOBILE_PLATFORM_CONTRACTS: readonly MobileCapabilityContract[] = [
  {
    id: "discover",
    area: "discover",
    title: "Discover / Daily Picks / Topics / Opportunities",
    status: "implemented",
    canonicalOwner: "src/services/discoverExperience.ts",
    nativeRoute: "/(tabs)/discover",
    api: ["/api/discover/home", "/api/discover/items/:type/:id/actions", "/api/discover/promotions/:id/impression", "/api/discover/promotions/:id/click"],
    notes: "Native consumes the same canonical feed and watch/follow/save action boundary as web.",
  },
  {
    id: "chat-routing",
    area: "chat",
    title: "Canonical Chat and AI routing",
    status: "implemented",
    canonicalOwner: "src/services/canonicalChatTurnService.ts + src/services/fastTextService.ts",
    nativeRoute: "/(tabs)/chat",
    api: ["/api/chat/stream", "/api/chat/messages", "/api/chat/feedback"],
    notes: "Mobile never routes independently; backend remains the sole turn authority.",
  },
  {
    id: "notifications",
    area: "notifications",
    title: "Notifications and background continuation",
    status: "client_ready",
    canonicalOwner: "src/services/pushNotificationsCanonical.ts + internal_notifications",
    nativeRoute: "/surface/notifications",
    api: ["canonical notification endpoints"],
    notes: "Existing Expo notifications framework can receive Watch, reminder, request and continuation events without a parallel queue.",
  },
  {
    id: "agents",
    area: "agents",
    title: "First-class agents and bounded inference budgets",
    status: "client_ready",
    canonicalOwner: "src/services/agentRuntime.ts + src/services/agentInferenceBudgetService.ts",
    nativeRoute: "/surface/agents",
    api: ["agent canonical routes when enabled"],
    notes: "Native should expose goal/control/status views only; budget enforcement stays server-side.",
  },
  {
    id: "economic-requests",
    area: "economic_requests",
    title: "Economic Request lifecycle",
    status: "client_ready",
    canonicalOwner: "src/services/skillFlows.ts + src/services/economicRequest*",
    nativeRoute: "/surface/requests",
    api: ["canonical Economic Request routes"],
    notes: "Payment, quote, escrow and provider evidence remain server-owned; native displays canonical lifecycle state.",
  },
  {
    id: "memory",
    area: "memory",
    title: "Owner-scoped Memory",
    status: "client_ready",
    canonicalOwner: "src/services/memoryProfile.ts + livingMemoryEngine",
    nativeRoute: "/surface/memory",
    api: ["canonical memory routes"],
    notes: "Native never creates a competing memory store; only owner-authorized views/actions belong here.",
  },
  {
    id: "provider-network",
    area: "provider_network",
    title: "Provider discovery, verification and trust",
    status: "external_required",
    canonicalOwner: "src/services/discoveryNetwork.ts + providerVerificationLifecycle.ts",
    nativeRoute: "/surface/provider-network",
    api: ["/api/discover/*", "canonical provider verification routes"],
    notes: "UI can be built now; live provider availability/verification still depends on backend evidence and deployment.",
  },
  {
    id: "ai-runtime",
    area: "ai_runtime",
    title: "AI provider health, quotas, telemetry and fallback",
    status: "server_only",
    canonicalOwner: "src/services/unifiedAiEngine.ts + aiProviderHealthService.ts + aiQuotaService.ts",
    nativeRoute: null,
    api: [],
    notes: "Operator telemetry and provider health belong to protected admin/control surfaces, not the consumer app.",
  },
  {
    id: "safety",
    area: "safety",
    title: "Safety, check-ins and escalation boundaries",
    status: "client_ready",
    canonicalOwner: "src/services/safetyService.ts",
    nativeRoute: "/surface/safety",
    api: ["canonical safety routes"],
    notes: "Mobile must preserve explicit consent, trusted-contact and evidence boundaries.",
  },
  {
    id: "provider-credentials",
    area: "credentials",
    title: "Provider credential lifecycle",
    status: "admin_only",
    canonicalOwner: "src/services/providerCredentialService.ts",
    nativeRoute: null,
    api: [],
    notes: "Secrets, rotation, disable/revoke and connection tests are protected operator controls; never expose them to consumer native UI.",
  },
  {
    id: "admin-convergence",
    area: "admin",
    title: "AI telemetry, provider health and agent budgets",
    status: "admin_only",
    canonicalOwner: "src/routes/adminRoutes.ts",
    nativeRoute: null,
    api: [],
    notes: "Web Admin Control Room remains the canonical operator surface. Native consumer clients must not duplicate it.",
  },
] as const;

export function getMobileCapability(id: string): MobileCapabilityContract | undefined {
  return MOBILE_PLATFORM_CONTRACTS.find((item) => item.id === id);
}

export function assertMobileContractComplete(expectedIds: readonly string[]): void {
  const known = new Set(MOBILE_PLATFORM_CONTRACTS.map((item) => item.id));
  const missing = expectedIds.filter((id) => !known.has(id));
  if (missing.length) throw new Error(`Missing native platform contracts: ${missing.join(", ")}`);
}

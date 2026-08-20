import assert from "node:assert/strict";
import { MOBILE_PLATFORM_CONTRACTS, assertMobileContractComplete } from "../lib/platform-contract";

const required = [
  "discover",
  "chat-routing",
  "notifications",
  "agents",
  "economic-requests",
  "memory",
  "provider-network",
  "ai-runtime",
  "safety",
  "provider-credentials",
  "admin-convergence",
] as const;

assertMobileContractComplete(required);
assert.equal(new Set(MOBILE_PLATFORM_CONTRACTS.map((item) => item.id)).size, MOBILE_PLATFORM_CONTRACTS.length);
assert.ok(MOBILE_PLATFORM_CONTRACTS.some((item) => item.id === "discover" && item.status === "implemented"));
assert.ok(MOBILE_PLATFORM_CONTRACTS.every((item) => item.canonicalOwner.length > 0));
assert.ok(MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "admin_only").every((item) => item.nativeRoute === null));
assert.ok(MOBILE_PLATFORM_CONTRACTS.find((item) => item.id === "discover")?.api.includes("/api/discover/home"));

console.log(JSON.stringify({
  passed: true,
  contracts: MOBILE_PLATFORM_CONTRACTS.length,
  implemented: MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "implemented").length,
  clientReady: MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "client_ready").length,
  serverOnly: MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "server_only").length,
  externalRequired: MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "external_required").length,
  adminOnly: MOBILE_PLATFORM_CONTRACTS.filter((item) => item.status === "admin_only").length,
}, null, 2));

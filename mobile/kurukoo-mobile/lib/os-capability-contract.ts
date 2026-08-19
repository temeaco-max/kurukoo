export type OsLifecycleState = "Ready" | "Connected" | "Available" | "Needs your input" | "Pending" | "Draft" | "Saved" | "Paused" | "Running" | "Verified" | "Unavailable" | "Not claimed";

export const OS_CAPABILITY_SKILLS = [
  { name: "Planning", detail: "Turn intent into clear next steps", pulse: "Ready" as const, tone: "success" as const },
  { name: "Research", detail: "Ground answers in connected sources", pulse: "Connected" as const, tone: "success" as const },
  { name: "Teaching", detail: "Explain, practice and check understanding", pulse: "Available" as const, tone: "neutral" as const },
  { name: "Care & check-ins", detail: "Protective reminders and gentle follow-up", pulse: "Needs your input" as const, tone: "warning" as const },
] as const;

export const OS_ARTIFACTS = [
  { title: "Meeting brief", detail: "Draft agenda · source-backed", state: "Draft" as const },
  { title: "Opportunity response", detail: "Capability match · awaiting review", state: "Needs your input" as const },
  { title: "Voice note transcript", detail: "Saved to connected storage", state: "Saved" as const },
] as const;

export const OS_OPPORTUNITIES = [
  { title: "Community workshop facilitator", detail: "Capability match · source attributed · response pending", state: "Opportunity" },
  { title: "Prayer support circle", detail: "Network signal · provider status unverified", state: "Discover" },
] as const;

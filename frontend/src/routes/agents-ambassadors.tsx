import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/agents-ambassadors")({ component: LegacyAgentsAmbassadorsRedirect });
function LegacyAgentsAmbassadorsRedirect() { return <Navigate to="/local-agents" replace />; }

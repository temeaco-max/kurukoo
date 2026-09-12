import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  return <Navigate to="/settings" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceHome } from "@/components/kurukoo/workspace-home";

export const Route = createFileRoute("/perch")({
  head: () => ({
    meta: [
      { title: "Perch — Kurukoo" },
      { name: "description", content: "Your personal Perch for getting useful things done with Kurukoo." },
    ],
  }),
  component: PerchPage,
});

function PerchPage() {
  return <WorkspaceHome />;
}

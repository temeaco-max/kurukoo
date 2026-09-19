import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceHome } from "@/components/kurukoo/workspace-home";

export const Route = createFileRoute("/perch")({
  head: () => ({
    meta: [
      { title: "Your Field — Kurukoo" },
      {
        name: "description",
        content: "Your Kurukoo Field for conversation, Work, context and next steps.",
      },
    ],
  }),
  component: PerchPage,
});

function PerchPage() {
  return <WorkspaceHome />;
}

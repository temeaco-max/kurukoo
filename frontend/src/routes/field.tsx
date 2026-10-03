import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceHome } from "@/components/kurukoo/workspace-home";

export const Route = createFileRoute("/field")({
  head: () => ({
    meta: [
      { title: "Your Field — Kurukoo" },
      {
        name: "description",
        content: "Your Kurukoo Field for conversation, Work, context and next steps.",
      },
    ],
  }),
  component: FieldPage,
});

function FieldPage() {
  return <WorkspaceHome />;
}

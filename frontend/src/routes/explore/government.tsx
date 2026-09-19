import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/government")({ component: GovernmentPage });

function GovernmentPage() {
  return (
    <GoalActionSurface
      eyebrow="Life · Government services"
      title="Get a government task sorted"
      description="Tell Kurukoo what you are trying to do. It can help you find the relevant service, requirements and next step without pretending to complete an official action it cannot perform."
      actions={[
        {
          title: "Find the right service",
          description: "Describe the government task in ordinary language.",
          prompt: "Help me find the correct government service for what I need to do.",
        },
        {
          title: "Understand what I need",
          description: "Work through documents, requirements or steps you need to prepare.",
          prompt: "Help me understand what I need to prepare for a government service.",
        },
        {
          title: "Check an official route",
          description: "Find the appropriate official route before taking action.",
          prompt: "Help me find the official route for this government task.",
        },
      ]}
    />
  );
}

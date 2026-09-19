import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/health")({ component: HealthPage });

function HealthPage() {
  return (
    <GoalActionSurface
      eyebrow="Life · Health & care"
      title="Get health or care help"
      description="Start with what you need. Kurukoo can help you navigate suitable services while keeping urgent situations distinct from ordinary coordination."
      actions={[
        {
          title: "Find a health service",
          description: "Describe the kind of service or appointment you need.",
          prompt: "Help me find a suitable health service or appointment.",
        },
        {
          title: "Find a dentist",
          description: "Start with the care you need and your practical constraints.",
          prompt: "Help me find a dentist and arrange an appointment.",
        },
        {
          title: "Arrange care or support",
          description: "Describe the support you need and who it is for.",
          prompt: "Help me find suitable care or support.",
        },
        {
          title: "Find urgent help",
          description:
            "If this may be an emergency, say so clearly and Kurukoo will keep the urgent path separate.",
          prompt: "I need urgent health help. Help me identify the appropriate next step.",
        },
      ]}
    />
  );
}

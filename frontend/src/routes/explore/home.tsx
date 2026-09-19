import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/home")({ component: HomePage });

function HomePage() {
  return (
    <GoalActionSurface
      eyebrow="Home & things"
      title="Get home help"
      description="Describe the job, the place and when you need it. Kurukoo can turn the need into a focused service request."
      actions={[
        {
          title: "Find a cleaner",
          description: "Arrange help with regular or one-off home cleaning.",
          prompt: "Help me find someone for home cleaning.",
        },
        {
          title: "Get laundry help",
          description: "Start a laundry collection, service or delivery request.",
          prompt: "Help me arrange laundry help.",
        },
        {
          title: "Get garden or outdoor help",
          description: "Describe the work that needs doing and where.",
          prompt: "Help me find someone for garden or outdoor work.",
        },
        {
          title: "Get waste or fumigation help",
          description: "Find the appropriate route for a home maintenance need.",
          prompt: "Help me arrange waste collection or fumigation.",
        },
      ]}
    />
  );
}

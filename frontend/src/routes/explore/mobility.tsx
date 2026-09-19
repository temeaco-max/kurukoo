import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/mobility")({ component: MobilityPage });

function MobilityPage() {
  return (
    <GoalActionSurface
      eyebrow="Getting around · Mobility"
      title="Get where you need to go"
      description="Give Kurukoo the journey, timing and useful constraints. It can move the request into the appropriate mobility flow."
      actions={[
        {
          title: "Get a ride",
          description: "Start with where you are, where you are going and when.",
          prompt: "I need a ride. Help me arrange the journey.",
        },
        {
          title: "Plan a journey",
          description: "Work through a trip with the places and timing that matter.",
          prompt: "Help me plan a journey and work out the best options.",
        },
        {
          title: "Find transport nearby",
          description: "Explore available mobility options around you.",
          prompt: "Help me find transport options nearby.",
        },
        {
          title: "Arrange a longer trip",
          description: "Keep the whole journey in one coordinated request.",
          prompt: "Help me arrange a longer-distance trip.",
        },
      ]}
    />
  );
}

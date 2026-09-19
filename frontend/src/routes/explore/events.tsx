import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/events")({ component: EventsPage });

function EventsPage() {
  return (
    <GoalActionSurface
      eyebrow="People & community · Events"
      title="Find something happening"
      description="Start with an activity, place or date. Kurukoo can help discover relevant events and move the useful choice into conversation."
      actions={[
        {
          title: "Find events nearby",
          description: "Discover activities around a location that matters to you.",
          prompt: "Find interesting events happening nearby.",
        },
        {
          title: "Find something for tonight",
          description: "Use a time-based request instead of browsing an endless feed.",
          prompt: "Find something good happening tonight.",
        },
        {
          title: "Find sport to watch",
          description: "Look for relevant fixtures, games or sporting events.",
          prompt: "Help me find sport to watch or attend.",
        },
        {
          title: "Plan an event",
          description: "Turn an idea into a coordinated event request.",
          prompt: "Help me plan an event.",
        },
      ]}
    />
  );
}

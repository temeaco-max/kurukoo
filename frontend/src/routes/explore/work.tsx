import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/work")({ component: WorkPage });

function WorkPage() {
  return (
    <GoalActionSurface
      eyebrow="Money & work · Work"
      title="Find work or get a job done"
      description="Use Kurukoo to turn a work goal into a focused request, opportunity search or coordinated task."
      actions={[
        {
          title: "Find work",
          description: "Describe the kind of work you want and where it should be.",
          prompt: "Help me find suitable work opportunities.",
        },
        {
          title: "Find a gig",
          description: "Start with a specific short-term task or service you can do.",
          prompt: "Help me find a suitable gig or short-term work.",
        },
        {
          title: "Hire someone",
          description: "Describe the work you need done and move toward suitable providers.",
          prompt: "I need to hire someone for a job. Help me find suitable people.",
        },
        {
          title: "Post an opportunity",
          description: "Turn a need into a clear opportunity for the right people.",
          prompt: "Help me create a work opportunity for someone to take on.",
        },
      ]}
    />
  );
}

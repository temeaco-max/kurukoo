import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/community")({ component: CommunityPage });

function CommunityPage() {
  return (
    <GoalActionSurface
      eyebrow="People & community"
      title="Find people who can help"
      description="Explore local knowledge, community context and useful connections without confusing community information with fulfilment proof."
      actions={[
        {
          title: "Find local help",
          description: "Describe what you need and the kind of person or service that could help.",
          prompt: "Help me find someone nearby who can help with what I need.",
        },
        {
          title: "Find something happening",
          description: "Look for events, activities and useful local opportunities.",
          prompt: "Help me find something happening nearby.",
        },
        {
          title: "Ask the community",
          description: "Use a Topic when lived experience or local opinion is the useful input.",
          prompt: "Help me find the relevant Kurukoo community Topic for this question.",
        },
        {
          title: "Find a group",
          description: "Start from an interest, activity or shared goal.",
          prompt: "Help me find a relevant community or group.",
        },
      ]}
    />
  );
}

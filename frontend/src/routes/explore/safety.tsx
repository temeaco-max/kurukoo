import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/safety")({ component: SafetyPage });

function SafetyPage() {
  return (
    <GoalActionSurface
      eyebrow="Safety & urgent help"
      title="Get the right help quickly"
      description="Choose the kind of help you need. Urgent situations should use the appropriate emergency service rather than waiting for an ordinary marketplace flow."
      actions={[
        {
          title: "Get urgent help",
          description: "Tell Kurukoo what is happening so it can keep the urgent path clear.",
          prompt: "I need urgent help. Help me identify the appropriate immediate next step.",
        },
        {
          title: "Find security help",
          description:
            "Start a security or protection request where a coordinated service is appropriate.",
          prompt: "I need security help. Help me find the appropriate service.",
        },
        {
          title: "Check a local safety concern",
          description:
            "Use community context for local awareness, without treating it as verified emergency information.",
          prompt:
            "Help me understand a local safety concern and find the appropriate source of help.",
        },
      ]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/repairs")({ component: RepairsPage });

function RepairsPage() {
  return (
    <GoalActionSurface
      eyebrow="Home & things · Repairs"
      title="Fix something"
      description="Describe the thing that needs fixing. Kurukoo can help clarify the job, find the right route and coordinate the next step."
      actions={[
        {
          title: "Repair a phone or device",
          description: "Start with the device, problem and how you want the repair handled.",
          prompt: "I need someone to repair my phone or device. Help me arrange it.",
        },
        {
          title: "Fix something at home",
          description: "Describe the problem and let Kurukoo work out the right service.",
          prompt: "I need something fixed at home. Help me find the right repair service.",
        },
        {
          title: "Get a repair quote",
          description: "Start a repair request and work toward a confirmed quote.",
          prompt: "I need a quote for a repair. Help me find suitable providers.",
        },
        {
          title: "Send a repair away",
          description: "Coordinate a mail-in or drop-off repair where supported.",
          prompt: "Help me arrange a mail-in or drop-off repair.",
        },
      ]}
    />
  );
}

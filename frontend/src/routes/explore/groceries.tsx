import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/groceries")({ component: GroceriesPage });

function GroceriesPage() {
  return (
    <GoalActionSurface
      eyebrow="Everyday · Groceries"
      title="Get your groceries"
      description="Start with what you need. Kurukoo can help turn a list, top-up or recurring need into a practical request."
      actions={[
        {
          title: "Build a grocery list",
          description: "Describe what you need and organise it into a useful request.",
          prompt: "Help me make a grocery list and work out the best way to get it.",
        },
        {
          title: "Top up my groceries",
          description: "Start from the items you are running low on.",
          prompt: "I need a grocery top-up. Help me work out what to get and how to get it.",
        },
        {
          title: "Find a nearby shop",
          description: "Discover suitable local options before deciding.",
          prompt: "Find suitable nearby places for my grocery shopping.",
        },
        {
          title: "Repeat a regular shop",
          description: "Use conversation to recreate a recurring grocery need.",
          prompt: "Help me organise my regular grocery shop.",
        },
      ]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/food")({ component: FoodPage });

function FoodPage() {
  return (
    <GoalActionSurface
      eyebrow="Everyday · Food"
      title="Get food sorted"
      description="Tell Kurukoo what you want to eat or where you want it from. It can turn the request into the appropriate fulfilment flow."
      actions={[
        {
          title: "Order a meal",
          description: "Tell Kurukoo what you want, your area and any useful preferences.",
          prompt: "I want to order food. Help me find suitable options and arrange it.",
        },
        {
          title: "Find a place to eat",
          description: "Discover restaurants or food spots, then decide what to do.",
          prompt: "Find me good places to eat nearby and help me choose one.",
        },
        {
          title: "Get a specific dish",
          description: "Start with the dish and let Kurukoo work out the next step.",
          prompt: "I want to get a specific dish. Help me find it and arrange it.",
        },
        {
          title: "Sort food for a group",
          description: "Coordinate a larger or shared food request in one conversation.",
          prompt: "Help me arrange food for a group.",
        },
      ]}
    />
  );
}

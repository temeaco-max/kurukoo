import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/selling")({ component: SellingPage });

function SellingPage() {
  return (
    <GoalActionSurface
      eyebrow="Money & work · Selling"
      title="Sell something"
      description="Turn an item you want to sell into a clear listing or a conversation about where and how to sell it."
      actions={[
        {
          title: "Sell an item",
          description: "Describe what you have and let Kurukoo help shape the listing.",
          prompt: "Help me sell an item.",
        },
        {
          title: "Sell locally",
          description: "Start with your item and preferred local area.",
          prompt: "Help me sell this item locally.",
        },
        {
          title: "Find buyers",
          description: "Describe the item and the kind of buyer you want to reach.",
          prompt: "Help me find suitable buyers for something I want to sell.",
        },
        {
          title: "Check a price",
          description: "Get help understanding a sensible asking price before listing.",
          prompt: "Help me check the price of an item I want to sell.",
        },
      ]}
    />
  );
}

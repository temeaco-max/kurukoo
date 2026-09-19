import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/prayer")({ component: PrayerPage });

function PrayerPage() {
  return (
    <GoalActionSurface
      eyebrow="Life · Prayer & reflection"
      title="Pray or reflect"
      description="Use Kurukoo's AI spiritual-support path for prayer, reflection and faith-oriented conversation. It is an AI companion, not an ordained religious authority."
      actions={[
        {
          title: "Pray with me",
          description: "Start a guided prayer or reflective conversation.",
          prompt: "Pray with me.",
        },
        {
          title: "Reflect with me",
          description: "Use a calm conversation to reflect on what is happening.",
          prompt: "Help me reflect on what I am going through.",
        },
        {
          title: "Explore a faith question",
          description: "Ask a faith-oriented question and keep the conversation focused.",
          prompt: "Help me explore a faith question.",
        },
        {
          title: "Find human support",
          description:
            "If you want pastoral or community support, ask Kurukoo to help find an appropriate human route.",
          prompt: "Help me find appropriate human faith or community support.",
        },
      ]}
    />
  );
}

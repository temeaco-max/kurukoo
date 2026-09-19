import { createFileRoute } from "@tanstack/react-router";
import { GoalActionSurface } from "@/components/kurukoo/goal-action-surface";

export const Route = createFileRoute("/explore/learning")({ component: LearningPage });

function LearningPage() {
  return (
    <GoalActionSurface
      eyebrow="Life · Learning"
      title="Learn or study"
      description="Start with the outcome you want to learn. Kurukoo can help turn it into a focused study, tutor or information request."
      actions={[
        {
          title: "Find a tutor",
          description: "Describe the subject, level and practical constraints.",
          prompt: "Help me find a suitable tutor.",
        },
        {
          title: "Study something",
          description: "Ask Kurukoo to help structure a study goal or next step.",
          prompt: "Help me study something and make a plan.",
        },
        {
          title: "Learn a language",
          description: "Start a focused language-learning conversation.",
          prompt: "Help me learn a language.",
        },
        {
          title: "Find an education service",
          description: "Describe the form, result or education task you need help navigating.",
          prompt: "Help me find the right education service for what I need.",
        },
      ]}
    />
  );
}

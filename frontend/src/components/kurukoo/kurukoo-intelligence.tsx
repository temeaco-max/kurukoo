import { Panel } from "@/components/kurukoo/ui";

const intelligence = [
  [
    "Understands what you mean, not just what you say",
    "Kurukoo interprets natural language, intent, requirements, urgency, location, timing, and the outcome you want.",
  ],
  [
    "Understands context",
    "It remembers what you were discussing, recognises follow-up questions, handles interruptions, and lets you return to an earlier request without starting again.",
  ],
  [
    "Knows when something is unclear",
    "Instead of guessing, Kurukoo asks a concise clarification question when it lacks the information needed to act safely.",
  ],
  [
    "Turns conversations into action",
    "It works out the right next step, selects the appropriate capability, and coordinates tasks, services, providers, agents, or people when needed.",
  ],
  [
    "Connects the dots across your life",
    "Kurukoo can use approved profile information, preferences, recurring needs, previous requests, reminders, and outcomes to reduce repetition and provide more relevant help.",
  ],
  [
    "Learns your preferences over time",
    "With your permission, it can remember how you like to communicate, what matters to you, and how you prefer tasks and updates to be handled.",
  ],
  [
    "Prioritises what needs your attention",
    "Kurukoo can surface important requests, reminders, notifications, deadlines, blockers, and progress updates so you know what matters next.",
  ],
  [
    "Coordinates complex requests",
    "A simple request such as “I need someone to repair this” can become a structured process: understand the need, identify requirements, find suitable help, coordinate the next step, and track progress.",
  ],
  [
    "Uses specialised Kurukoo intelligence",
    "Its AI is designed to understand Kurukoo’s own concepts, services, requests, providers, agents, memory, notifications, Topics, Radar, and user workflows.",
  ],
  [
    "Maintains continuity across channels",
    "Your context can continue across Chat and supported channels rather than creating separate, disconnected assistants.",
  ],
  [
    "Separates suggestions from truth",
    "AI can interpret, reason, recommend, and draft, while authoritative Kurukoo services control permissions, payments, fulfilment, evidence, and external actions.",
  ],
  [
    "Does not invent results",
    "Kurukoo should not claim that a provider is verified, a payment succeeded, a service is available, or a task was completed without reliable evidence.",
  ],
  [
    "Keeps actions bounded and safe",
    "Consequential actions require the appropriate authorisation, confirmation, policy checks, and canonical service controls.",
  ],
  [
    "Improves through evaluation",
    "Kurukoo’s intelligence can be refined using privacy-safe, curated examples and tested against ambiguity, contradictory inputs, safety scenarios, and real product workflows.",
  ],
  [
    "Gets smarter about the route to the outcome",
    "You start with the result you want; Kurukoo works out whether the best route is software assistance, a reminder, a provider, a business, an agent, or another supported service.",
  ],
] as const;

export function KurukooIntelligenceSection() {
  return (
    <section aria-labelledby="kurukoo-intelligence-title">
      <div className="mb-5 max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          The Kurukoo Intelligence
        </p>
        <h2
          id="kurukoo-intelligence-title"
          className="mt-1.5 font-serif text-[28px] leading-tight tracking-[-0.035em]"
        >
          Kurukoo’s intelligence
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
          Kurukoo’s intelligence is the ability to understand your situation, remember what matters,
          decide what should happen next, coordinate the right help, and remain truthful about the
          result.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {intelligence.map(([title, body]) => (
          <Panel key={title} className="p-4">
            <h3 className="text-[13.5px] font-semibold leading-snug">{title}</h3>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Brain, Clock3, Cpu, Square, Workflow } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { KurukooIntelligenceSection } from "@/components/kurukoo/kurukoo-intelligence";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/kurukoo-ai")({
  head: () => ({
    meta: [
      { title: "Kurukoo AI — Kurukoo" },
      {
        name: "description",
        content:
          "Understand the intelligence behind Kurukoo and how it helps turn everyday needs into coordinated action.",
      },
    ],
  }),
  component: KurukooAIPage,
});
const quickJobs = [
  "Get me a ride",
  "Find a plumber",
  "Order food",
  "Repair my phone",
  "Pray with me",
  "Plan my day",
];
function KurukooAIPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 pb-8">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          KURUKOO AI
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em]">
          Built around getting things done
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo combines conversation, a decision-making Brain, specialised AI models and
          canonical services so intelligence can help with the work without becoming the source of
          truth.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AskKurukoo prompt="Help me understand Kurukoo's AI." />
          <Link
            to="/login"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-elevated"
          >
            Log in to manage agents
          </Link>
        </div>
      </header>
      <section aria-labelledby="kurukoo-ai-title">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            THE KURUKOO AI STACK
          </p>
          <h2 id="kurukoo-ai-title" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            A Brain, a specialised model and the services that make action real.
          </h2>
          <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
            The architecture keeps intelligence and execution separate: the model helps interpret
            meaning, while canonical Kurukoo services own truth, permissions, evidence and actions.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Panel className="p-4">
            <Brain className="size-5 text-primary" />
            <h3 className="mt-3 text-[13.5px] font-semibold">Kurukoo Brain</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Context, state and next-step arbitration sit at the centre of the system.
            </p>
          </Panel>
          <Panel className="p-4">
            <Cpu className="size-5 text-primary" />
            <h3 className="mt-3 text-[13.5px] font-semibold">Kurukoo-SmolLM2</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              The initial specialised student model is SmolLM2-1.7B-Instruct, shaped around
              Kurukoo's scenarios and language.
            </p>
          </Panel>
          <Panel className="p-4">
            <Workflow className="size-5 text-primary" />
            <h3 className="mt-3 text-[13.5px] font-semibold">Canonical services</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Requests, discovery, providers, work, memory, agents and other services turn an
              interpreted need into governed action.
            </p>
          </Panel>
          <Panel className="p-4">
            <span className="grid size-5 place-items-center rounded-full bg-brand-tint text-brand-ink text-[10px] font-bold">
              ✓
            </span>
            <h3 className="mt-3 text-[13.5px] font-semibold">Truth stays canonical</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              AI can propose meaning; it does not invent availability, pricing, permissions or
              outcomes.
            </p>
          </Panel>
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <Panel className="p-4">
          <Bot className="size-5 text-primary" />
          <h2 className="mt-3 text-[14px] font-semibold">Start with an outcome</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Tell Kurukoo what needs doing instead of learning a list of commands.
          </p>
        </Panel>
        <Panel className="p-4">
          <Clock3 className="size-5 text-primary" />
          <h2 className="mt-3 text-[14px] font-semibold">Keep it moving</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Supported tasks can continue through the appropriate request and work flow.
          </p>
        </Panel>
        <Panel className="p-4">
          <Square className="size-5 text-primary" />
          <h2 className="mt-3 text-[14px] font-semibold">Stay in control</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Important actions remain visible and can require your approval before they happen.
          </p>
        </Panel>
      </section>
      <section>
        <SectionHeader
          title="Ways to start"
          subtitle="You can begin in Conversation, Explore or from an agent-enabled task."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickJobs.map((job) => (
            <Link
              key={job}
              to="/chat"
              search={{ query: job } as never}
              className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-surface px-4 text-[12.5px] font-medium hover:bg-elevated"
            >
              {job}
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
      <KurukooIntelligenceSection />
    </div>
  );
}

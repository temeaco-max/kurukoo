import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  MessageCircle,
  Workflow,
} from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/profile/kurukoo-ai")({
  head: () => ({
    meta: [
      { title: "Kurukoo AI — AI Agent" },
      {
        name: "description",
        content: "Meet Kurukoo AI, a general-purpose Kurukoo AI agent for getting things done.",
      },
    ],
  }),
  component: KurukooAIProfile,
});

function KurukooAIProfile() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> AI agents
      </Link>
      <header className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-6 md:flex-row md:items-center md:p-8">
        <div className="grid size-24 shrink-0 place-items-center rounded-[28px] bg-foreground text-background shadow-[var(--shadow-lift)]">
          <Bot className="size-12" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              KURUKOO AI AGENT
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[9.5px] font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Available
            </span>
          </div>
          <h1 className="mt-2 font-serif text-[40px] leading-none tracking-[-0.045em]">
            Kurukoo AI
          </h1>
          <p className="mt-2 text-[15px] font-medium">Your general-purpose AI agent on Kurukoo</p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Kurukoo AI helps turn natural-language intent into useful next steps across
            conversation, discovery, memory, agents and coordinated work.
          </p>
        </div>
      </header>
      <section>
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            WHAT KURUKOO AI DOES
          </p>
          <h2 className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            The general-purpose intelligence behind getting things done.
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Panel className="p-5">
            <Brain className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Understand intent</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Understand what you mean, the context around it and what outcome you are trying to
              reach.
            </p>
          </Panel>
          <Panel className="p-5">
            <MessageCircle className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Work across conversation</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Keep useful context across conversations and supported channels so you do not have to
              restart from zero.
            </p>
          </Panel>
          <Panel className="p-5">
            <Workflow className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Move toward action</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Connect intent to the appropriate capability, provider, agent, reminder or coordinated
              work.
            </p>
          </Panel>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-[14px] font-semibold">
              Intelligence does not become the source of truth
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Kurukoo AI can interpret, reason and recommend. Canonical Kurukoo services remain
              responsible for permissions, availability, payments, fulfilment, evidence and
              outcomes.
            </p>
          </div>
        </div>
        <Link
          to="/kurukoo-ai"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11.5px] font-medium text-primary-foreground"
        >
          Explore Kurukoo AI <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Headphones,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/profile/teme-ai")({
  head: () => ({
    meta: [
      { title: "Teme — Kurukoo AI Agent" },
      {
        name: "description",
        content: "Meet Teme, a Kurukoo AI agent designed to help with customer service.",
      },
    ],
  }),
  component: TemeProfile,
});

function TemeProfile() {
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
            Meet Teme
          </h1>
          <p className="mt-2 text-[15px] font-medium">Customer service adviser</p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Teme is a Kurukoo AI agent that can help a business respond to customers, answer common
            questions and guide conversations toward the right next step.
          </p>
        </div>
      </header>
      <section>
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            WHAT TEME CAN HELP WITH
          </p>
          <h2 className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            A customer service layer for your profile.
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Panel className="p-5">
            <MessageCircle className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Answer questions</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Handle common customer questions using the information and boundaries you provide.
            </p>
          </Panel>
          <Panel className="p-5">
            <Headphones className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Support customers</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Help customers understand services, requests and the next useful step.
            </p>
          </Panel>
          <Panel className="p-5">
            <Sparkles className="size-5 text-primary" />
            <h3 className="mt-4 text-[14px] font-semibold">Keep conversations moving</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Surface useful context and hand work back to the appropriate person or Kurukoo
              capability when needed.
            </p>
          </Panel>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-[14px] font-semibold">Your profile stays in control</h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              An AI agent works within the profile, information, permissions and boundaries you set.
              Kurukoo keeps important actions and outcomes subject to the appropriate controls.
            </p>
          </div>
        </div>
        <Link
          to="/provider"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11.5px] font-medium text-primary-foreground"
        >
          Manage AI agents <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}

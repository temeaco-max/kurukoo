import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Compass,
  Heart,
  Lock,
  MessageCircle,
  Network,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Composer } from "@/components/kurukoo/composer";

const prompts = [
  "Find someone to fix my phone",
  "Help me plan my day",
  "Find somewhere good for dinner",
  "Get me a ride",
  "Remind me about something",
  "Help me get this done",
] as const;
const examples = [
  [
    "Find a reliable electrician tomorrow",
    "Work through the requirement, timing and route before anything consequential happens.",
  ],
  [
    "Prepare me for my client call",
    "Bring together useful context, structure the work and keep the result with you.",
  ],
  [
    "Find somewhere good for dinner nearby",
    "Start with the outcome and narrow the choice with useful context.",
  ],
] as const;
const capabilities = [
  [MessageCircle, "Ask", "Start naturally. No category, form or workflow to learn."],
  [Target, "Get things done", "Turn a request into real work and keep it moving."],
  [Network, "Find", "Use people, places, services, tools and opportunities in context."],
  [ShieldCheck, "Stay in control", "See what will happen and approve consequential actions."],
  [Heart, "Remember", "Keep useful context so future conversations can start further ahead."],
  [Zap, "Notice", "Get useful proactive help when there is a genuine reason to interrupt you."],
] as const;

export function PublicHome({ onSend }: { onSend?: (message: string) => void }) {
  const [ads, setAds] = useState<Array<{ id: number | string; title: string; desc?: string; imageUrl?: string; alt?: string; destination?: string; clickUrl?: string | null; ctaText?: string; disclosure?: string; placement?: string }>>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  useEffect(() => {
    fetch("/api/public-ads")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ads"))))
      .then((data) => setAds(Array.isArray(data.campaigns) ? data.campaigns : []))
      .catch(() => setAds([]));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => setPromptIndex((value) => (value + 1) % prompts.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, []);
  const managedAd = ads.find((ad) => ad.placement === "public_business") ?? ads.find((ad) => ad.placement === "public_diaspora") ?? null;
  const sendPrompt = (prompt: string) => {
    onSend?.(prompt);
    window.location.href = "/chat";
  };
  const shuffle = () =>
    setPromptIndex(
      (value) => (value + 1 + Math.floor(Math.random() * (prompts.length - 1))) % prompts.length,
    );

  return (
    <div className="w-full pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What can Kurukoo do?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Kurukoo is a conversational fulfilment network. Describe your need and Kurukoo works out who or what can help and stays connected to the outcome.",
                },
              },
              {
                "@type": "Question",
                name: "Do I need an account?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "You can use Kurukoo as a guest. When an action needs your identity, you sign in inside the same conversation.",
                },
              },
            ],
          }),
        }}
      />
      <link rel="stylesheet" href="/css/kurukoo-home.css?v=3.0.1" />
      <section
        id="public-home-hero"
        className="relative min-h-[calc(100vh-120px)] overflow-hidden border-b border-border/80 py-8 md:py-12"
      >
        <div className="pointer-events-none absolute right-[-12%] top-[-18%] size-[520px] rounded-full bg-brand-tint/25 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-[-12%] left-[18%] size-[300px] rounded-full bg-primary/5 blur-[90px]" />
        <div className="relative grid min-h-[70vh] items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
          <div className="max-w-4xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Kurukoo AI
            </div>
            <h1 className="max-w-4xl font-serif text-[52px] leading-[.92] tracking-[-0.065em] md:text-[78px] lg:text-[92px]">
              Your Everyday AI
              <br />
              <span className="text-muted-foreground/70">that gets things done.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-muted-foreground md:text-[17px]">
              You say what you want. Kurukoo works out what matters, helps find the route, and stays
              with you until there is a useful outcome.
            </p>
            <div className="mt-7 max-w-3xl">
              <Composer
                onSend={onSend ?? (() => undefined)}
                voiceOverlayTargetId="public-home-hero"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
                <div className="flex min-w-max gap-2">
                  {Array.from({ length: 4 }, (_, offset) => {
                    const prompt = prompts[(promptIndex + offset) % prompts.length];
                    return (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendPrompt(prompt)}
                        className="shrink-0 border border-border/80 bg-background/70 px-3 py-2 text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                      >
                        {prompt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={shuffle}
                aria-label="Shuffle prompts"
                className="grid size-9 shrink-0 place-items-center border border-border/80 bg-background/70 text-muted-foreground hover:text-foreground"
              >
                <Shuffle className="size-3.5" />
              </button>
            </div>
          </div>
          <aside className="hidden border-l border-border/80 pl-7 lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              The promise
            </p>
            <p className="mt-4 font-serif text-[27px] leading-[1.05] tracking-[-0.035em]">
              Less figuring out.
              <br />
              More moving forward.
            </p>
            <div className="mt-8 space-y-4 text-[11.5px] leading-5 text-muted-foreground">
              <p>
                <span className="text-foreground">Digital.</span> Research, organise, plan, write
                and coordinate.
              </p>
              <p>
                <span className="text-foreground">Real world.</span> Find people, places and
                services that can help.
              </p>
              <p>
                <span className="text-foreground">Your call.</span> Kurukoo asks before
                consequential actions.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-border/80 py-10 md:py-12">
        <div className="mx-auto w-full max-w-[1160px] px-5 md:px-9">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Daily picks</h2>
            <Link to="/discover" className="text-[12px] text-primary">Browse Discover →</Link>
          </div>
          {ads.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Daily picks will appear here when an approved first-party campaign is active.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ads.filter((ad) => ad.id !== managedAd?.id).slice(0, 3).map((ad) => (
                <a
                  key={ad.id}
                  href={ad.clickUrl || ad.destination || "/advertise"}
                  className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
                >
                  <span className="inline-flex w-fit items-center rounded-full bg-brand-tint/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink">
                    {ad.disclosure || "Sponsored"}
                  </span>
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt={ad.alt || ad.title} className="h-32 w-full rounded-xl object-cover" loading="lazy" />
                  ) : null}
                  <strong className="text-[13.5px]">{ad.title}</strong>
                  {ad.desc ? <small className="text-[12px] leading-5 text-muted-foreground">{ad.desc}</small> : null}
                </a>
              ))}
            </div>
          )}
          {managedAd ? (
            <a
              href={managedAd.clickUrl || managedAd.destination || "/advertise"}
              className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-elevated p-4"
            >
              <span className="text-[12.5px] font-medium">
                <span className="mr-2 inline-flex rounded-full bg-brand-tint/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink">
                  {managedAd.disclosure || "Sponsored"}
                </span>
                {managedAd.title}
                {managedAd.desc ? <span className="ml-2 text-muted-foreground">{managedAd.desc}</span> : null}
              </span>
              <b className="text-[12px] text-primary">{managedAd.ctaText || "Learn more"} →</b>
            </a>
          ) : null}
        </div>
      </section>

      <section className="border-b border-border/80 py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Why it feels different
            </p>
            <h2 className="mt-3 max-w-md font-serif text-[36px] leading-[.98] tracking-[-0.05em] md:text-[48px]">
              One relationship.
              <br />
              Many things done.
            </h2>
          </div>
          <div className="grid gap-px border border-border/80 bg-border/80 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(([Icon, title, detail]) => {
              const C = Icon as typeof Sparkles;
              return (
                <div
                  key={title as string}
                  className="group min-h-[155px] bg-background p-5 transition-colors hover:bg-surface"
                >
                  <C
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    strokeWidth={1.7}
                  />
                  <p className="mt-9 text-[13px] font-semibold">{title as string}</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                    {detail as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-b border-border/80 py-14 md:py-20"
        aria-labelledby="examples-title"
      >
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Real life
            </p>
            <h2
              id="examples-title"
              className="mt-3 font-serif text-[34px] leading-none tracking-[-0.045em] md:text-[44px]"
            >
              Start with the outcome.
            </h2>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                setExampleIndex((value) => (value + examples.length - 1) % examples.length)
              }
              aria-label="Previous example"
              className="grid size-9 place-items-center border border-border text-muted-foreground hover:text-foreground"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setExampleIndex((value) => (value + 1) % examples.length)}
              aria-label="Next example"
              className="grid size-9 place-items-center border border-border text-muted-foreground hover:text-foreground"
            >
              →
            </button>
          </div>
        </div>
        <div className="mt-8 grid gap-px border border-border/80 bg-border/80 md:grid-cols-3">
          {examples.map(([ask, answer], index) => (
            <Link
              key={ask}
              to="/chat"
              className={`group min-h-[245px] bg-background p-6 transition-colors hover:bg-surface ${index === exampleIndex ? "ring-1 ring-inset ring-foreground/10" : ""}`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">0{index + 1}</span>
              <p className="mt-12 max-w-sm text-[17px] font-medium leading-[1.25] tracking-[-0.02em]">
                “{ask}”
              </p>
              <p className="mt-4 max-w-sm text-[11.5px] leading-5 text-muted-foreground">
                {answer}
              </p>
              <span className="mt-7 inline-flex items-center gap-1 text-[10.5px] font-medium">
                Try it{" "}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-b border-border/80 py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              How Kurukoo moves
            </p>
            <h2 className="mt-3 max-w-md font-serif text-[36px] leading-[.98] tracking-[-0.05em] md:text-[48px]">
              Conversation → action → outcome.
            </h2>
          </div>
          <div className="border-t border-border/80">
            {[
              [
                MessageCircle,
                "Tell it what you need",
                "Start in plain language. Kurukoo works with the context you give it.",
              ],
              [
                Compass,
                "Find a useful route",
                "Discover the people, places, tools or information that can move the request forward.",
              ],
              [
                ShieldCheck,
                "Approve when it matters",
                "You see consequential actions before Kurukoo takes them.",
              ],
              [Sparkles, "See what happened", "Work, evidence and outcomes stay connected."],
            ].map(([Icon, title, detail], index) => {
              const C = Icon as typeof Sparkles;
              return (
                <div
                  key={title as string}
                  className="grid gap-4 border-b border-border/80 py-5 sm:grid-cols-[32px_170px_minmax(0,1fr)] sm:items-start"
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    0{index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <C className="size-4 text-muted-foreground" />
                    <p className="text-[13px] font-semibold">{title as string}</p>
                  </div>
                  <p className="text-[11.5px] leading-5 text-muted-foreground">
                    {detail as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="relative overflow-hidden bg-foreground px-6 py-12 text-background md:px-10 md:py-16">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-background/10 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/55">
                Kurukoo
              </p>
              <h2 className="mt-4 max-w-2xl font-serif text-[38px] leading-[.98] tracking-[-0.05em] md:text-[56px]">
                Your everyday AI
                <br />
                that gets things done.
              </h2>
              <p className="mt-5 max-w-xl text-[13px] leading-6 text-background/65">
                Bring one thing. Then another. Kurukoo is designed to stay useful as the work gets
                real.
              </p>
            </div>
            <Link
              to="/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-background px-5 text-[11px] font-semibold text-foreground transition-transform hover:-translate-y-0.5"
            >
              Start with Kurukoo <ArrowRight className="size-4" />
            </Link>
          </div>
                </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto w-full max-w-[1160px] px-5 md:px-9">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Privacy & safety
              </p>
              <h2 className="mt-4 font-serif text-[36px] leading-[.98] tracking-[-0.05em] md:text-[48px]">
                Your data, approvals, and evidence stay yours.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground md:text-[17px]">
                Kurukoo never asks for your passwords. When an action requires your approval — a
                purchase, a booking, an email — you see the details before anything happens.
                Conversations, work history, and outcomes stay connected so nothing is lost.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/legal/privacy"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:opacity-70"
                >
                  Read the privacy policy <ArrowRight className="size-3" />
                </Link>
                <Link
                  to="/legal/safety"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:opacity-70"
                >
                  Trust & safety <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:justify-end">
              <div className="flex flex-col items-center rounded-xl border border-border/60 bg-surface p-4 text-center">
                <ShieldCheck className="size-6 text-primary" />
                <p className="mt-2 text-[11px] font-semibold">You approve first</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Consequential actions need your sign-off.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-border/60 bg-surface p-4 text-center">
                <Lock className="size-6 text-primary" />
                <p className="mt-2 text-[11px] font-semibold">Data stays private</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Conversations and memory are never sold.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-border/60 bg-surface p-4 text-center">
                <Network className="size-6 text-primary" />
                <p className="mt-2 text-[11px] font-semibold">Evidence preserved</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Every step is connected and auditable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Brain,
  CalendarCheck,
  Compass,
  CreditCard,
  Languages,
  MapPin,
  MessageCircle,
  Mic,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { FAQSection } from "@/components/kurukoo/faq-section";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Kurukoo" },
      {
        name: "description",
        content:
          "Everything Kurukoo can do for you: conversation and voice, discovery, work, memory, agents, channels, commerce, safety and everyday assistance.",
      },
      { property: "og:title", content: "Features — Kurukoo" },
      {
        property: "og:description",
        content:
          "One assistant that listens, arranges, coordinates, remembers and stays honest about what it has and has not done.",
      },
    ],
    links: [{ rel: "canonical", href: "/features" }],
  }),
  component: FeaturesPage,
});

const featureGroups = [
  {
    eyebrow: "Conversation",
    icon: MessageCircle,
    title: "Ask in your own words, with voice when you want it",
    body: "Chat is the control surface. Describe the outcome, and Kurukoo works out what is involved instead of asking you to pick a category first.",
    items: [
      ["Plain-language requests", "Say what you need, want, notice or are worried about.", "/chat"],
      ["Voice conversation", "Speak naturally when voice is available; the conversation becomes the task.", "/chat"],
      ["Same conversation, more depth", "Answers, options and follow-up stay in one thread.", "/chat"],
    ] as const,
  },
  {
    eyebrow: "Discovery",
    icon: Compass,
    title: "Useful people, places, services and opportunities",
    body: "Discover keeps recommendations evidence-attributed. Availability, price and completion are only shown when they are actually known.",
    items: [
      ["Goals, not categories", "Food, groceries, mobility, repairs, work, health, events, community and safety.", "/discover"],
      ["Nearby context", "People, businesses, providers and offers with their source preserved.", "/discover"],
      ["Live provider signals", "Verified presence where a provider is actually available.", "/providers"],
    ] as const,
  },
  {
    eyebrow: "Work",
    icon: CalendarCheck,
    title: "Requests that keep moving and stay attached to the conversation",
    body: "A request carries its own lifecycle: prepared, authorised, accepted, paid where supported, fulfilled, and evidenced. Nothing is claimed before it is real.",
    items: [
      ["Explicit requests", "Clear price, provider and timing before you commit.", "/work"],
      ["Follow-through", "Track what is happening and what still needs you.", "/activity"],
      ["Recovery", "Cancel, retry or resume without losing the original context.", "/activity"],
    ] as const,
  },
  {
    eyebrow: "Everyday assistance",
    icon: Wrench,
    title: "Reminders, routines and the small things that add up",
    body: "Kurukoo remembers what matters on your terms and keeps reminders, tasks and check-ins connected to the request that created them.",
    items: [
      ["Reminders and routines", "One-off, scheduled or event-based reminders.", "/chat"],
      ["Check-ins and safety", "Consent-bound safety status and trusted contacts.", "/settings#safety"],
      ["Devices when supported", "Check or act on a supported device through its own boundary.", "/chat?prompt=Check%20my%20device"],
    ] as const,
  },
  {
    eyebrow: "Memory and continuity",
    icon: Brain,
    title: "Remembers what matters, under your control",
    body: "Useful preferences, ongoing routines and prior context stay connected to the same relationship, and you decide what is retained.",
    items: [
      ["Memory you control", "Review, correct or remove retained context.", "/field"],
      ["Continuity", "Return to previous work instead of restarting the story.", "/activity"],
      ["Connected sources", "External data stays governed by its own connector.", "/connect"],
    ] as const,
  },
  {
    eyebrow: "Commerce and economy",
    icon: CreditCard,
    title: "Buying, selling and getting paid, without invented promises",
    body: "Cart, offers, plans, points and payment keep their own states. Where a payment rail is unavailable, Kurukoo says so instead of pretending.",
    items: [
      ["Cart and checkout", "Prepare, review, then commit deliberately.", "/cart"],
      ["Plans and points", "Access tiers and utility balance stay distinct from cash.", "/pricing"],
      ["Selling", "Offer something you own through the same conversation.", "/discover/selling"],
    ] as const,
  },
  {
    eyebrow: "Participants",
    icon: Users,
    title: "One relationship with people, businesses and agents",
    body: "Providers, businesses, creators, contributors and Kurukoo agents all participate through one identity model with capability and evidence boundaries.",
    items: [
      ["Providers and businesses", "Capabilities, availability and evidence stay distinct.", "/network"],
      ["Creators and contributors", "Publish, participate and be credited appropriately.", "/creators"],
      ["Agents", "Bounded goals with approval and evidence, never silent autonomy.", "/agents"],
    ] as const,
  },
  {
    eyebrow: "Channels",
    icon: Languages,
    title: "Several doors, one relationship",
    body: "Web, PWA, WhatsApp, Telegram, SMS, email and push are channels into the same conversation, request and notification state.",
    items: [
      ["Connected channels", "Connect and review readiness honestly.", "/connect"],
      ["Notifications", "Only useful updates, with quiet hours and control.", "/notifications"],
      ["Calls and voice", "Talk when it is easier than typing.", "/chat"],
    ] as const,
  },
  {
    eyebrow: "Trust",
    icon: ShieldCheck,
    title: "Knows what it knows — and what it could not do",
    body: "Safety, consent and evidence are not settings. They shape what Kurukoo may do, and what it is allowed to tell you it did.",
    items: [
      ["Permission boundaries", "Important actions need your decision.", "/settings"],
      ["Evidence before claims", "Payments, delivery and results appear only when observed.", "/how-it-works"],
      ["Privacy and disputes", "Retention, correction, cancellation and escalation.", "/legal/privacy"],
    ] as const,
  },
] as const;

const everyday = [
  [ShoppingBag, "Food and groceries", "/discover/food"],
  [MapPin, "Getting somewhere", "/discover/mobility"],
  [Wrench, "Repairs and home help", "/discover/repairs"],
  [CreditCard, "Buying and selling", "/discover/selling"],
  [CalendarCheck, "Work and tasks", "/discover/work"],
  [BellRing, "Reminders and alerts", "/discover/safety"],
] as const;

function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 pb-12">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">FEATURES</p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">
          Everything Kurukoo can do, in one assistant
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          You do not need to learn Kurukoo's architecture. Start with what you want to change;
          these are the capabilities it can draw on, and the boundaries it keeps.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AskKurukoo prompt="Show me what Kurukoo can do for me." />
          <Link
            to="/how-it-works"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
          >
            How it works
          </Link>
        </div>
      </header>

      <section aria-label="Everyday things people ask for" className="border-y border-border/80 py-7">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          START WITH THE EVERYDAY
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {everyday.map(([Icon, label, to]) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:border-primary/30"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                <Icon className="size-4" />
              </span>
              <span className="text-[13px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        {featureGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article key={group.eyebrow} aria-labelledby={`features-${group.eyebrow.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
                    {group.eyebrow}
                  </p>
                  <h2
                    id={`features-${group.eyebrow.toLowerCase().replace(/\s+/g, "-")}`}
                    className="mt-1.5 font-serif text-[26px] leading-tight tracking-[-0.035em]"
                  >
                    {group.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">{group.body}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {group.items.map(([title, body, to]) => (
                  <Link
                    key={title}
                    to={to}
                    className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/30"
                  >
                    <h3 className="text-[13.5px] font-semibold">{title}</h3>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-6 md:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
            <Zap className="size-4.5" />
          </span>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
              WHAT IS NOT A FEATURE
            </p>
            <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">
              Kurukoo does not invent outcomes
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">
              Features are only real when the underlying state exists. External providers, payments,
              delivery, device actions and verification are shown as pending or unavailable until
              they are genuinely connected — a capability never claims an outcome it has not observed.
            </p>
            <Link to="/trust" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary">
              How Kurukoo stays honest <Sparkles className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <FAQSection
        items={[
          {
            question: "Do I need to choose a feature before I start?",
            answer:
              "No. Describe what you want in your own words. Features exist so you can see what is possible, not because you have to navigate through them.",
          },
          {
            question: "Which features are available right now?",
            answer:
              "Conversation, discovery, work tracking, memory, reminders and channels run on the current build. Anything that depends on an external provider shows its real state — configured, pending or unavailable.",
          },
          {
            question: "Can I use Kurukoo without an account?",
            answer:
              "Yes. You can start in Chat as a guest and authenticate in the same conversation when a step needs your identity.",
          },
        ]}
      />
    </div>
  );
}

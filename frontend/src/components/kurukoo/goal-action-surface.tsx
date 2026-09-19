import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  CircleDollarSign,
  HeartPulse,
  MapPin,
  MessageCircle,
  Search,
  ShoppingBasket,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { FAQSection } from "@/components/kurukoo/faq-section";

export type GoalAction = {
  title: string;
  description: string;
  prompt: string;
  detail?: string;
  icon?: LucideIcon;
};

type GoalActionSurfaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: GoalAction[];
  backLabel?: string;
  askPrompt?: string;
};

function getGoalIcon(eyebrow: string, title: string): LucideIcon {
  const value = `${eyebrow} ${title}`.toLowerCase();
  if (value.includes("food") || value.includes("grocery") || value.includes("groceries"))
    return ShoppingBasket;
  if (value.includes("ride") || value.includes("mobility") || value.includes("travel")) return Car;
  if (value.includes("repair") || value.includes("home") || value.includes("clean")) return Wrench;
  if (value.includes("money") || value.includes("savings") || value.includes("sell"))
    return CircleDollarSign;
  if (value.includes("health") || value.includes("care")) return HeartPulse;
  if (value.includes("event") || value.includes("happening")) return CalendarDays;
  if (value.includes("work") || value.includes("business")) return BriefcaseBusiness;
  if (value.includes("community") || value.includes("people")) return Users;
  if (value.includes("safety") || value.includes("security")) return Sparkles;
  if (value.includes("place") || value.includes("nearby")) return MapPin;
  return Sparkles;
}

const actionIcons: LucideIcon[] = [Search, ArrowRight, MapPin, MessageCircle];

export function GoalActionSurface({
  eyebrow,
  title,
  description,
  actions,
  backLabel = "Explore",
  askPrompt,
}: GoalActionSurfaceProps) {
  const GoalIcon = getGoalIcon(eyebrow, title);
  const primaryPrompt = askPrompt ?? actions[0]?.prompt ?? `Help me with ${title.toLowerCase()}.`;
  const faqItems = [
    {
      question: `What can I ask Kurukoo about ${title.toLowerCase()}?`,
      answer: `Start with the outcome you want. You can describe the job in your own words and include useful details such as location, timing, budget or preferences when they matter.`,
    },
    {
      question: "Will Kurukoo make the decision for me?",
      answer:
        "No. Kurukoo can help find and organise relevant options, but important choices, commitments and approvals stay with you.",
    },
    {
      question: "What happens after I choose an option?",
      answer:
        "When a supported request can move forward, Kurukoo keeps the conversation, request and resulting work connected so you can follow what happens next.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-4">
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Link>

      <section className="relative overflow-hidden rounded-[24px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] md:p-7">
        <div
          className="absolute -right-16 -top-20 size-48 rounded-full bg-brand-tint/35 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                <GoalIcon className="size-[18px]" />
              </span>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {eyebrow}
              </p>
            </div>
            <h1 className="mt-4 font-serif text-[38px] leading-[1.02] tracking-[-0.045em] md:text-[46px]">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <AskKurukoo prompt={primaryPrompt} className="min-h-9 shrink-0 px-3.5 text-[11.5px]" />
        </div>
      </section>

      <section aria-labelledby="goal-start-here">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Start here
            </p>
            <h2
              id="goal-start-here"
              className="mt-1 font-serif text-[25px] leading-[1.05] tracking-[-0.035em]"
            >
              What do you need?
            </h2>
          </div>
          <Link
            to="/chat"
            search={{ query: primaryPrompt } as never}
            className="hidden items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Ask in your own words <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action, index) => {
            const ActionIcon = action.icon ?? actionIcons[index % actionIcons.length];
            return (
              <article
                key={action.title}
                className="group flex min-h-[148px] flex-col rounded-[19px] border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-elevated/45"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-elevated text-foreground/75 transition-colors group-hover:bg-brand-tint group-hover:text-brand-ink">
                    <ActionIcon className="size-4" />
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h3 className="mt-4 text-[14.5px] font-semibold leading-snug">{action.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  {action.description}
                </p>
                {action.detail ? (
                  <p className="mt-2 text-[10px] font-medium text-foreground/65">{action.detail}</p>
                ) : null}
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <AskKurukoo prompt={action.prompt} className="min-h-8 px-2.5 text-[11px]" />
                  <Link
                    to="/chat"
                    search={{ query: action.prompt } as never}
                    aria-label={`Open ${action.title} in Chat`}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                  >
                    <MessageCircle className="size-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[20px] border border-border bg-elevated/35 p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface">
              <MessageCircle className="size-4 text-primary" />
            </span>
            <div>
              <h2 className="text-[13.5px] font-semibold">Or just tell Kurukoo</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Describe what you want in your own words.
              </p>
            </div>
          </div>
          <Link
            to="/chat"
            search={{ query: primaryPrompt } as never}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-[11.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start in Chat
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <FAQSection items={faqItems} />
    </div>
  );
}

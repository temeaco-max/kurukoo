import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  Car,
  Compass,
  HeartPulse,
  Home,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { SearchField } from "@/components/kurukoo/ui";
import { capabilityCount, skillCategories, userJobs } from "@/lib/skill-catalog";
import { exploreGoalGroups } from "@/lib/explore-goals";

export const Route = createFileRoute("/capabilities")({
  head: () => ({
    meta: [
      { title: "What can I get done? — Kurukoo" },
      {
        name: "description",
        content:
          "Explore the everyday goals you can start with Kurukoo, from food and mobility to repairs, work, community and safety.",
      },
      { property: "og:title", content: "What can I get done? — Kurukoo" },
      {
        property: "og:description",
        content: "Explore everyday goals and start the right request with Kurukoo.",
      },
    ],
    links: [{ rel: "canonical", href: "/capabilities" }],
  }),
  component: CapabilitiesPage,
});

const groupIcons: Record<string, typeof ShoppingBag> = {
  everyday: ShoppingBag,
  "getting-around": Car,
  home: Home,
  "money-work": Banknote,
  life: HeartPulse,
  community: Users,
  safety: ShieldCheck,
};

const goalRoutes: Record<string, string> = {
  food: "/explore/food",
  groceries: "/explore/groceries",
  ride: "/explore/mobility",
  travel: "/explore/mobility",
  repair: "/explore/repairs",
  cleaning: "/explore/home",
  solar: "/explore/home",
  "money-circle": "/explore/money-circle",
  work: "/explore/work",
  sell: "/explore/selling",
  business: "/explore/work",
  health: "/explore/health",
  education: "/explore/learning",
  events: "/explore/events",
  spiritual: "/explore/prayer",
  connect: "/explore/community",
  emergency: "/explore/safety",
  security: "/explore/safety",
};

function CapabilitiesPage() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      exploreGoalGroups
        .map((group) => ({
          ...group,
          goals: group.goals.filter(
            (goal) =>
              !normalized || `${goal.label} ${goal.prompt}`.toLowerCase().includes(normalized),
          ),
        }))
        .filter((group) => group.goals.length),
    [normalized],
  );
  const matchingJobs = userJobs
    .filter((job) => !normalized || job.toLowerCase().includes(normalized))
    .slice(0, 16);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-4">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Capabilities
        </p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[50px]">
          What can I get done?
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted-foreground">
          Pick a goal, or just tell Kurukoo what you need.
        </p>
      </header>

      <section className="rounded-[24px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
            <Compass className="size-[18px]" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Start with a goal
            </p>
            <h2 className="mt-1 font-serif text-[25px] leading-[1.05] tracking-[-0.035em]">
              What do you need?
            </h2>
          </div>
        </div>
        <div className="mt-5">
          <SearchField
            label="Search"
            placeholder="Try: fix my phone, get a ride, start a savings circle…"
            value={query}
            onChange={setQuery}
          />
        </div>
      </section>

      {groups.map((group) => {
        const Icon = groupIcons[group.id] ?? group.icon;
        return (
          <section key={group.id}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-elevated">
                <Icon className="size-4" />
              </span>
              <h2 className="text-[17px] font-semibold">{group.label}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.goals.map((goal) => {
                const GoalIcon = goal.icon;
                const destination = goalRoutes[goal.id] ?? "/chat";
                const isChat = destination === "/chat";
                return (
                  <Link
                    key={goal.id}
                    to={destination as never}
                    search={isChat ? ({ query: goal.prompt } as never) : undefined}
                    className="group flex min-h-[112px] flex-col rounded-[18px] border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-elevated/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                        <GoalIcon className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="mt-4 text-[14px] font-semibold">{goal.label}</h3>
                    <span className="mt-auto pt-3 text-[10.5px] font-medium text-muted-foreground">
                      {isChat ? "Start in Chat" : "Open"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="rounded-[22px] border border-border bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Popular
            </p>
            <h2 className="mt-1 text-[18px] font-semibold">Try asking Kurukoo</h2>
          </div>
          <Link to="/chat" className="text-[11.5px] font-medium">
            Tell Kurukoo <ArrowRight className="ml-1 inline size-3.5" />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {matchingJobs.map((job) => (
            <Link
              key={job}
              to="/chat"
              search={{ query: job } as never}
              className="rounded-full border border-border px-3 py-2 text-[11px] hover:bg-elevated"
            >
              {job}
            </Link>
          ))}
        </div>
      </section>

      <details className="overflow-hidden rounded-[22px] border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
          All capabilities{" "}
          <span className="ml-2 text-[10.5px] font-normal text-muted-foreground">
            {capabilityCount}
          </span>
        </summary>
        <div className="space-y-3 border-t border-border p-4">
          {skillCategories.map((category) => (
            <details key={category.name} className="rounded-xl border border-border/80">
              <summary className="cursor-pointer px-3 py-2.5 text-[12px] font-medium">
                {category.name}{" "}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {category.skills.length}
                </span>
              </summary>
              <div className="grid gap-1 border-t border-border/70 p-2 sm:grid-cols-2 lg:grid-cols-3">
                {category.skills.map((skill) => (
                  <Link
                    key={`${skill.category}-${skill.id}`}
                    to="/chat"
                    search={{ query: skill.label } as never}
                    className="rounded-lg px-2.5 py-2 hover:bg-elevated"
                  >
                    <p className="text-[11px] font-medium">{skill.label}</p>
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
      </details>

      <section className="rounded-[22px] bg-foreground p-5 text-background md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[11px] font-medium text-background/60">Not sure where to start?</p>
            <h2 className="mt-1 text-[19px] font-semibold">Tell Kurukoo in your own words.</h2>
          </div>
          <Link
            to="/chat"
            className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-background px-3.5 text-[11.5px] font-medium text-foreground"
          >
            Start a request <MessageCircle className="size-3.5" />
          </Link>
        </div>
      </section>

      <FAQSection
        items={[
          {
            question: "Do I need to know which capability to choose?",
            answer:
              "No. Explore is a helpful starting point, but Chat is always available. Describe the outcome in your own words and Kurukoo can work from there.",
          },
          {
            question: "Why are some goals grouped together?",
            answer:
              "The groups are organised around everyday goals so you can reach a useful starting point quickly without having to learn internal service names.",
          },
          {
            question: "Are all capabilities available everywhere?",
            answer:
              "Availability depends on the relevant service, provider, evidence and account context. Kurukoo should only present an action as available when the underlying system supports it.",
          },
        ]}
      />
    </div>
  );
}

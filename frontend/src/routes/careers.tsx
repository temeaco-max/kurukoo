import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, HeartPulse, MapPin, TrendingUp } from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";
import { actionClass } from "@/components/kurukoo/primitives";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — Kurukoo" },
      {
        name: "description",
        content:
          "Join Kurukoo in Lagos and London. We are building conversation-first economic infrastructure for everyday life.",
      },
    ],
  }),
  component: CareersPage,
});

const BENEFITS = [
  {
    icon: MapPin,
    title: "Hybrid work",
    body: "Flexible office and remote options across Lagos and London.",
  },
  {
    icon: TrendingUp,
    title: "Equity",
    body: "Ownership in the platform you build.",
  },
  {
    icon: HeartPulse,
    title: "Health & wellness",
    body: "Comprehensive coverage for you and your family.",
  },
];

const ROLES = [
  {
    team: "Engineering",
    title: "Senior Full-Stack Engineer",
    location: "Lagos, Nigeria · Full-time",
  },
  { team: "Design", title: "Product Designer (UX/UI)", location: "London, UK · Hybrid" },
  { team: "Operations", title: "Growth & Operations Lead", location: "Accra, Ghana · Full-time" },
];

function CareersPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section>
        <p className="text-[12px] font-medium text-muted-foreground">Join the mission</p>
        <h1 className="mt-2 max-w-4xl font-serif text-[44px] leading-[1.01] tracking-[-0.05em] md:text-[62px]">
          Help us sort everyday life.
        </h1>
        <p className="mt-5 max-w-3xl text-[16px] leading-7 text-muted-foreground">
          We're looking for builders, dreamers, and problem solvers to join our team in Lagos and
          London.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <a href="mailto:careers@kurukoo.com" className={actionClass("primary")}>
            Apply now <ArrowUpRight className="size-3.5" />
          </a>
          <Link to="/about" className={actionClass()}>
            About Kurukoo
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight">Why work at Kurukoo?</h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            We are building more than just an app; we are building economic infrastructure. Every
            line of code you write helps a vendor find a customer, a driver find a rider, and a
            community save together.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <Panel key={benefit.title} className="p-5">
                <benefit.icon className="size-5 text-primary" />
                <h3 className="mt-4 text-[14px] font-semibold">{benefit.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {benefit.body}
                </p>
              </Panel>
            ))}
          </div>
        </div>
        <Panel className="flex items-center justify-center p-8">
          <BadgeCheck className="size-16 text-primary" aria-hidden="true" />
        </Panel>
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold tracking-tight">Open roles</h2>
        <div className="mt-5 grid gap-3">
          {ROLES.map((role) => (
            <Panel
              key={role.title}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  {role.team}
                </p>
                <h3 className="mt-1 text-[16px] font-semibold">{role.title}</h3>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{role.location}</p>
              </div>
              <a
                href={`mailto:careers@kurukoo.com?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                className={actionClass("primary")}
                aria-label={`Apply for ${role.title}`}
              >
                Apply now
              </a>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

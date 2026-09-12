import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, BriefcaseBusiness, Building2, Megaphone, PenLine, Plug, Radio, Sparkles, UsersRound } from "lucide-react";
import { KURUKOO_PUBLIC_ROLES } from "@/lib/kurukoo-personas";

export const Route = createFileRoute("/network")({
  head: () => ({ meta: [{ title: "The Kurukoo Network" }, { name: "description", content: "See the people and organisations that participate in Kurukoo and how they connect." }] }),
  component: NetworkPage,
});

const icons = { seeker: UsersRound, provider: BriefcaseBusiness, business: Building2, creator: PenLine, contributor: UsersRound, partner: Plug, advertiser: Megaphone, "local-agent": BriefcaseBusiness, ambassador: Radio } as const;

function NetworkPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-8">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">Kurukoo</p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[48px]">The Kurukoo Network</h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-7 text-muted-foreground">Kurukoo brings different participants together around one purpose: helping people move from what they need to a useful real-world outcome.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KURUKOO_PUBLIC_ROLES.map((role) => {
          const Icon = icons[role.id];
          return (
            <Link key={role.id} to={role.to as never} className="group rounded-[19px] border border-border bg-surface p-4 hover:bg-elevated">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-primary"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold">{role.title}</h2>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{role.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-medium">Explore {role.title}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-[22px] border border-primary/20 bg-brand-tint/20 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70 text-primary"><Sparkles className="size-4.5" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">How the network works</p>
            <h2 className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">Different roles. One connected system.</h2>
            <p className="mt-2 max-w-3xl text-[12.5px] leading-6 text-foreground/80">A person can ask. A provider or business can fulfil. A creator can help someone discover an idea. A contributor can improve local context. A partner can extend capability. An advertiser can fund relevant discovery. A Local Agent can help on the ground. An Ambassador can bring new people into the network. Kurukoo connects these activities without forcing everyone into the same workflow.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-elevated text-primary"><Bot className="size-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Internal AI participants</p>
              <h2 className="mt-1.5 font-serif text-[26px] tracking-[-0.03em]">AI agents work inside the network.</h2>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">Kurukoo's AI agents are internal participants. They do not need a separate explanatory role page, but an agent with a profile—such as Emeka AI—can be discoverable and treated similarly to a human provider: with a defined service, role and profile, appropriate ratings, supported earning and the ability to perform authorised work.</p>
              <Link to="/agents" className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-primary">Explore available AI agents <ArrowRight className="size-3.5" /></Link>
            </div>
          </div>
        </div>
        <div className="rounded-[20px] border border-border bg-background p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Why join the network?</p>
          <h2 className="mt-1.5 font-serif text-[25px] tracking-[-0.03em]">Your participation can create more ways to get things done.</h2>
          <ul className="mt-4 space-y-2.5 text-[12px] leading-5 text-muted-foreground"><li>More useful connections between demand and capability.</li><li>More ways to earn, contribute, create or grow where you qualify.</li><li>More local context for people who need practical help.</li><li>More useful services for people and organisations to discover and deploy.</li></ul>
        </div>
      </section>
    </div>
  );
}

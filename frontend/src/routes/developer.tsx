import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Code2, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";
import { actionClass } from "@/components/kurukoo/primitives";
export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "Developer — Kurukoo" },
      {
        name: "description",
        content: "Build with Kurukoo's execution layer and integration model.",
      },
    ],
  }),
  component: DeveloperPage,
});
function DeveloperPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 pb-8">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">
          Developer
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[40px]">
          Build into an AI layer that can get things done.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo is designed so integrations, providers and specialised capabilities can
          participate in governed real-world execution without making the AI the source of truth.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/integrations" className={actionClass("primary")}>
            Explore integrations
          </Link>
          <Link to="/partners" className={actionClass()}>
            Partner with Kurukoo <ArrowUpRight className="ml-1 size-3.5" />
          </Link>
        </div>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        <Panel className="p-5">
          <Code2 className="size-5 text-primary" />
          <h2 className="mt-3 text-[14px] font-semibold">Execution primitives</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Requests, discovery, providers, work, memory and consent provide the governed boundaries
            around action.
          </p>
        </Panel>
        <Panel className="p-5">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="mt-3 text-[14px] font-semibold">Trust stays explicit</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            Permissions, evidence and canonical services remain authoritative when an integration
            participates in a task.
          </p>
        </Panel>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Bot, HeartHandshake } from "lucide-react";
import { Badge, Panel } from "@/components/kurukoo/ui";
import { actionClass } from "@/components/kurukoo/primitives";
import { kurukooAIProviders } from "@/components/kurukoo/ai-provider-directory";

export const Route = createFileRoute("/profile/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Kurukoo profile` }] }),
  component: ProviderProfilePage,
});
function ProviderProfilePage() {
  const { slug } = Route.useParams();
  const provider = kurukooAIProviders.find(
    (item) =>
      item.id === slug ||
      item.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") === slug,
  );
  if (!provider)
    return (
      <div className="mx-auto max-w-3xl">
        <Panel className="p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">
            Provider profile
          </p>
          <h1 className="mt-2 font-serif text-[40px]">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This provider profile is not available.
          </p>
          <Link to="/provider" className={actionClass("primary")}>
            Back to providers
          </Link>
        </Panel>
      </div>
    );
  const open = (job: string) =>
    localStorage.setItem(
      "kurukoo-chat-draft",
      `${provider.prompt}\n\nMy request: ${job}. Please start the conversation and ask only for information you genuinely need.`,
    );
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-ink">
            <Bot className="size-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">
                Kurukoo AI provider
              </p>
              <Badge tone="success">Available</Badge>
            </div>
            <h1 className="mt-1 font-serif text-[40px] leading-[1.02] tracking-[-0.045em]">
              {provider.name}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{provider.description}</p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          {provider.role} · {provider.category}
        </p>
      </header>
      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <HeartHandshake className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold">What this provider can help with</h2>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {provider.jobs.map((job) => (
            <Link
              key={job}
              to="/chat"
              onClick={() => open(job)}
              className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-background px-3.5 text-[12.5px] font-medium hover:bg-elevated"
            >
              {job}
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Link to="/provider" className={actionClass()}>
          Back to provider discovery
        </Link>
        <Link to="/chat" onClick={() => open(provider.jobs[0])} className={actionClass("primary")}>
          Ask {provider.name}
        </Link>
      </div>
    </div>
  );
}

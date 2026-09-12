import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Feather } from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";
import { articles } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Kurukoo" },
      {
        name: "description",
        content: "Notes on conversation, trust, coordination and building useful AI.",
      },
      { property: "og:title", content: "Blog — Kurukoo" },
      {
        property: "og:description",
        content: "Notes on building useful AI and a conversation-first operating layer.",
      },
    ],
  }),
  component: BlogPage,
});

function BlogPage() {
  const featured = articles[0];
  const rest = articles.slice(1);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="max-w-4xl">
        <p className="text-[12px] font-medium text-muted-foreground">Kurukoo journal</p>
        <h1 className="mt-2 font-serif text-[44px] leading-[1.01] tracking-[-0.05em] md:text-[60px]">
          Notes on building AI that is useful after the chat.
        </h1>
        <p className="mt-5 max-w-3xl text-[16px] leading-7 text-muted-foreground">
          Writing about handover, trust, coordination, discovery and the product decisions behind
          Kurukoo.
        </p>
      </section>

      <Link to="/blog/the-call-that-gets-things-moving" className="group mt-10 block">
        <Panel className="overflow-hidden border-primary/20 p-0 transition-colors group-hover:bg-elevated/45">
          <div className="grid md:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 border border-primary/20 bg-brand-tint px-2 py-1 text-brand-ink">
                  <Feather className="size-3" /> Our story
                </span>
                <span>Permanent</span>
              </div>
              <h2 className="mt-4 max-w-2xl text-[28px] font-semibold tracking-[-0.03em] md:text-[34px]">
                The Call That Gets Things Moving
              </h2>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                A rhyming story about the voice, timing, movement, adaptability and distinctive call
                behind Kurukoo — and the path from Croon through Thicket, Nearby, consent and Actions.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium">
                Read the story <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <div className="min-h-[220px] bg-[radial-gradient(circle_at_70%_20%,color-mix(in_oklch,var(--brand-tint)_85%,transparent),transparent_30%),linear-gradient(145deg,var(--elevated),var(--surface))] p-6">
              <div className="flex h-full items-end border border-border bg-background/50 p-4">
                <Feather className="size-5 text-primary" />
              </div>
            </div>
          </div>
        </Panel>
      </Link>

      {featured ? (
        <Link to="/blog/$slug" params={{ slug: featured.slug }} className="group mt-8 block">
          <Panel className="overflow-hidden p-0 transition-colors group-hover:bg-elevated/45">
            <div className="grid md:grid-cols-[1.15fr_.85fr]">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span className="border border-border px-2 py-1">Featured</span>
                  <span>{featured.date}</span>
                </div>
                <h2 className="mt-4 max-w-2xl text-[25px] font-semibold tracking-tight md:text-[30px]">
                  {featured.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                  {featured.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium">
                  Read article <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="min-h-[220px] bg-[radial-gradient(circle_at_70%_20%,color-mix(in_oklch,var(--brand-tint)_85%,transparent),transparent_30%),linear-gradient(145deg,var(--elevated),var(--surface))] p-6">
                <div className="flex h-full items-end border border-border bg-background/50 p-4">
                  <BookOpen className="size-5 text-primary" />
                </div>
              </div>
            </div>
          </Panel>
        </Link>
      ) : null}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">All notes</p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">More from the journal</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">{articles.length} articles</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((article, index) => (
            <Link key={article.slug} to="/blog/$slug" params={{ slug: article.slug }} className="group">
              <Panel className="h-full p-5 transition-colors group-hover:bg-elevated/45">
                <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span>0{index + 2}</span><span>·</span><span>{article.date}</span>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center border border-border bg-elevated"><BookOpen className="size-4" /></span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-semibold tracking-tight">{article.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{article.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium">Read <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-8 text-[12px] text-muted-foreground">
        Editorial content explains the system, documents decisions and gives people useful context before they sign in.
      </p>
    </div>
  );
}

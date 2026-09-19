import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { MarketingPage } from "@/components/kurukoo/marketing";
import { Action } from "@/components/kurukoo/primitives";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { articleBySlug } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/blog/$slug")({
  head: () => ({
    meta: [
      { title: "Article — Kurukoo" },
      { name: "description", content: "An article from the Kurukoo journal." },
      { property: "og:title", content: "Kurukoo article" },
      { property: "og:description", content: "Notes and useful context from Kurukoo." },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const article = articleBySlug(slug);
  if (!article)
    return (
      <MarketingPage>
        <PageHeader title="Article" />
        <EmptyState title="Article not found" body="This piece may have moved or been renamed." />
        <div className="mt-4">
          <Link to="/blog">
            <Action>
              <ArrowLeft className="size-3.5" />
              Back to the blog
            </Action>
          </Link>
        </div>
      </MarketingPage>
    );
  return (
    <MarketingPage>
      <article className="mx-auto w-full max-w-3xl">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Blog
        </Link>
        <header className="mt-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
            {article.date}
          </p>
          <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[50px]">
            {article.title}
          </h1>
        </header>
        <div className="mt-8 space-y-5 text-[15px] leading-7 text-muted-foreground">
          {article.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <AskKurukoo prompt={`Help me understand this Kurukoo article: ${article.title}.`} />
          <Link
            to="/explore"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-elevated"
          >
            Explore <ArrowUpRight className="size-3.5" />
          </Link>
          <Link to="/blog">
            <Action>All articles</Action>
          </Link>
        </div>
      </article>
    </MarketingPage>
  );
}

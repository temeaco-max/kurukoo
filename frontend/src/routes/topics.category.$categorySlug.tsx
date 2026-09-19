import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { fetchCanonicalTopics, type CanonicalTopic } from "@/lib/kurukoo-api";
import {
  fetchCommunityAdInventory,
  fetchCommunityCategory,
  type CommunityAdInventory,
  type CommunityCategory,
} from "@/lib/community-topics-api";

export const Route = createFileRoute("/topics/category/$categorySlug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.categorySlug.replace(/-/g, " ")} Topics — Kurukoo` }],
  }),
  component: TopicCategoryPage,
});

function Ad({ item, label }: { item?: CommunityAdInventory; label: string }) {
  if (item?.campaign)
    return (
      <a
        href={item.campaign.destination}
        target="_blank"
        rel="noreferrer"
        className="rounded-[18px] bg-elevated/30 p-4 hover:bg-elevated/50"
      >
        <p className="text-[8.5px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          Sponsored
        </p>
        <p className="mt-1 text-[12px] font-semibold">{item.campaign.title}</p>
        <p className="mt-1 text-[10.5px] text-muted-foreground">{item.campaign.body}</p>
      </a>
    );
  return (
    <div className="flex min-h-[104px] items-center justify-center rounded-[18px] bg-elevated/20 px-4 text-center">
      <div>
        <p className="text-[8.5px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          Advertising
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
        {item?.points ? (
          <p className="mt-1 text-[9px] text-muted-foreground">{item.points} Points</p>
        ) : null}
      </div>
    </div>
  );
}

function TopicCategoryPage() {
  const { categorySlug } = Route.useParams();
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  const [ads, setAds] = useState<CommunityAdInventory[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchCommunityCategory(categorySlug)
      .then((payload) => {
        setCategory(payload.category);
      })
      .catch(() => setError("This Topic category could not be loaded."));
    void fetchCanonicalTopics(100, { category: categorySlug })
      .then(setTopics)
      .catch(() => setTopics([]));
    void fetchCommunityAdInventory(categorySlug)
      .then(setAds)
      .catch(() => setAds([]));
  }, [categorySlug]);

  if (error)
    return (
      <div className="mx-auto max-w-5xl py-12 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  if (!category)
    return (
      <div className="mx-auto max-w-5xl py-12 text-center text-sm text-muted-foreground">
        Loading Topics…
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-10">
      <Link
        to="/topics"
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All Topics
      </Link>
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          TOPIC CATEGORY
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em]">
          {category.name}
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">
          {category.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <AskKurukoo
            prompt={`Help me understand what people are discussing in ${category.name}.`}
          />
          <Link
            to="/topics/create"
            className="inline-flex min-h-9 items-center rounded-xl border border-border px-3.5 text-[11px] font-medium hover:bg-elevated"
          >
            Create a Topic
          </Link>
        </div>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Ad item={ads.find((item) => item.slot === "top-1")} label="Top placement 1" />
        <Ad item={ads.find((item) => item.slot === "top-2")} label="Top placement 2" />
        <Ad item={ads.find((item) => item.slot === "top-3")} label="Top placement 3" />
      </div>
      <section className="rounded-[20px] border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold">{category.name} Topics</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {category.subcategories.map((sub) => (
            <Link
              key={sub.slug}
              to="/topics/category/$categorySlug"
              params={{ categorySlug: category.slug }}
              search={{ subcategory: sub.slug } as never}
              className="rounded-full bg-elevated px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {sub.name}
            </Link>
          ))}
        </div>
        <div className="mt-4 divide-y divide-border">
          {topics.length ? (
            topics.slice(0, 20).map((topic) => (
              <Link
                key={topic.id}
                to="/topics/$slug"
                params={{ slug: topic.slug }}
                className="flex items-center justify-between gap-3 py-3 hover:bg-elevated/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{topic.title}</p>
                  <p className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground">
                    {topic.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[9.5px] text-muted-foreground">
                  {topic.replyCount} replies
                  <ArrowUpRight className="size-3" />
                </div>
              </Link>
            ))
          ) : (
            <p className="py-8 text-center text-[11px] text-muted-foreground">
              No Topics in this category yet.
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        <Ad item={ads.find((item) => item.slot === "bottom-1")} label="Bottom placement 1" />
        <Ad item={ads.find((item) => item.slot === "bottom-2")} label="Bottom placement 2" />
        <Ad item={ads.find((item) => item.slot === "bottom-3")} label="Bottom placement 3" />
      </div>
      <section className="rounded-[22px] border border-border bg-elevated/35 p-5">
        <p className="text-[13px] font-semibold">Use a Topic when context will help.</p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Ask questions, compare experiences and build useful context before deciding what to do
          next.
        </p>
      </section>
      <FAQSection
        title={`${category.name} questions`}
        items={[
          { question: `What belongs in ${category.name}?`, answer: category.description },
          ...category.subcategories
            .slice(0, 3)
            .map((sub) => ({ question: `What is ${sub.name}?`, answer: sub.description })),
        ]}
      />
      <Ad item={ads.find((item) => item.slot === "bottom-large")} label="Large Topic placement" />
    </div>
  );
}

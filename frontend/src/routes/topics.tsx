import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Plus, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { fetchCanonicalTopics, fetchTopicTaxonomy, type CanonicalTopic, type TopicTaxonomy } from "@/lib/kurukoo-api";
import { fetchCommunityAdInventory, fetchCommunityStats, fetchCommunityTaxonomy, touchCommunityPresence, type CommunityAdInventory, type CommunityCategory, type CommunityStats } from "@/lib/community-topics-api";

export const Route = createFileRoute("/topics")({
  head: () => ({ meta: [
    { title: "Topics — Kurukoo" },
    { name: "description", content: "Explore useful questions, experiences, local context and community discussion on Kurukoo." },
  ] }),
  component: TopicsPage,
});

type TopicSort = "recent" | "updated" | "trending" | "new-posts";
const PAGE_SIZE = 8;
const pretty = (value: string) => value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function AdCard({ item }: { item?: CommunityAdInventory }) {
  if (item?.campaign) return <a href={item.campaign.destination} target="_blank" rel="noreferrer" className="flex min-h-[104px] items-center rounded-[18px] border border-dotted border-border bg-elevated/35 px-4 transition-colors hover:bg-elevated/55"><div><p className="text-[8.5px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Sponsored</p><p className="mt-1 text-[12px] font-semibold">{item.campaign.title}</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{item.campaign.body}</p></div></a>;
  return <div className="flex min-h-[104px] items-center justify-center rounded-[18px] border border-dotted border-border bg-elevated/20 px-4 text-center"><div><p className="text-[8.5px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Advertising</p><p className="mt-1 text-[10px] text-muted-foreground">Place an Ad here</p>{item?.points ? <p className="mt-1 text-[9px] text-muted-foreground">{item.points} Points per placement</p> : null}</div></div>;
}

function CommunityStatsCard({ stats }: { stats: CommunityStats | null }) {
  return <section className="rounded-2xl bg-elevated/25 p-3" aria-label="Community statistics"><div className="mb-2 flex items-center gap-2"><Users className="size-3.5 text-primary"/><h2 className="text-[12px] font-semibold">Community</h2></div><div className="grid grid-cols-3 divide-x divide-border/70"><div className="px-2 text-center first:pl-0"><p className="text-[16px] font-semibold tabular-nums">{stats?.members ?? 0}</p><p className="text-[8.5px] text-muted-foreground">members</p></div><div className="px-2 text-center"><p className="text-[16px] font-semibold tabular-nums">{stats?.online ?? 0}</p><p className="text-[8.5px] text-muted-foreground">online</p></div><div className="px-2 text-center last:pr-0"><p className="text-[16px] font-semibold tabular-nums">{stats?.guests ?? 0}</p><p className="text-[8.5px] text-muted-foreground">guests</p></div></div></section>;
}

function CategoryDirectory({ categories, activeCategory, activeSubcategory, onCategory, onSubcategory }: { categories: CommunityCategory[]; activeCategory: string; activeSubcategory: string; onCategory: (slug: string) => void; onSubcategory: (slug: string) => void }) {
  const active = categories.find((item) => item.slug === activeCategory) ?? categories[0];
  return <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">CATEGORIES</p><h2 className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">Browse</h2></div><span className="text-[10px] text-muted-foreground">Managed by Kurukoo</span></div><div className="rounded-[20px] border border-border bg-surface p-4"><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category.slug} type="button" onClick={() => onCategory(category.slug)} className={`rounded-full px-3 py-1.5 text-[10.5px] font-medium ${category.slug === active?.slug ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground hover:text-foreground"}`}>{category.name}</button>)}</div>{active ? <div className="mt-4 border-t border-border pt-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[12.5px] font-semibold">{active.name}</p><p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-muted-foreground">{active.description}</p></div><ChevronDown className="mt-1 size-4 text-muted-foreground"/></div><div className="mt-3 flex flex-wrap gap-1.5">{active.subcategories.map((sub) => <button key={sub.slug} type="button" onClick={() => onSubcategory(sub.slug)} className={`rounded-full border px-2.5 py-1.5 text-[10px] ${activeSubcategory === sub.slug ? "border-primary bg-brand-tint text-brand-ink" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>{sub.name}</button>)}</div></div> : null}</div></section>;
}

function TopicRow({ topic }: { topic: CanonicalTopic & { followerCount?: number } }) {
  return <Link to="/topics/$slug" params={{ slug: topic.slug }} className="grid grid-cols-[minmax(0,1fr)_70px_80px] items-center gap-3 border-b border-border px-3 py-3.5 last:border-0 hover:bg-elevated/35 sm:grid-cols-[minmax(0,1fr)_90px_90px] sm:px-4"><div className="min-w-0"><p className="truncate text-[12.5px] font-semibold">{topic.title}</p><p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">{topic.body}</p></div><div className="text-center"><p className="text-[12px] font-semibold tabular-nums">{topic.replyCount}</p><p className="text-[8.5px] text-muted-foreground">replies</p></div><div className="text-center"><p className="text-[12px] font-semibold tabular-nums">{topic.followerCount ?? 0}</p><p className="text-[8.5px] text-muted-foreground">followers</p></div></Link>;
}

function TopicsPage() {
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  const [taxonomy, setTaxonomy] = useState<TopicTaxonomy>({ types: [], categories: [], skillsByCategory: {} });
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [inventory, setInventory] = useState<CommunityAdInventory[]>([]);
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [sort, setSort] = useState<TopicSort>("recent");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeCategory = categories.find((item) => item.slug === category) ?? categories[0];

  async function loadTopics(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const next = await fetchCanonicalTopics(100, { type, category: activeCategory?.slug });
      setTopics(next);
      setPage(1);
      const ads = await fetchCommunityAdInventory(activeCategory?.slug, subcategory || undefined);
      setInventory(ads);
    } catch { setTopics([]); setInventory([]); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    void Promise.all([
      fetchTopicTaxonomy().then(setTaxonomy).catch(() => undefined),
      fetchCommunityTaxonomy().then(setCategories).catch(() => undefined),
      fetchCommunityStats().then(setStats).catch(() => undefined),
      touchCommunityPresence(`topics-${crypto.randomUUID()}`).catch(() => undefined),
    ]);
  }, []);
  useEffect(() => { if (activeCategory) void loadTopics(); }, [activeCategory?.slug, subcategory, type]);

  const visibleTopics = useMemo(() => {
    const copy = [...topics];
    if (sort === "updated" || sort === "new-posts") copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else if (sort === "trending") copy.sort((a, b) => b.replyCount - a.replyCount || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return copy;
  }, [topics, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleTopics.length / PAGE_SIZE));
  const pageTopics = visibleTopics.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function selectCategory(value: string) { setCategory(value); setSubcategory(""); setPage(1); }
  function selectSubcategory(value: string) { setSubcategory(value); setPage(1); }

  return <div className="mx-auto w-full max-w-6xl space-y-7 pb-10">
    <header>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">TOPICS</p>
      <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">What people are talking about</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted-foreground">Useful questions, experiences, local context and conversations, organised into community spaces.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><Link to="/topics/create" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[11.5px] font-medium text-primary-foreground"><Plus className="size-3.5"/>Create a Topic</Link><Link to="/topics/mine" className="inline-flex min-h-9 items-center rounded-xl border border-border px-3.5 text-[11.5px] font-medium hover:bg-elevated">Your Topics</Link><AskKurukoo prompt="Help me find a useful Topic for what I am trying to do."/></div><div className="flex flex-wrap gap-2"><select aria-label="Filter Topics by type" value={type} onChange={(event) => setType(event.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-3 text-[11px]"><option value="">All types</option>{taxonomy.types.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select><select aria-label="Filter Topics by category" value={category} onChange={(event) => selectCategory(event.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-3 text-[11px]"><option value="">All categories</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div></div>
    </header>

    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]"><CategoryDirectory categories={categories} activeCategory={activeCategory?.slug ?? ""} activeSubcategory={subcategory} onCategory={selectCategory} onSubcategory={selectSubcategory}/><CommunityStatsCard stats={stats}/></div>
    <div className="grid gap-3 md:grid-cols-3"><AdCard item={inventory.find((item) => item.slot === "top-1")}/><AdCard item={inventory.find((item) => item.slot === "top-2")}/><AdCard item={inventory.find((item) => item.slot === "top-3")}/></div>

    <section aria-labelledby="general-topics"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Kurukoo</p><h2 id="general-topics" className="font-serif text-[28px] leading-none tracking-[-0.035em]">General</h2></div><div className="flex items-center gap-1.5"><div className="flex flex-wrap gap-1">{(["recent", "updated", "trending", "new-posts"] as TopicSort[]).map((value) => <button key={value} type="button" onClick={() => { setSort(value); setPage(1); }} className={`rounded-full px-2.5 py-1.5 text-[9.5px] font-medium ${sort === value ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground hover:text-foreground"}`}>{value === "new-posts" ? "New posts" : pretty(value)}</button>)}</div><button type="button" onClick={() => void loadTopics(true)} disabled={refreshing} className="ml-1 inline-flex size-8 items-center justify-center rounded-lg border border-border hover:bg-elevated disabled:opacity-50" aria-label="Refresh Topics"><RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"}/></button></div></div>
      <div className="overflow-hidden rounded-b-[18px] border-x border-b border-border bg-surface"><div className="grid grid-cols-[minmax(0,1fr)_70px_80px] gap-3 border-b border-border bg-elevated/25 px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:grid-cols-[minmax(0,1fr)_90px_90px] sm:px-4"><span>Topic</span><span className="text-center">Replies</span><span className="text-center">Followers</span></div>{loading ? <div className="h-[420px] animate-pulse bg-elevated/15"/> : pageTopics.length ? pageTopics.map((topic) => <TopicRow key={topic.id} topic={topic}/>) : <div className="flex h-[260px] items-center justify-center px-6 text-center text-[11px] text-muted-foreground">No Topics match this selection yet.</div>}</div>
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[9.5px] text-muted-foreground">Page {page} of {pageCount}</p><div className="flex gap-1.5"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border border-border disabled:opacity-35" aria-label="Previous page"><ChevronLeft className="size-3.5"/></button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="grid size-8 place-items-center rounded-lg border border-border disabled:opacity-35" aria-label="Next page"><ChevronRight className="size-3.5"/></button></div></div>
    </section>

    <div className="grid gap-3 md:grid-cols-3"><AdCard item={inventory.find((item) => item.slot === "bottom-1")}/><AdCard item={inventory.find((item) => item.slot === "bottom-2")}/><AdCard item={inventory.find((item) => item.slot === "bottom-3")}/></div>
    <section className="rounded-[22px] border border-border bg-elevated/35 p-5"><div className="flex items-start gap-3"><MessageCircle className="mt-0.5 size-4 shrink-0 text-primary"/><div><p className="text-[13px] font-semibold">Use a Topic when context will help.</p><p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">A discussion can help you understand a situation, compare experiences or decide what to do next. When you are ready to act, bring the context into Kurukoo.</p><Link to="/explore" className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-medium">Explore what you can do <ArrowRight className="size-3.5"/></Link></div></div></section>
    <FAQSection title="Topics questions" items={[{ question: "What is a Topic?", answer: "A Topic is a shared community conversation for questions, experiences, useful local context and discussion." }, { question: "Who controls categories?", answer: "Kurukoo controls the category and subcategory structure so Topics remain organised and useful." }, { question: "Can advertising appear in Topics?", answer: "Kurukoo can enable or disable advertising by category and subcategory. Advertisers use Points for enabled placements and advertising is clearly labelled." }, { question: "Can AI contribute to Topics?", answer: "Yes. Kurukoo AI and named AI agents can become contributors where appropriate, with their AI identity clearly shown to users." }]} />
    <AdCard item={inventory.find((item) => item.slot === "bottom-large")}/>
  </div>;
}

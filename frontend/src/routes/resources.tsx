import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";

type Resource = { slug: string; title: string; category: string; excerpt: string; updated_at?: string | null };

export const Route = createFileRoute("/resources")({
  head: () => ({ meta: [
    { title: "Kurukoo resources and visual guides" },
    { name: "description", content: "Short guides and visual explanations for getting more from Kurukoo." },
    { property: "og:title", content: "Kurukoo resources and visual guides" },
    { property: "og:description", content: "Learn how to use Kurukoo through short guides and visual explanations." },
  ], links: [{ rel: "canonical", href: "/resources" }] }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let cancelled = false; void fetch("/api/resources").then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<{ resources?: Resource[] }>; }).then((p) => { if (!cancelled) setResources(Array.isArray(p.resources) ? p.resources : []); }).catch(() => { if (!cancelled) setResources([]); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  return <div className="mx-auto w-full max-w-6xl space-y-8 pb-10">
    <header className="max-w-3xl"><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">RESOURCES</p><h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[50px]">Learn by seeing how it works</h1><p className="mt-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">Short guides and visual explanations for getting more from Kurukoo.</p><div className="mt-5"><AskKurukoo prompt="Show me how to get the most out of Kurukoo."/></div></header>
    {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-elevated/50"/>)}</div> : resources.length ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Kurukoo resources">{resources.map((resource)=><Link key={resource.slug} to="/resources/$slug" params={{slug:resource.slug}} className="group rounded-2xl border border-border bg-surface p-4 hover:bg-elevated"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-muted-foreground"><BookOpen className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-primary">{resource.category}</p><h2 className="mt-1 text-[14px] font-semibold leading-snug">{resource.title}</h2><p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{resource.excerpt}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground"/></div></Link>)}</section> : <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center"><BookOpen className="mx-auto size-5 text-muted-foreground"/><p className="mt-3 text-[14px] font-medium">Resources are being prepared.</p><p className="mt-1 text-[12px] text-muted-foreground">You can ask Kurukoo directly instead.</p><div className="mt-4"><AskKurukoo prompt="Show me how to use Kurukoo."/></div></div>}
    <FAQSection items={[{question:"What are Kurukoo Resources?",answer:"Resources are short educational guides that explain how to use Kurukoo for real tasks. They support the product rather than becoming a separate product surface."},{question:"Will there be visual guides?",answer:"Yes. Visual and how-to content can sit alongside written guides so useful flows are easier to understand."},{question:"Can I ask Kurukoo instead?",answer:"Yes. Chat is the quickest route when you would rather describe what you are trying to do and let Kurukoo guide the next step."}]}/>
  </div>;
}

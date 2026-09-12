import { ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type FAQItem = { question: string; answer: string };
type FAQSectionProps = { title?: string; items: FAQItem[]; pagePath?: string };

export function FAQSection({ title = "Frequently asked questions", items, pagePath }: FAQSectionProps) {
  const [canonicalItems, setCanonicalItems] = useState<FAQItem[] | null>(null);
  const [loading, setLoading] = useState(Boolean(pagePath));
  useEffect(() => {
    if (!pagePath) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/content/page?path=${encodeURIComponent(pagePath)}`, { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("FAQ content unavailable")))
      .then((payload: { faqs?: Array<{ question?: unknown; answer?: unknown }> }) => {
        if (cancelled) return;
        const next = Array.isArray(payload.faqs)
          ? payload.faqs.map((faq) => ({ question: String(faq.question ?? "").trim(), answer: String(faq.answer ?? "").trim() })).filter((faq) => faq.question && faq.answer)
          : [];
        setCanonicalItems(next.length ? next : null);
      })
      .catch(() => { if (!cancelled) setCanonicalItems(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pagePath]);

  const resolvedItems = (() => {
    if (!canonicalItems?.length) return items;
    const managedByQuestion = new Map(canonicalItems.map((item) => [item.question.toLowerCase(), item]));
    const merged = items.map((item) => managedByQuestion.get(item.question.toLowerCase()) ?? item);
    const fallbackQuestions = new Set(items.map((item) => item.question.toLowerCase()));
    return [...merged, ...canonicalItems.filter((item) => !fallbackQuestions.has(item.question.toLowerCase()))];
  })();

  if (!resolvedItems.length && !loading) return null;
  return (
    <section className="rounded-[22px] border border-border bg-surface p-5 md:p-6" aria-labelledby="faq-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Questions</p>
          <h2 id="faq-heading" className="mt-1.5 font-serif text-[27px] leading-[1.05] tracking-[-0.035em] md:text-[31px]">{title}</h2>
          {pagePath ? <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">Answers are maintained in Kurukoo’s content system when managed content is available; built-in role answers keep the page useful when it is not.</p> : null}
        </div>
        {loading ? <RefreshCw className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Loading managed FAQs" /> : null}
      </div>
      <div className="mt-5 divide-y divide-border/70 border-y border-border/70">
        {resolvedItems.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-medium [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2.5 max-w-3xl pr-8 text-[12.5px] leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

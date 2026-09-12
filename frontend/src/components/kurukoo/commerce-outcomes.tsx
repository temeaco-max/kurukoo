import { ArrowUpRight, Building2, ExternalLink, ShoppingBag, Store } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { commerceSupplyTypes, exampleCommerceJourneys } from "@/lib/kurukoo-commerce";

const routes = [
  { label: commerceSupplyTypes.provider, icon: Building2, prompt: "Find someone who can do this for me.", hint: "People & businesses" },
  { label: commerceSupplyTypes.business_storefront, icon: Store, prompt: "Find what I need from a business.", hint: "Products & services" },
  { label: commerceSupplyTypes.affiliate_partner, icon: ExternalLink, prompt: "Find the best available option for me.", hint: "Partner supply" },
] as const;

export function CommerceOutcomes() {
  return (
    <section aria-labelledby="get-the-thing" className="rounded-[22px] border border-border bg-foreground p-5 text-background md:p-6">
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-background/55">GET THE THING</p>
        <h2 id="get-the-thing" className="mt-1 font-serif text-[26px] leading-tight tracking-[-0.035em]">Tell Kurukoo what you need.</h2>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {exampleCommerceJourneys.map((item) => (
          <AskKurukoo key={item.title} prompt={item.title} className="h-auto min-h-[86px] rounded-xl bg-background/10 p-3 text-left hover:bg-background/15">
            <p className="text-[11.5px] font-medium">{item.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-background/55">{item.outcome}</p>
          </AskKurukoo>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {routes.map(({ label, icon: Icon, prompt, hint }) => (
          <AskKurukoo key={label} prompt={prompt} className="h-auto min-h-16 rounded-xl border border-background/10 bg-background/5 p-3 text-left hover:bg-background/10">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-background/70" />
              <p className="text-[11px] font-medium">{label}</p>
            </div>
            <p className="mt-1 text-[9.5px] text-background/45">{hint}</p>
          </AskKurukoo>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/businesses" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-background px-3 text-[11.5px] font-medium text-foreground">Browse businesses <ArrowUpRight className="size-3.5" /></Link>
        <Link to="/cart" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-background/15 px-3 text-[11.5px] font-medium text-background hover:bg-background/10">Review cart <ShoppingBag className="size-3.5" /></Link>
        <Link to="/chat" className="inline-flex min-h-8 items-center rounded-lg border border-background/15 px-3 text-[11.5px] font-medium text-background hover:bg-background/10">Open Chat</Link>
      </div>
    </section>
  );
}
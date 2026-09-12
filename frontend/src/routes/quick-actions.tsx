import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Zap } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { QuickRepliesPanel } from "@/components/kurukoo/quick-replies";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/quick-actions")({ head: () => ({ meta: [{ title: "Quick Actions — Kurukoo" }] }), component: QuickActionsPage });

function QuickActionsPage() {
  return <><PageHeader title="Quick Actions" subtitle="Start common requests without writing the same thing twice." /><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><QuickRepliesPanel /><Panel className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-tint text-brand-ink"><Zap className="size-4.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Make your own</p><h2 className="mt-1.5 font-serif text-[27px] leading-tight">Tell Kurukoo what you do often.</h2><p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Ask Kurukoo to turn a repeated request into a useful shortcut.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><AskKurukoo prompt="Help me create a quick action for something I do regularly." /><Link to="/chat" className={actionClass()}>Open Chat <ArrowUpRight className="ml-1 size-3.5" /></Link></div></Panel></div></>;
}

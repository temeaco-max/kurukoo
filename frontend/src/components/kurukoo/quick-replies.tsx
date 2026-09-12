import { Zap, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel } from "@/components/kurukoo/ui";
import { fetchQuickReplies, isKurukooApiConfigured, type QuickReply } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

const demoActions = ["Get me a ride", "Find a plumber", "Order food", "Book an appointment", "Track my request", "Plan my day"];
const iconFor = (action: string) => { const a = action.toLowerCase(); if (a.includes("ride")) return "RI"; if (a.includes("food") || a.includes("order")) return "FO"; if (a.includes("money") || a.includes("pay")) return "£"; if (a.includes("book") || a.includes("appoint")) return "BK"; if (a.includes("track") || a.includes("delivery")) return "TR"; return "AI"; };

export function QuickRepliesPanel() {
  const { send } = useKurukoo();
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(isKurukooApiConfigured());
  useEffect(() => { if (!isKurukooApiConfigured()) return; let cancelled = false; fetchQuickReplies().then((r) => { if (!cancelled) setItems(r); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const live = items.map((item) => ({ id: item.id, label: item.label, action: item.action, demo: false }));
  const examples = demoActions.map((label) => ({ id: `demo-${label}`, label, action: "Start in Kurukoo chat", demo: true }));
  const visible = [...live, ...examples.filter((example) => !live.some((item) => item.label.toLowerCase() === example.label.toLowerCase()))].slice(0, 8);
  return <Panel className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div className="flex items-center gap-2"><Zap className="size-4 text-primary"/><span className="text-[12.5px] font-medium">Quick actions</span></div><Link to="/quick-actions" className="text-[10.5px] text-muted-foreground hover:text-foreground">Open all</Link></div>{loading ? <div className="flex items-center gap-2 px-4 py-4"><Loader2 className="size-4 animate-spin text-muted-foreground"/><span className="text-[11.5px] text-muted-foreground">Loading…</span></div> : <div className="grid gap-2 p-3">{visible.map((item) => <button key={item.id} type="button" onClick={() => void send(item.demo ? item.label : item.label)} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-elevated"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated text-[9.5px] font-semibold text-muted-foreground">{iconFor(item.label)}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{item.label}</span><span className="block text-[10px] text-muted-foreground">{item.demo ? "Example action" : item.action}</span></span>{item.demo ? <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Example</span> : null}</button>)}</div>}</Panel>;
}

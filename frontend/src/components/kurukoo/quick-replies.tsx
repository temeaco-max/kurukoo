import { Zap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/kurukoo/ui";
import { fetchQuickReplies, type QuickReply } from "@/lib/kurukoo-api";
import { isKurukooApiConfigured } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

const iconFor = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes("ride") || a.includes("transport") || a.includes("okada")) return "Ride";
  if (a.includes("food") || a.includes("suya") || a.includes("order")) return "Food";
  if (a.includes("money") || a.includes("pay") || a.includes("top") || a.includes("transfer")) return "Money";
  if (a.includes("book") || a.includes("appoint") || a.includes("service")) return "Book";
  if (a.includes("track") || a.includes("order") || a.includes("delivery")) return "Track";
  if (a.includes("call") || a.includes("contact")) return "Contact";
  return "Quick";
};

function iconLabel(kind: string) {
  switch (kind) {
    case "Ride": return "quick_ride";
    case "Food": return "order_food";
    case "Money": return "transfer_money";
    case "Book": return "book_service";
    case "Track": return "track_request";
    case "Contact": return "contact_support";
    default: return "quick_action";
  }
}

export function QuickRepliesPanel() {
  const { send } = useKurukoo();
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isKurukooApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchQuickReplies()
      .then((r) => { if (!cancelled) setItems(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!isKurukooApiConfigured()) return null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span className="text-[12.5px] font-medium">Quick actions</span>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-[11.5px] text-muted-foreground">Loading quick actions…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-muted-foreground">No quick actions set up yet.</p>
        </div>
      ) : (
        <div className="grid gap-2 p-3">
          {items.map((item) => {
            const kind = iconFor(item.action);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.action.toLowerCase().includes("chat") || item.action.toLowerCase().includes("ask") || item.action.toLowerCase().includes("message")) {
                    void send(item.label);
                  } else {
                    window.location.href = item.action;
                  }
                }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left hover:border-primary/30 hover:bg-elevated transition-colors"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated text-[10.5px] font-medium text-muted-foreground">
                  {kind.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{item.label}</p>
                  <p className="text-[10.5px] text-muted-foreground">{item.action}</p>
                </div>
                <Link
                  to={item.action.includes("http") ? item.action : "/chat"}
                  className="shrink-0 grid size-7 place-items-center rounded-full bg-elevated text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
                  aria-label={`Quick action: ${item.label}`}
                >
                  →
                </Link>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Panel, Rows, SectionHeader } from "@/components/kurukoo/ui";
import { checkoutCart, fetchCart, removeCartItem, type CartItem } from "@/lib/commerce-api";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Kurukoo" }, { name: "description", content: "Review sourced offers before requesting the canonical checkout transition." }] }),
  component: CartPage,
});

function itemName(item: CartItem) { return item.name || item.title || "Sourced offer"; }
function itemAmount(item: CartItem) { const value = item.amount ?? item.price; return typeof value === "number" ? `${item.currency ?? ""} ${value}`.trim() : "Price not returned"; }

function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [checkoutState, setCheckoutState] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const cart = await fetchCart();
      setItems(cart.items);
      setTotal(cart.total ?? null);
      setCurrency(cart.currency ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your review cart is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(id: string | number) {
    if (busy) return;
    setBusy(String(id));
    setError("");
    try { await removeCartItem(id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The item could not be removed."); }
    finally { setBusy(""); }
  }

  async function checkout() {
    if (busy || !items.length) return;
    setBusy("checkout");
    setError("");
    setCheckoutState("");
    try {
      const result = await checkoutCart();
      const reference = result.orderId || result.requestId;
      setCheckoutState(reference ? `${result.status || "Checkout transition accepted"} · ${reference}` : result.status || result.message || "Checkout transition accepted by the canonical API.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not be requested.");
    } finally { setBusy(""); }
  }

  return <div className="space-y-8">
    <PageHeader title="Cart" subtitle="A review boundary for sourced offers. Nothing here is treated as purchased until the canonical checkout boundary returns evidence." />
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11.5px] text-destructive">{error}</div> : null}
    {checkoutState ? <div role="status" className="rounded-xl border border-primary/20 bg-brand-tint/10 px-4 py-3 text-[11.5px]">{checkoutState}</div> : null}
    {loading ? <Panel><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading your sourced offers…</div></Panel> : items.length ? <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section><SectionHeader title="Offers to review"/><Rows>{items.map((item) => <li key={String(item.id)} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[13.5px] font-semibold">{itemName(item)}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.seller || item.sellerPhone || "Seller not returned"}{item.source ? ` · ${item.source}` : ""}</p>{item.description ? <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">{item.description}</p> : null}<div className="mt-2 flex flex-wrap gap-2 text-[9.5px] text-muted-foreground">{item.status ? <span className="rounded-full bg-elevated px-2 py-1">{item.status.replace(/[_-]/g, " ")}</span> : null}{item.provenance ? <span className="rounded-full bg-elevated px-2 py-1">{item.provenance}</span> : null}</div></div><div className="flex shrink-0 items-center gap-3"><span className="text-[12px] font-medium">{itemAmount(item)}</span><button type="button" disabled={Boolean(busy)} onClick={() => void remove(item.id)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[10px] text-muted-foreground disabled:opacity-50" aria-label={`Remove ${itemName(item)}`}><Trash2 className="size-3.5" />{busy === String(item.id) ? "Removing…" : "Remove"}</button></div></div></li>)}</Rows></section>
      <aside><Panel className="sticky top-6"><div className="flex items-center gap-2"><ShoppingBag className="size-4 text-primary"/><h2 className="text-[14px] font-semibold">Review</h2></div><div className="mt-4 flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Items</span><span>{items.length}</span></div><div className="mt-2 flex items-center justify-between text-[13px] font-semibold"><span>Total returned</span><span>{total != null ? `${currency ?? ""} ${total}`.trim() : "Not returned"}</span></div><p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">Checkout is a canonical transition. If payment or seller confirmation is missing, Kurukoo will keep the request in a truthful non-complete state.</p><button type="button" disabled={Boolean(busy) || !items.length} onClick={() => void checkout()} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-medium text-primary-foreground disabled:opacity-50">{busy === "checkout" ? <Loader2 className="size-3.5 animate-spin" /> : null}{busy === "checkout" ? "Requesting checkout…" : "Continue to checkout"}<ArrowRight className="size-3.5" /></button></Panel></aside>
    </div> : <EmptyState title="Your review cart is empty" body="Choose a sourced seller offer in Discover or Chat before starting checkout." action={<Link to="/discover" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px]">Return to Discover <ArrowRight className="size-3.5" /></Link>} />}
    {items.some((item) => item.externalUrl) ? <section><SectionHeader title="External destinations"/><Rows>{items.filter((item) => item.externalUrl).map((item) => <li key={`external-${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-[12px] font-medium">{itemName(item)}</p><p className="text-[10px] text-muted-foreground">External seller destination</p></div><a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[10px]">Open <ExternalLink className="size-3" /></a></li>)}</Rows></section> : null}
  </div>;
}

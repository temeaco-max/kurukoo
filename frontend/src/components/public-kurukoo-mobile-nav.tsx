import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Sparkles, Tags, MapPin, Users, Store, Radio, Zap, Wallet, Brain, MessageCircle, Settings, ShieldCheck, Cookie, BookOpen } from "lucide-react";
import { useState } from "react";
import type { AuthMode } from "@/components/kurukoo/auth";

function ChatVoiceIcon({ className = "size-[18px]" }: { className?: string }) { return <span aria-hidden="true" className={`relative inline-block shrink-0 ${className}`}><MessageCircle className="absolute inset-0 size-full" strokeWidth={1.8}/><span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[1px]"><i className="h-[5px] w-px rounded-full bg-current"/><i className="h-[8px] w-px rounded-full bg-current"/><i className="h-[5px] w-px rounded-full bg-current"/></span></span>; }
const items = [
  ["/", "Home", Home],
  ["/chat", "Chat / Voice", MessageCircle],
  ["/discover", "Discover", Compass],
  ["/discover", "Nearby", MapPin],
  ["/topics", "Topics", Tags],
] as const;
const moreItems = [
  ["/resources", "Resources", BookOpen],
  ["/agents", "Agentic Storefront", Store],
  ["/connect", "Channels", Radio],
  ["/capabilities", "Capabilities", Zap],
  ["/opportunities", "Opportunities", Zap],
  ["/people", "People", Users],
  ["/providers", "Providers", Users],
  ["/businesses", "Businesses", Store],
  ["/creators", "Creators", Sparkles],
  ["/advertising", "Advertising", Zap],
  ["/how-it-works", "How it works", Compass],
  ["/work", "Actions", Compass],
  ["/pricing", "Plans", Wallet],
  ["/subscriptions", "Subscriptions", Wallet],
  ["/wallet", "Wallet", Wallet],
  ["/memory", "Memory", Brain],
  ["/messages", "Messages", MessageCircle],
  ["/contacts", "Contacts", Users],
  ["/settings", "Settings", Settings],
  ["/legal", "Legal & policies", ShieldCheck],
  ["/cookies", "Cookies", Cookie],
] as const;
function KurukooMark() { return <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-brand-tint text-[13px] font-semibold leading-none text-brand-ink">K</span>; }
export function PublicMobileNavigation({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" title="Open navigation" className="fixed left-3 top-2 z-50 grid size-9 place-items-center rounded-full border border-border bg-background/85 text-foreground shadow-[var(--shadow-soft)] backdrop-blur md:hidden"><span className="text-[18px] leading-none">☰</span></button>
    {open ? <><button type="button" aria-label="Close navigation" onClick={close} className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px] md:hidden" /><aside aria-label="Mobile public navigation" className="fixed inset-y-0 left-0 z-[70] flex w-[300px] flex-col border-r border-border bg-surface px-4 py-5 shadow-2xl md:hidden"><div className="flex items-center justify-between px-1 pb-7"><Link to="/" onClick={close} className="flex items-center gap-2"><KurukooMark/><span className="text-[17px] font-semibold tracking-[-0.025em]">Kurukoo</span></Link><button type="button" onClick={close} aria-label="Close navigation" className="grid size-9 place-items-center rounded-full hover:bg-elevated">×</button></div><nav className="space-y-1">{items.map(([to,label,Icon])=><Link key={`${to}-${label}`} to={to} onClick={close} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] leading-5 transition-colors ${isActive(to)?"bg-elevated font-medium text-foreground":"text-muted-foreground hover:bg-elevated hover:text-foreground"}`}>{label === "Chat / Voice" ? <ChatVoiceIcon/> : <Icon className="size-[18px] shrink-0" strokeWidth={1.8}/>} {label}</Link>)}</nav><div className="mt-6 rounded-2xl border border-border bg-brand-tint/35 p-3"><p className="text-[11px] font-medium leading-4">Discover more</p><p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">Guides, connections and more.</p></div><nav aria-label="More navigation" className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto">{moreItems.map(([to,label,Icon])=><Link key={to} to={to} onClick={close} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-5 ${isActive(to)?"bg-elevated font-medium text-foreground":"text-muted-foreground hover:bg-elevated hover:text-foreground"}`}><Icon className="size-4 shrink-0" strokeWidth={1.8}/>{label}</Link>)}</nav><div className="mt-auto pt-4"><button type="button" onClick={()=>{close();onAuth("login");}} className="flex w-full items-center justify-center rounded-xl border border-border px-3 py-2 text-[12px] font-medium">Log In</button><button type="button" onClick={()=>{close();onAuth("signup");}} className="mt-2 flex w-full items-center justify-center rounded-xl bg-foreground px-3 py-2 text-[12px] font-medium text-background">Try for free</button></div></aside></> : null}
  </>;
}

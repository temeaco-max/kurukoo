import { ArrowUpRight, CheckCircle2, CircleDashed, Info, Search } from "lucide-react";
import type { LucideIcon, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DirectoryState = "live" | "available" | "example" | "planned" | "not-connected";

const stateCopy: Record<DirectoryState, string> = {
  live: "Live",
  available: "Available",
  example: "Example",
  planned: "Coming soon",
  "not-connected": "Not connected",
};

export function DirectoryStateBadge({ state }: { state: DirectoryState }) {
  const Icon = state === "live" || state === "available" ? CheckCircle2 : state === "planned" ? CircleDashed : Info;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-medium", state === "live" || state === "available" ? "bg-brand-tint text-brand-ink" : "bg-elevated text-muted-foreground")}>
      <Icon className="size-3" /> {stateCopy[state]}
    </span>
  );
}

export function CapabilityPills({ items, limit = 5 }: { items: string[]; limit?: number }) {
  const visible = items.slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item) => <span key={item} className="rounded-full border border-border bg-background px-2.5 py-1 text-[9.5px] text-muted-foreground">{item}</span>)}
      {items.length > visible.length ? <span className="rounded-full bg-elevated px-2.5 py-1 text-[9.5px] text-muted-foreground">+{items.length - visible.length}</span> : null}
    </div>
  );
}

export function DirectorySearch({ value, onChange, placeholder, label = "Search" }: { value: string; onChange: (value: string) => void; placeholder: string; label?: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="surface-directory-search" className="sr-only">{label}</label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input id="surface-directory-search" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}

export function DirectoryCard({ icon: Icon, title, subtitle, description, state = "available", capabilities = [], meta, primary, secondary, href }: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  description: string;
  state?: DirectoryState;
  capabilities?: string[];
  meta?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  href?: string;
}) {
  const content = (
    <article className="group flex h-full flex-col rounded-[18px] border border-border bg-surface p-4 transition-colors hover:bg-elevated/45">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink"><Icon className="size-4.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><h3 className="text-[14px] font-semibold">{title}</h3><DirectoryStateBadge state={state} /></div>
          {subtitle ? <p className="mt-1 text-[10.5px] font-medium text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
      {meta ? <div className="mt-2 text-[10px] text-muted-foreground">{meta}</div> : null}
      {capabilities.length ? <div className="mt-3"><CapabilityPills items={capabilities} /></div> : null}
      {primary || secondary || href ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {primary}
          {secondary}
          {href ? <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-medium">Details <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span> : null}
        </div>
      ) : null}
    </article>
  );
  return href ? <a href={href} className="block h-full">{content}</a> : content;
}

export function DirectoryEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-[18px] border border-dashed border-border bg-surface p-7 text-center"><p className="text-[13px] font-medium">{title}</p><p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

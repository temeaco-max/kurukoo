import { ArrowRight, Compass, FileStack, MapPin, UsersRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { actionClass } from "@/components/kurukoo/primitives";

const items = [
  { href: "/explore", label: "Explore", description: "People, businesses, services, products and opportunities.", icon: Compass },
  { href: "/agents", label: "Agents", description: "See the agents available to help and what they can access.", icon: UsersRound },
  { href: "/artifacts", label: "Artifacts", description: "Keep useful outputs connected to the work that created them.", icon: FileStack },
  { href: "/discover", label: "Nearby", description: "See local signals without confusing discovery with confirmation.", icon: MapPin },
] as const;

export function SurfaceNext() {
  return <section className="grid gap-3 sm:grid-cols-2">{items.map(({ href, label, description, icon: Icon }) => <Link key={href} to={href} className="group rounded-[22px] border border-border bg-surface p-5 transition-colors hover:bg-elevated"><div className="flex items-start justify-between gap-4"><span className="grid size-9 place-items-center rounded-xl bg-elevated"><Icon className="size-4" /></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><h3 className="mt-5 text-[14px] font-semibold">{label}</h3><p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{description}</p><span className={`${actionClass()} mt-4`}>Open {label}</span></Link>)}</section>;
}

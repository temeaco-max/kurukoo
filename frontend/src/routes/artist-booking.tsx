import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Music2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ArtistBookingCard } from "@/components/kurukoo/artist-booking";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/artist-booking")({ head: () => ({ meta: [{ title: "Artist Booking — Kurukoo" }] }), component: ArtistBookingPage });
function ArtistBookingPage() { return <><PageHeader title="Artist Booking" subtitle="Find and verify performers and event specialists through Kurukoo." /><div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><ArtistBookingCard /><Panel className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-tint text-brand-ink"><Music2 className="size-4.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Start a booking</p><h2 className="mt-1.5 font-serif text-[27px] leading-tight">Tell Kurukoo what your event needs.</h2><p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">You can ask for a DJ, MC, photographer, caterer, decorator, band or another supported event capability.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><AskKurukoo prompt="I need an artist or event specialist. Help me find and verify the right person." /><Link to="/chat" className={actionClass()}>Open Chat <ArrowUpRight className="ml-1 size-3.5" /></Link></div></Panel></div></>; }

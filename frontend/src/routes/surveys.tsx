import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { SurveyPromptCard } from "@/components/kurukoo/survey-prompt";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/surveys")({ head: () => ({ meta: [{ title: "Surveys — Kurukoo" }] }), component: SurveysPage });
function SurveysPage() { return <><PageHeader title="Surveys" subtitle="Give Kurukoo useful feedback when a short question appears." /><div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><SurveyPromptCard /><Panel className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-tint text-brand-ink"><MessageCircle className="size-4.5" /></span><div><h2 className="font-serif text-[27px] leading-tight">Your answers improve the experience.</h2><p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Only answer what you want to share. Available questions come from the canonical Kurukoo survey service.</p></div></div></Panel></div></>; }

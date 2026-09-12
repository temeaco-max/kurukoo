import { ArrowLeft, Bot, ShieldCheck } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/ai-terms")({
  head: () => ({
    meta: [
      { title: "AI Terms — Kurukoo" },
      { name: "description", content: "Terms governing Kurukoo's AI, voice, automation and action capabilities." },
    ],
  }),
  component: AiTermsPage,
});

const sections = [
  ["AI is an assistant, not a source of guaranteed truth", "Kurukoo may use artificial intelligence to understand requests, summarise information, suggest options, plan supported actions, communicate conversationally and help coordinate real-world services. AI output can be incomplete, outdated or incorrect. Kurukoo does not represent an AI response as proof of availability, pricing, inventory, identity verification, payment, dispatch or fulfilment."],
  ["Canonical services remain authoritative", "When a capability depends on a current system of record, the service that owns that state remains authoritative. Kurukoo's AI and agents may retrieve, interpret or propose actions through approved capability boundaries but must not replace the underlying authority with a generated answer."],
  ["Actions on your behalf", "Kurukoo can prepare or execute supported actions when the necessary capability, permission, provider relationship and evidence exist. Consequential actions may require your confirmation, authentication, payment approval, communication approval or another explicit control. Saying something in conversation does not by itself authorise every consequential action."],
  ["Voice and the Hey Kurukoo experience", "Voice can be used as an interface to the same Kurukoo conversation and action system. Voice features may depend on browser, device, network and configured AI or speech providers. Any hands-free wake phrase feature is limited by the device and application permissions provided to it; Kurukoo does not assume it can listen outside the permitted application or device context."],
  ["Memory and personal context", "Kurukoo may use permitted account context or memory to reduce repetition and personalise assistance. Memory is not proof of a current fact, permission or provider state. You remain responsible for reviewing important details when they materially affect a decision or action."],
  ["Third-party AI and connected services", "Some AI, speech, storage, messaging, search or execution capabilities may depend on third-party providers. Their availability, terms, pricing and processing may change. A connection or configured credential does not by itself mean that a capability is live or verified."],
  ["Safety and high-impact decisions", "Kurukoo is not a substitute for professional judgement, emergency response or legally required human review where those are applicable. Do not rely on generated output alone for urgent safety matters, medical diagnosis or treatment, financial decisions, legal decisions, identity verification or other high-impact decisions."],
  ["User responsibility", "You remain responsible for the instructions you provide, information you confirm, permissions you grant and consequential choices you approve. Do not use Kurukoo to facilitate unlawful, deceptive, abusive, harmful or unauthorised activity."],
  ["Changes and limitations", "AI models, voice providers, capabilities and connected services may change or become unavailable. Kurukoo may limit, suspend or disable an AI capability where required for safety, security, legal, provider or operational reasons."],
];

function AiTermsPage() {
  return <div className="mx-auto w-full max-w-4xl">
    <Link to="/legal" className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Service agreement & legal policies</Link>
    <section className="mt-6 max-w-3xl">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-brand-ink"><Bot className="size-5" /></span>
      <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">Service agreement</p>
      <h1 className="mt-1.5 text-[42px] font-semibold leading-[1.02] tracking-[-0.05em] md:text-[56px]">AI Terms</h1>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">These terms explain how Kurukoo's AI, voice and automation capabilities fit into the service, including what AI may do, what it cannot guarantee, and where your control remains required.</p>
    </section>
    <Panel className="mt-8 border-primary/15 bg-brand-tint/10 p-5">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-[12.5px] font-semibold">Product-policy foundation</p><p className="mt-1 text-[12px] leading-6 text-muted-foreground">This page is the product's AI policy surface and should be reviewed and replaced with final jurisdiction-specific contractual language before binding public publication.</p></div></div>
    </Panel>
    <article className="mt-9 space-y-8">
      {sections.map(([heading, body], index) => <section key={heading}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</p><h2 className="mt-1.5 text-[20px] font-semibold tracking-tight">{heading}</h2><p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">{body}</p></section>)}
    </article>
    <div className="mt-10 border-t border-border pt-7 pb-8"><p className="text-[11.5px] leading-6 text-muted-foreground">AI Terms should be read together with the Terms of Service, Privacy Policy, Safety & Trust and Acceptable Use policies.</p><Link to="/legal" className="mt-3 inline-flex text-[11.5px] font-medium text-primary">Return to legal & policies</Link></div>
  </div>;
}
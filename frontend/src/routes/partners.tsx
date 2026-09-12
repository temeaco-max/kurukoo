import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [{ title: "Partners — Kurukoo" }, { name: "description", content: "Understand partner participation in the Kurukoo ecosystem and how to join." }] }),
  component: PartnersPage,
});

function PartnersPage() {
  return <RoleLanding
    eyebrow="For partners"
    title="Bring your organisation's capability into Kurukoo."
    intro="Partners extend what Kurukoo can help people accomplish by bringing services, distribution, infrastructure or specialist capability into defined, authorised relationships."
    whatKurukooIs="A coordination layer between people with goals and organisations that can help fulfil them. Partnership is about a clear capability and a defined way to connect it—not simply placing a logo in a directory."
    participation={["Bring a service, distribution channel, integration or specialist capability.", "Define what your organisation can support and the boundaries of that support.", "Work with Kurukoo on authorised discovery, coordination or integrations.", "Provide the evidence and operational contacts needed to keep the relationship trustworthy."]}
    benefits={["Access to relevant demand and new distribution opportunities.", "A clearer route from discovery to authorised coordination.", "Potential commercial or strategic partnership opportunities.", "A durable relationship with an execution-focused AI platform."]}
    features={["Partner profile and capability description", "Integration and connection options", "Opportunity discovery", "Coordinated work and requests", "Authorised service connections", "Partner support and onboarding"]}
    useCases={["A service company connects an authorised capability so Kurukoo can route suitable requests into its existing operation.", "A distribution partner helps extend access to a service in locations Kurukoo cannot directly serve.", "A technology partner provides a supported integration that lets people complete a task through Kurukoo.", "An organisation works with Kurukoo on a defined campaign, service or community initiative."]}
    offer="Ask Kurukoo about the current partner onboarding programme. Any launch terms, pilot arrangements or commercial incentives depend on the partnership and are confirmed before you commit."
    referral="Eligible partner referrals can be attributed through Kurukoo's referral system. Where a referral qualifies for a reward, the current programme rules determine when it is approved; pending referrals are not represented as settled earnings."
    joinPrompt="I want to partner with Kurukoo. Help me understand the partner opportunities and onboarding requirements."
    primaryLabel="Explore partnership"
    primaryTo="/connect"
  />;
}

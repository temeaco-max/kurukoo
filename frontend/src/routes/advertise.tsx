import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/advertise")({
  head: () => ({ meta: [{ title: "Advertisers — Kurukoo" }, { name: "description", content: "Understand what Kurukoo offers advertisers and how to get started." }] }),
  component: AdvertisePage,
});

function AdvertisePage() {
  return <RoleLanding
    eyebrow="For advertisers"
    title="Reach people when what you offer is relevant."
    intro="Kurukoo advertising is designed around useful discovery: clearly labelled sponsored offers can appear where people are already exploring services, products, Topics, creators and opportunities."
    whatKurukooIs="A place to reach people through declared, contextual discovery rather than treating private conversations as an advertising feed. Sponsored content stays distinct from organic recommendations and is subject to eligibility, creative and moderation rules."
    participation={["Promote a genuine business, product, service, event or other eligible offer.", "Choose suitable placements, audience context and campaign goals within the controls Kurukoo provides.", "Submit creative that meets advertising and moderation requirements.", "Review serving, spend and performance only from measurement data Kurukoo actually has."]}
    benefits={["Reach audiences in discovery contexts where your offer can be useful.", "Connect promotion with Topics, local discovery, offers and creator surfaces where eligible.", "Clear sponsored disclosure and a defined campaign lifecycle.", "Potentially turn relevant discovery into visits, enquiries, requests or other supported outcomes."]}
    features={["Campaign creation", "Sponsored discovery placements", "Topic and local context", "Creative and moderation workflow", "Spend and billing controls", "Campaign measurement when available"]}
    useCases={["A local restaurant promotes an offer to people exploring nearby food and relevant Topics.", "A service business promotes a seasonal service where people are already looking for that kind of help.", "A creator or eligible organisation promotes useful content into relevant discovery surfaces.", "A business runs a campaign and reviews actual serving and conversion evidence rather than assumed results."]}
    offer="Ask Kurukoo about current advertiser onboarding, launch credits or other promotional offers. Pricing, placement availability and any deal are confirmed from the live advertising programme rather than assumed from example campaign data."
    referral="Where an eligible advertiser referral programme is active, Kurukoo can attribute the referred account and apply the current qualification rules. Any commission or reward remains pending until the qualifying conditions are satisfied."
    joinPrompt="I want to advertise on Kurukoo. Help me understand eligibility, placements, pricing, current offers and how to start."
    primaryLabel="Start advertising"
    primaryTo="/chat?prompt=I%20want%20to%20advertise%20on%20Kurukoo"
  />;
}

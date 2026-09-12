import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/advertising")({
  head: () => ({ meta: [{ title: "Advertisers — Kurukoo" }, { name: "description", content: "Understand Kurukoo advertising, who it is for and how to get started." }] }),
  component: AdvertisingPage,
});

function AdvertisingPage() {
  return <RoleLanding
    eyebrow="For advertisers"
    title="Reach people when what you offer is relevant."
    intro="Kurukoo advertising is designed around useful discovery: clearly labelled sponsored offers can appear where people are already exploring services, products, Topics, creators and opportunities."
    whatKurukooIs="A place to reach people through declared, contextual discovery rather than pretending that private conversations are an advertising feed. Sponsored content is kept distinct from organic recommendations and subject to eligibility, creative and moderation rules."
    participation={["Promote a genuine business, product, service, event or other eligible offer.", "Choose suitable placements, audience context and campaign goals within Kurukoo's available controls.", "Submit creative that meets advertising and moderation requirements.", "Review serving, spend and performance only from the measurement data Kurukoo actually has."]}
    benefits={["Reach audiences in discovery contexts where your offer can be useful.", "Connect promotion with Topics, local discovery, offers and creator surfaces where eligible.", "A clearer sponsored label and campaign lifecycle rather than hidden promotion.", "Potentially turn relevant discovery into visits, enquiries, requests or other supported outcomes."]}
    features={["Campaign creation through Kurukoo", "Sponsored discovery placements", "Topic and local context", "Creative and moderation workflow", "Spend and billing controls", "Campaign measurement when available"]}
    useCases={["A local restaurant promotes an offer to people exploring nearby food and relevant Topics.", "A service business promotes a seasonal service where people are already looking for that kind of help.", "A creator or eligible organisation promotes useful content into relevant discovery surfaces.", "A business runs a campaign and reviews actual serving and conversion evidence rather than assumed results."]}
    offer="Ask Kurukoo about current advertiser onboarding or launch incentives. Pricing, credits, placement availability and any promotional deal are confirmed from the live advertising programme rather than assumed from example campaign data."
    referral="Where an eligible advertiser referral programme is active, Kurukoo can attribute the referred account and apply the current qualification rules. Any commission or reward remains pending until the qualifying conditions are satisfied."
    joinPrompt="I want to advertise on Kurukoo. Help me understand eligibility, placements, pricing and how to start."
    primaryLabel="Start advertising"
    primaryTo="/advertising"
  />;
}

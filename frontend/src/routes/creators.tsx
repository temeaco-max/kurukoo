import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/creators")({
  head: () => ({ meta: [{ title: "Creators — Kurukoo" }, { name: "description", content: "Understand how creators can publish, reach people and participate in Kurukoo." }] }),
  component: CreatorsPage,
});

function CreatorsPage() {
  return <RoleLanding
    eyebrow="For creators"
    title="Create useful things and put them where people can find them."
    intro="Creators can use Kurukoo to publish useful content, build an audience and connect content with Topics, discovery and real-world intent."
    whatKurukooIs="An audience and discovery layer around an execution-focused AI OS. Your content can help people understand something, discover an option or take a useful next step—without turning Kurukoo into an uncontrolled social feed."
    participation={["Publish useful videos, ideas and other eligible creator content.", "Connect content with relevant Topics and discovery surfaces.", "Build an audience through creator and community participation.", "Take part in eligible campaigns, opportunities or commerce where the product supports them."]}
    benefits={["A place for useful content to meet people with an active need or interest.", "Creator discovery and audience-building tools.", "Potential earnings or campaign opportunities where you qualify.", "A closer connection between content, Topics and actions people actually take."]}
    features={["Creator profile and channel", "Watch and video discovery", "Topics and placement", "Audience and subscriber tools", "Creator opportunities", "Earnings and campaign surfaces"]}
    useCases={["A creator publishes a practical video that helps someone solve a common local problem.", "A specialist builds a channel around useful guidance and connects relevant videos to Topics.", "A creator participates in an eligible campaign where the commercial relationship is disclosed.", "A viewer discovers a useful creator through Kurukoo and continues into Chat or another supported action."]}
    offer="Ask Kurukoo about the current creator onboarding programme, launch opportunities and any available promotion or earning incentives. Eligibility and payout terms are confirmed before they are presented as available to you."
    referral="Eligible creator referrals can be attributed through Kurukoo's referral system. If the referred participant meets the current programme conditions, the relevant reward is applied according to the referral and Points/commercial rules."
    joinPrompt="I want to become a Kurukoo creator. Help me understand the creator programme and how to get started."
    primaryLabel="Start creating"
    primaryTo="/chat?prompt=I%20want%20to%20become%20a%20Kurukoo%20creator"
  />;
}

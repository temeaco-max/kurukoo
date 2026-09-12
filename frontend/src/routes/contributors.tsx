import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/contributors")({
  head: () => ({ meta: [{ title: "Contributors — Kurukoo" }, { name: "description", content: "Understand how contributors can help make Kurukoo more useful and how to join." }] }),
  component: ContributorsPage,
});

function ContributorsPage() {
  return <RoleLanding
    eyebrow="For contributors"
    title="Help make Kurukoo more useful, one useful contribution at a time."
    intro="Contributors help improve the information, local context, curation, accessibility, moderation and practical knowledge that make an execution-focused OS useful to real people."
    whatKurukooIs="A system that needs good local knowledge and careful human participation as much as it needs technology. Contributor work is scoped so that useful input can be recognised, reviewed and connected to the part of Kurukoo it improves."
    participation={["Add or improve useful knowledge and local context where a contribution workflow is available.", "Help with curation, accessibility, moderation or other defined contribution tasks.", "Surface gaps, errors and opportunities that would make Kurukoo more useful.", "Take on scoped opportunities rather than being expected to moderate or manage everything."]}
    benefits={["A practical way to contribute skills and local knowledge.", "Potential Points or other programme rewards for qualifying activities.", "Opportunities to build recognised participation and useful relationships.", "A direct role in improving a product intended for real-world use."]}
    features={["Contributor opportunities", "Topics and community context", "Scoped microtasks where available", "Points and contribution history", "Feedback and reporting", "Contributor community"]}
    useCases={["A local contributor adds reliable context that helps people understand a place, service or opportunity.", "A contributor spots an outdated or misleading piece of information and submits a correction.", "Someone with accessibility expertise helps improve a surface so more people can use it.", "A contributor takes a defined microtask and receives the appropriate participation credit when the task qualifies."]}
    offer="Ask Kurukoo about current contributor opportunities and any launch Points or recognition offers. Rewards depend on the activity and programme rules in force when you participate."
    referral="If the contributor programme has an eligible referral path, your referral can be attributed and any qualifying reward handled through the canonical referral and Points rules. Kurukoo does not treat a referral as rewarded simply because someone clicked your link."
    joinPrompt="I want to become a Kurukoo contributor. Show me the contribution opportunities and how to join."
    primaryLabel="Become a contributor"
    primaryTo="/chat?prompt=I%20want%20to%20become%20a%20Kurukoo%20contributor"
  />;
}

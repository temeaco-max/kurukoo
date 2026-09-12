import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/businesses")({
  head: () => ({ meta: [{ title: "Businesses — Kurukoo" }, { name: "description", content: "Understand what Kurukoo offers businesses and how to bring a business onto the network." }] }),
  component: BusinessesPage,
});

function BusinessesPage() {
  return <RoleLanding
    eyebrow="For businesses"
    title="Put your business where demand is already happening."
    intro="Kurukoo gives businesses a way to become discoverable, respond to real requests, build customer relationships and participate in local commerce through one execution-focused platform."
    whatKurukooIs="A customer and coordination layer for businesses: people can ask Kurukoo for an outcome, discover relevant businesses and—where supported—move into a real request, conversation or commercial flow. Your business remains responsible for the service you actually provide."
    participation={["Create a useful business presence with accurate products, services, location and operating details.", "Respond to suitable requests and keep your team connected to work in progress.", "Use discovery, offers and eligible advertising to reach relevant demand.", "Build customer relationships from real interactions rather than artificial engagement numbers."]}
    benefits={["More discoverability when what you offer matches a person's intent or location.", "A coordinated place for requests, customer conversations and work.", "Opportunities to reach new customers through discovery and sponsored promotion.", "Business insights based on the information and activity Kurukoo can actually verify."]}
    features={["Business profile and discovery", "Products and services", "Requests and orders", "Customer conversations", "Offers and promotion", "Team, billing and subscriptions"]}
    useCases={["A restaurant becomes discoverable when someone asks Kurukoo for food nearby and can respond to an appropriate request.", "A repair business receives a suitable job, reviews the request and coordinates the work with the customer.", "A retailer promotes a genuine offer in an eligible sponsored placement and reviews actual campaign evidence.", "A mobile business uses location and availability signals to be discoverable where it can genuinely serve customers."]}
    offer="Ask Kurukoo about current business onboarding, launch credits, plan trials or other promotional offers. Availability depends on the live programme and market; the OS should never imply an offer that has not been confirmed."
    referral="Eligible business referrals can be attributed through Kurukoo's referral system. If the referred business completes the current qualifying steps, any applicable reward is handled through the referral and commercial/Points rules."
    joinPrompt="I want to bring my business onto Kurukoo. Help me understand the setup, features, requirements and current offers."
    primaryLabel="Set up a business"
    primaryTo="/chat?prompt=I%20want%20to%20bring%20my%20business%20onto%20Kurukoo"
  />;
}

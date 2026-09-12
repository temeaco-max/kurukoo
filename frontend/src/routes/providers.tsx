import { createFileRoute } from "@tanstack/react-router";
import { RoleLanding } from "@/components/kurukoo/role-landing";

export const Route = createFileRoute("/providers")({
  head: () => ({ meta: [{ title: "Providers — Kurukoo" }, { name: "description", content: "Understand what Kurukoo offers service providers and how to join." }] }),
  component: ProvidersPage,
});

function ProvidersPage() {
  return <RoleLanding
    eyebrow="For providers"
    title="Turn what you can do into work people can find."
    intro="Kurukoo helps people describe what they need, discover suitable providers and move a supported request toward a real outcome. You can participate as an individual, mobile provider or business offering a service."
    whatKurukooIs="A place where your genuine capability can become discoverable in the context of a real request. Kurukoo handles the conversation and coordination while your availability, capability, verification and commitments remain grounded in the evidence the system actually has."
    participation={["List a genuine skill, service or capability.", "Make your location, service area and availability useful for discovery when supported.", "Respond to suitable requests and coordinate work through Kurukoo.", "Build a trusted history through completed work and appropriate feedback."]}
    benefits={["More opportunities to be discovered when your capability matches demand.", "A single place to coordinate customer requests and conversations.", "Potential earnings from eligible work, with commercial terms shown before commitment.", "A clearer reputation built from real participation rather than invented rankings."]}
    features={["Provider profile and capability discovery", "Requests, offers and coordination", "Availability and Go Live when eligible", "Chat and provider communication", "Work and completion tracking", "Reviews and trust signals"]}
    useCases={["A plumber makes their service area and availability discoverable, then receives a suitable repair request.", "A mobile food provider responds to a nearby order and coordinates fulfilment through the request lifecycle.", "A skilled individual offers a specific service and uses Kurukoo to turn suitable demand into work.", "A provider follows an active request, supplies evidence and closes the loop after the work is done."]}
    offer="Ask Kurukoo for the current provider sign-up offer and eligibility in your market. Any launch incentive, fee waiver or promotional benefit is shown only when it is actually available to you."
    referral="When you refer someone who joins through an eligible referral path, Kurukoo can attribute the referral and apply the programme's current qualification and reward rules. Referral rewards are not treated as earned until the relevant conditions are met."
    joinPrompt="I want to become a Kurukoo provider. Help me understand the requirements and how to get started."
    primaryLabel="Become a provider"
    primaryTo="/provider"
  />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";

// Mirrors the backend /earn/:topic redirect: canonical earn topics map onto
// explore categories so legacy entry points land on the same content.
const EARN_CATEGORY: Record<string, string> = {
  refer: "money-circle",
  agents: "professional-services",
  rides: "transport",
  delivery: "logistics",
  repairs: "repairs",
  errands: "errands-delivery",
  support: "professional-services",
  build: "workers",
  work: "gigs",
  help: "professional-services",
  sell: "classifieds",
  promote: "professional-services",
  contributor: "gigs",
  tasks: "gigs",
};

export const Route = createFileRoute("/earn/$topic")({
  beforeLoad: ({ params }) => {
    const category = EARN_CATEGORY[params.topic];
    if (category) {
      throw redirect({ to: `/discover/${category}`, replace: true });
    }
    throw redirect({ to: "/discover", replace: true });
  },
});

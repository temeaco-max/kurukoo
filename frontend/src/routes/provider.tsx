import { createFileRoute } from "@tanstack/react-router";
import { ProviderWorkspace } from "@/components/kurukoo/provider-workspace";
export const Route = createFileRoute("/provider")({
  head: () => ({
    meta: [
      { title: "Provider workspace — Kurukoo" },
      {
        name: "description",
        content: "Discover and manage provider capabilities, businesses and Kurukoo AI agents.",
      },
    ],
  }),
  component: ProviderWorkspace,
});

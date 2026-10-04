import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/videos/$videoId")({
  beforeLoad: () => {
    throw redirect({ to: "/help" });
  },
});

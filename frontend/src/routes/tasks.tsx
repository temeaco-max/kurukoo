import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /tasks is a supported OS navigation entry. There is no separate Tasks surface;
 * tasks live inside the canonical Work surface, so this route forwards there.
 */
export const Route = createFileRoute("/tasks")({
  beforeLoad: () => {
    throw redirect({ to: "/work" });
  },
});

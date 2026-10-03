import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workspace")({
  beforeLoad: () => {
    throw redirect({ to: "/field" });
  },
  head: () => ({
    meta: [
      { title: "Field — Kurukoo" },
      {
        name: "description",
        content: "Your personal Field for getting useful things done with Kurukoo.",
      },
    ],
  }),
});

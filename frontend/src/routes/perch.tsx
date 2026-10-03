import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibility route. `/perch` was renamed to `/field`; this redirect keeps
// bookmarks, emailed links and embedded references resolving. It is the only
// place the retired path may appear — do not link to `/perch` from product UI.
export const Route = createFileRoute("/perch")({
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

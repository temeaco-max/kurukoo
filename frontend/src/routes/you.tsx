import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/you")({
  beforeLoad: () => { throw redirect({ to: "/perch" }); },
  head: () => ({ meta: [{ title: "Perch — Kurukoo" }, { name: "description", content: "Your personal Perch for getting useful things done with Kurukoo." }] }),
});

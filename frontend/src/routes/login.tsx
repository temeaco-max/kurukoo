import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthPanel } from "@/components/kurukoo/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Kurukoo" },
      { name: "description", content: "Log in to Kurukoo and pick up where you left off." },
      { property: "og:title", content: "Log in — Kurukoo" },
      { property: "og:description", content: "Log in to Kurukoo." },
      { property: "og:url", content: "/login" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    return: typeof search['return'] === "string" ? search['return'] : "",
    conversationId: typeof search['conversationId'] === "string" ? search['conversationId'] : "",
    guest_id: typeof search['guest_id'] === "string" ? search['guest_id'] : "",
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  return (
    <AuthPanel
      returnTo={search['return'] || "/chat"}
      conversationId={search['conversationId'] || undefined}
      guestId={search['guest_id'] || undefined}
      title="Welcome back"
      subtitle="Log in to see what Kurukoo has been getting on with."
      cta="Log in"
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="underline">
            Create an account
          </Link>
        </>
      }
    />
  );
}

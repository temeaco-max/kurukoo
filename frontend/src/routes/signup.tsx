import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthPanel } from "@/components/kurukoo/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Get started — Kurukoo" },
      {
        name: "description",
        content: "Create a Kurukoo account and start handing things over instead of chasing them.",
      },
      { property: "og:title", content: "Get started — Kurukoo" },
      { property: "og:description", content: "Create your Kurukoo account." },
      { property: "og:url", content: "/signup" },
    ],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthPanel
      title="Get started"
      subtitle="We send a one-time verification code to your email or phone. Tell Kurukoo what you need. It gets to work."
      cta="Create account"
      showName
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </>
      }
    />
  );
}

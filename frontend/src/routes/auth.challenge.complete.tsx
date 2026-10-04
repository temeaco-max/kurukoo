import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/challenge/complete")({
  head: () => ({
    meta: [
      { title: "Completing Kurukoo sign-in" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthChallengeCompletePage,
});

function AuthChallengeCompletePage() {
  const [title, setTitle] = useState("Completing sign-in…");
  const [message, setMessage] = useState("One-time link. Single use. Phone remains the primary channel identity once proven.");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("token") || "").trim();
    const returnTo = params.get("return") || "/chat";
    if (!token) {
      setTitle("Link missing");
      setMessage("Request a new magic link from continue with Kurukoo.");
      setIsError(true);
      return;
    }
    fetch("/api/auth/complete-challenge", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({} as any));
        if (!response.ok || !data.success) throw new Error(data.message || "Sign-in link could not be completed");
        if (data.token) window.localStorage.setItem("kurukoo_auth_token", data.token);
        if (data.phone) window.localStorage.setItem("kurukoo_user_phone", data.phone);
        setTitle(data.provisional ? "Email credential connected" : "You are signed in");
        setMessage(data.message || "Continuing…");
        const target =
          data.returnPath && String(data.returnPath).startsWith("/")
            ? data.returnPath
            : returnTo.startsWith("/")
              ? returnTo
              : "/chat";
        window.setTimeout(() => window.location.assign(target), 700);
      })
      .catch((error) => {
        setTitle("Sign-in could not complete");
        setMessage(error instanceof Error ? error.message : "Request a new magic link.");
        setIsError(true);
      });
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-5 py-10">
      <section className="w-full rounded-[24px] border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          PROGRESSIVE IDENTITY
        </p>
        <h1 className="mt-2 font-serif text-[30px] leading-[1.05] tracking-[-0.035em]">{title}</h1>
        <p className={`mt-3 text-[13px] leading-6 ${isError ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
        <Link to="/chat" className="mt-5 inline-flex text-[12px] font-medium text-primary">
          ← Back to chat
        </Link>
      </section>
    </div>
  );
}

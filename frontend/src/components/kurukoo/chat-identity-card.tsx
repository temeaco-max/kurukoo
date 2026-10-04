import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { AuthFlow, type AuthMode } from "@/components/kurukoo/auth";
import { getKurukooAuthState, logoutKurukoo } from "@/lib/kurukoo-auth";

type IdentityState = "loading" | "guest" | "signed-in";

/**
 * Identity inside the conversation.
 *
 * Sign in, create an account and sign out happen here rather than on separate
 * pages: the conversation keeps its context, and the user never loses the thread
 * to reach an identity screen.
 */
export function ChatIdentityCard({
  requestedMode,
  onDismiss,
  onIdentityChange,
}: {
  requestedMode?: AuthMode | null;
  onDismiss: () => void;
  onIdentityChange?: (authenticated: boolean) => void;
}) {
  const [state, setState] = useState<IdentityState>("loading");
  const [mode, setMode] = useState<AuthMode>(requestedMode === "signup" ? "signup" : "login");
  const [busy, setBusy] = useState(false);

  const read = async () => {
    const result = await getKurukooAuthState();
    const next: IdentityState = result.authenticated ? "signed-in" : "guest";
    setState(next);
    onIdentityChange?.(result.authenticated);
    return result;
  };

  useEffect(() => {
    void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (requestedMode) setMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    const onAuth = () => {
      void read();
    };
    window.addEventListener("kurukoo-auth-updated", onAuth);
    return () => window.removeEventListener("kurukoo-auth-updated", onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    setBusy(true);
    try {
      await logoutKurukoo();
      await read();
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section
        aria-label="Your Kurukoo identity"
        className="mx-auto max-w-[820px] rounded-2xl border border-border bg-surface p-4"
      >
        <div className="h-16 animate-pulse rounded-xl bg-elevated/60" />
      </section>
    );
  }

  if (state === "signed-in") {
    return (
      <section
        aria-label="Your Kurukoo identity"
        className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
      >
        <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          You are signed in. This conversation, its requests and your memory stay connected.
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12px] font-medium disabled:opacity-60"
        >
          <LogOut className="size-3.5" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Your Kurukoo identity"
      className="mx-auto max-w-[820px] rounded-2xl border border-border bg-surface p-4 md:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            <UserRound className="size-3.5" />
            CONTINUE SECURELY
          </p>
          <h2 className="mt-1 text-[16px] font-semibold tracking-tight">
            {mode === "login" ? "Sign in without losing this conversation" : "Create your Kurukoo identity"}
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            You can keep using Kurukoo as a guest. Identity is only needed when an action requires
            your account.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss identity card"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated hover:text-foreground"
        >
          ×
        </button>
      </div>
      <AuthFlow mode={mode} compact />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
        <button
          type="button"
          onClick={() => setMode((value) => (value === "login" ? "signup" : "login"))}
          className="font-medium text-primary underline underline-offset-2"
        >
          {mode === "login" ? "Create an account instead" : "Sign in instead"}
        </button>
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          Keep going as a guest
        </button>
      </div>
    </section>
  );
}
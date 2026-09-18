import { Mail, Phone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Panel } from "@/components/kurukoo/ui";
import { KURUKOO_BUILD_EMAIL, requestMagicLink, requestPhoneOtp, verifyPhoneOtp } from "@/lib/kurukoo-auth";

export type AuthMode = "login" | "signup";
type AuthFlowProps = { mode: AuthMode; compact?: boolean; onClose?: () => void };
type AuthStep = "identifier" | "code";
type SignInMethod = "email" | "phone";

function AuthFlow({ mode, compact = false, onClose }: AuthFlowProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<SignInMethod>("email");
  const [step, setStep] = useState<AuthStep>("identifier");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStep("identifier");
    setEmail("");
    setPhone("");
    setCode("");
    setMethod("email");
    setMessage(null);
  }, [mode]);

  async function signInWithEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setMessage("Enter your email address.");
    if (normalizedEmail !== KURUKOO_BUILD_EMAIL) return setMessage(`This build is currently available only to ${KURUKOO_BUILD_EMAIL}.`);
    setBusy(true);
    setMessage(null);
    try {
      // requestMagicLink is deliberately a frontend access-gate action here:
      // it validates the permitted account and opens the authenticated shell
      // without requiring an actual email delivery service.
      await requestMagicLink({ email: normalizedEmail, name: name || undefined });
      onClose?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) return setMessage("Enter your phone number.");
    setBusy(true);
    setMessage(null);
    try {
      await requestPhoneOtp(normalizedPhone);
      setStep("code");
      setMessage("Verification code sent to your phone.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not send a verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();
    if (!normalizedCode) return setMessage("Enter the verification code.");
    setBusy(true);
    setMessage(null);
    try {
      await verifyPhoneOtp({ phone: normalizedPhone, code: normalizedCode, name: name || undefined, email: KURUKOO_BUILD_EMAIL });
      window.localStorage.setItem("kurukoo-authenticated", "true");
      window.dispatchEvent(new Event("kurukoo-auth-updated"));
      onClose?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not verify your phone.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Kurukoo access</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.025em]">{mode === "login" ? "Welcome back" : "Join Kurukoo"}</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Sign in with email or phone to access Kurukoo.</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated"><X className="size-[18px]" /></button> : null}
      </div>

      {step === "identifier" ? <>
        <div className="grid grid-cols-2 rounded-xl bg-elevated p-1" role="tablist" aria-label="Sign-in method">
          <button type="button" role="tab" aria-selected={method === "email"} onClick={() => { setMethod("email"); setMessage(null); }} className={`rounded-lg px-3 py-2 text-[11.5px] font-medium ${method === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Mail className="mr-1.5 inline size-3.5" />Email</button>
          <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => { setMethod("phone"); setMessage(null); }} className={`rounded-lg px-3 py-2 text-[11.5px] font-medium ${method === "phone" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Phone className="mr-1.5 inline size-3.5" />Phone</button>
        </div>

        {mode === "signup" ? <label className="block text-[11px] font-medium">Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label> : null}

        {method === "email" ? <>
          <label className="block text-[11px] font-medium">Email address<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div></label>
          <button type="button" disabled={busy} onClick={() => void signInWithEmail()} className="min-h-11 w-full rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Signing in…" : mode === "login" ? "Log in" : "Create account"}</button>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">For this build, the permitted email opens access directly without email delivery.</p>
        </> : <>
          <label className="block text-[11px] font-medium">Phone number<div className="relative mt-1.5"><Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Your phone number" className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div></label>
          <button type="button" disabled={busy} onClick={() => void sendCode()} className="min-h-11 w-full rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Send verification code"}</button>
        </>}
      </> : null}

      {step === "code" ? <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-[13px] font-medium">Check your phone</p><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">Enter the verification code sent to {phone}.</p></div>
        <label className="block text-[11px] font-medium">Verification code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={12} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-center text-[18px] tracking-[0.25em] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        <button type="button" disabled={busy} onClick={() => void verifyCode()} className="min-h-11 w-full rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Checking…" : mode === "login" ? "Log in" : "Create account"}</button>
        <button type="button" disabled={busy} onClick={() => { setStep("identifier"); setCode(""); setMessage(null); }} className="w-full text-[11px] font-medium text-muted-foreground underline underline-offset-2">Use a different phone number</button>
      </div> : null}

      {message ? <p role="status" className="rounded-xl bg-elevated px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">{message}</p> : null}
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">By continuing, you agree to Kurukoo’s terms and privacy policy.</p>
    </div>
  );
}

export function AuthModal({ mode, onClose, onModeChange }: { mode: AuthMode; onClose: () => void; onModeChange?: (mode: AuthMode) => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[3px]" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="relative max-h-[min(760px,calc(100vh-32px))] w-full max-w-[430px] overflow-y-auto rounded-[24px] bg-background p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-8"><AuthFlow mode={mode} onClose={onClose} /><div className="mt-5 border-t border-border pt-5 text-center text-[12px] text-muted-foreground">{mode === "login" ? <>New here? <button type="button" onClick={() => onModeChange?.("signup")} className="font-medium text-foreground underline underline-offset-2">Create an account</button></> : <>Already have an account? <button type="button" onClick={() => onModeChange?.("login")} className="font-medium text-foreground underline underline-offset-2">Log in</button></>}</div></div></div>;
}

export function AuthPanel({ title, subtitle, cta, footer, showName = false }: { title: string; subtitle: string; cta: string; footer: ReactNode; showName?: boolean }) {
  return <div className="mx-auto max-w-md py-6"><h1 className="font-serif text-[38px] leading-[1.02] tracking-[-0.045em]">{title}</h1><p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p><Panel className="mt-6 p-5"><AuthFlow mode={showName ? "signup" : "login"} /></Panel><p className="mt-4 text-[13px] text-muted-foreground">{footer}</p><p className="mt-2 text-[11.5px] text-muted-foreground">Your authenticated session is held by Kurukoo’s secure server cookie, not by the browser UI.</p></div>;
}

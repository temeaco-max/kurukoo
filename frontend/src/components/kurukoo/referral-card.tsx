import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Gift, X } from "lucide-react";

const REFERRAL_IMAGE =
  "https://lovable.dev/cdn-cgi/image/width=1716,f=auto,fit=scale-down/img/referral/light-spread-v3.png";
const REFERRAL_POINTS = 100;
const REFEREE_POINTS = 10;
function buildInviteLink() {
  if (typeof window === "undefined") return "https://kurukoo.com/signup?ref=kurukoo";
  const existing = localStorage.getItem("kurukoo-referral-code")?.trim();
  const code = existing || "KURUKOO";
  if (!existing) localStorage.setItem("kurukoo-referral-code", code);
  return `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`;
}
export function ReferralDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = useMemo(buildInviteLink, []);
  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(inviteLink)}`,
    [inviteLink],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kurukoo-referral-title"
        className="relative my-auto max-h-[calc(100vh-32px)] w-full max-w-[720px] overflow-y-auto rounded-3xl border border-border bg-surface shadow-[var(--shadow-lift)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close referral dialog"
          className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-border bg-surface/95 text-muted-foreground hover:bg-elevated hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="grid min-w-0 md:grid-cols-[0.85fr_1.15fr]">
          <div className="min-w-0 overflow-hidden bg-brand-tint/35 p-5 md:p-6">
            <img
              src={REFERRAL_IMAGE}
              alt=""
              loading="lazy"
              className="h-44 w-full rounded-2xl object-cover md:h-full md:min-h-[390px]"
            />
          </div>
          <div className="min-w-0 p-6 pr-16 md:p-7 md:pr-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Referral rewards
            </p>
            <h2
              id="kurukoo-referral-title"
              className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em]"
            >
              Earn {REFERRAL_POINTS} points
            </h2>
            <p className="mt-1 text-[20px] font-medium tracking-[-0.02em]">Share Kurukoo</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Earn points when your referral becomes a qualifying member.
            </p>
            <div className="mt-6">
              <p className="text-[12px] font-semibold">How it works</p>
              <ol className="mt-2 space-y-2 text-[12px] leading-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> Share your invite link
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span> They sign up and get{" "}
                  <strong className="text-foreground">{REFEREE_POINTS} points</strong>
                </li>
                <li>
                  <span className="font-medium text-foreground">3.</span> You get{" "}
                  <strong className="text-foreground">{REFERRAL_POINTS} points</strong> when they
                  meet the qualifying referral condition
                </li>
              </ol>
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-elevated/45 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Signed up</span>
                <strong>0</strong>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Converted</span>
                <strong>0</strong>
              </div>
            </div>
            <div className="mt-5 grid min-w-0 grid-cols-[94px_minmax(0,1fr)] items-start gap-3">
              <div className="grid size-[94px] shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
                <img src={qrUrl} alt="Your Kurukoo invite QR code" width="88" height="88" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground">Your invite link</p>
                <p className="mt-1 break-all rounded-lg border border-border bg-background px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
                  {inviteLink}
                </p>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-medium text-background"
                >
                  <Copy className="size-3.5" />
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
            <p className="mt-5 text-[9.5px] leading-4 text-muted-foreground">
              Referral points are subject to Kurukoo referral terms and qualifying conditions.
              Reward tracking uses the invite link attached to your account.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
export function ReferralCard({
  collapsed = false,
  variant = "authenticated",
  onPublicAuth,
}: {
  collapsed?: boolean;
  variant?: "authenticated" | "public";
  onPublicAuth?: () => void;
}) {
  const publicVariant = variant === "public";
  const [open, setOpen] = useState(false);
  const handleClick = () => {
    if (publicVariant) onPublicAuth?.();
    else setOpen(true);
  };
  const pill = (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share Kurukoo"
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated/60 px-3 py-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-elevated"
    >
      <span>Share Kurukoo</span>
      <Gift className="size-3.5" />
    </button>
  );
  const compact = (
    <div className="group relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Share Kurukoo"
        title="Share Kurukoo"
        className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-2 py-2 text-muted-foreground hover:bg-elevated"
      >
        <Gift className="size-[17px]" strokeWidth={1.8} />
        <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[90] -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-2 text-[11px] font-medium text-foreground opacity-0 shadow-[var(--shadow-soft)] transition-opacity group-hover:opacity-100">
          Share Kurukoo
        </span>
      </button>
    </div>
  );
  return (
    <>
      {collapsed ? compact : pill}
      {open ? <ReferralDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

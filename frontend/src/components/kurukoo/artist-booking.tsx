import { BriefcaseBusiness, Loader2, Check, Shield, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { Panel, Rows } from "@/components/kurukoo/ui";
import { requestArtistVerification, isKurukooApiConfigured } from "@/lib/kurukoo-api";
import { cn } from "@/lib/utils";

export function ArtistBookingCard() {
  const [step, setStep] = useState<"select" | "details" | "done">("select");
  const [skill, setSkill] = useState("dj");
  const [managerName, setManagerName] = useState("");
  const [managerContact, setManagerContact] = useState("");
  const [contactType, setContactType] = useState<"phone" | "email">("phone");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestVerification() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestArtistVerification(skill, managerName, managerContact);
      if (!result.success) {
        setError(result.message || "Verification request could not be submitted.");
        return;
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isKurukooApiConfigured()) return null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-primary" />
          <span className="text-[12.5px] font-medium">Artist booking</span>
          <Shield className="size-3.5 text-muted-foreground" title="Verified artist bookings with escrow protection" />
        </div>
      </div>
      {step === "select" ? (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-muted-foreground">Start by telling Kurukoo what kind of performer you need.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SKILL_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => { setSkill(option.value); setStep("details"); }} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-[12.5px] text-foreground hover:border-primary/30 hover:bg-elevated">
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === "details" ? (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-muted-foreground">Give Kurukoo the booking manager details so the artist can be verified.</p>
          <div className="mt-3 space-y-3">
            <div><label className="text-[11.5px] font-medium text-muted-foreground">Artist / skill</label><p className="mt-0.5 text-[12.5px] font-medium">{SKILL_OPTIONS.find((o) => o.value === skill)?.label}</p></div>
            <div><label className="text-[11.5px] font-medium text-muted-foreground">Manager / contact name</label><input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Full name of the booking manager" className="mt-0.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground" /></div>
            <div><label className="text-[11.5px] font-medium text-muted-foreground">Manager contact <span className="ml-1 text-[9.5px] text-muted-foreground">{contactType === "phone" ? "Phone" : "Email"}</span></label><div className="mt-0.5 flex gap-2"><div className="flex overflow-hidden rounded-lg border border-border bg-surface"><button type="button" onClick={() => setContactType("phone")} className={cn("px-2.5 py-1 text-[10px] font-medium", contactType === "phone" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}><Phone className="mr-1 inline size-3"/>Phone</button><button type="button" onClick={() => setContactType("email")} className={cn("px-2.5 py-1 text-[10px] font-medium", contactType === "email" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}><Mail className="mr-1 inline size-3"/>Email</button></div><input type={contactType === "phone" ? "tel" : "email"} value={managerContact} onChange={(e) => setManagerContact(e.target.value)} placeholder={contactType === "phone" ? "+234 801 234 5678" : "manager@example.com"} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground" /></div></div>
            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </div>
          <div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => setStep("select")} className="text-[11.5px] text-muted-foreground hover:text-foreground">Back</button><div className="flex-1"/><button type="button" onClick={() => void handleRequestVerification()} disabled={!managerName.trim() || !managerContact.trim() || submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11.5px] text-primary-foreground hover:opacity-90 disabled:opacity-40">{submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5"/>}{submitting ? "Submitting…" : "Request verification"}</button></div>
        </div>
      ) : null}
      {step === "done" ? (
        <div className="px-4 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"><Check className="mt-0.5 size-5 shrink-0 text-[var(--color-success)]"/><div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium">Verification request submitted</p><p className="mt-1 text-[11.5px] text-muted-foreground">Kurukoo has received the request for <span className="font-medium text-foreground">{SKILL_OPTIONS.find((o) => o.value === skill)?.label}</span> and will verify the booking manager details.</p><Rows><li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Booking manager</span><span className="text-[12px]">{managerName}</span></li><li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Contact</span><span className="max-w-[160px] truncate text-[12px]">{managerContact}</span></li><li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Status</span><span className="text-[12px] text-accent">Pending verification</span></li></Rows></div></div>
          <div className="mt-3 flex justify-end"><button type="button" onClick={() => { setStep("select"); setSkill("dj"); setManagerName(""); setManagerContact(""); setError(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground hover:bg-elevated">Request another</button></div>
        </div>
      ) : null}
    </Panel>
  );
}

const SKILL_OPTIONS = [
  { value: "dj", label: "DJ / Music" }, { value: "mc", label: "MC / Host" }, { value: "photographer", label: "Photographer" }, { value: "videographer", label: "Videographer" }, { value: "makeup_artist", label: "Makeup Artist" }, { value: "hairdresser", label: "Hairdresser" }, { value: "caterer", label: "Caterer" }, { value: "decorator", label: "Event Decorator" }, { value: "comedian", label: "Comedian" }, { value: "band", label: "Live Band" }, { value: "security", label: "Security Personnel" }, { value: "other", label: "Other artist" },
];

import { BriefcaseBusiness, Loader2, Check, Shield, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { Panel, Rows } from "@/components/kurukoo/ui";
import { requestArtistVerification, type ArtistBooking } from "@/lib/kurukoo-api";
import { isKurukooApiConfigured } from "@/lib/kurukoo-api";
import { cn } from "@/lib/utils";

export function ArtistBookingCard() {
  const [step, setStep] = useState<"select" | "details" | "submitting" | "done">("select");
  const [skill, setSkill] = useState("dj");
  const [managerName, setManagerName] = useState("");
  const [managerContact, setManagerContact] = useState("");
  const [contactType, setContactType] = useState<"phone" | "email">("phone");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<ArtistBooking | null>(null);

  async function handleRequestVerification() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestArtistVerification(skill, managerName, managerContact);
      if (result.success) {
        setBooking({
          id: "new-" + Date.now(),
          skill,
          providerPhone: "",
          providerName: "",
          managerName,
          managerContact,
          status: "pending_verification",
          verification: { managerName, managerContact },
        });
        setStep("done");
      } else {
        setError(result.message || "Verification request could not be submitted.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isKurukooApiConfigured()) return null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-primary" />
          <span className="text-[12.5px] font-medium">Artist booking</span>
          <Shield className="size-3.5 text-muted-foreground" title="Verified artist bookings with escrow protection" />
        </div>
      </div>
      {step === "select" && (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-muted-foreground">Request verification for a verified artist or performer. Escrow is held until the booking is confirmed.</p>
          <div className="mt-3">
            <label className="text-[11.5px] font-medium text-muted-foreground">What kind of artist do you need?</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SKILL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setSkill(option.value); setStep("details"); }}
                  className={option.value === skill
                    ? "rounded-xl border border-primary bg-brand-tint/15 px-3 py-2.5 text-left text-[12.5px] font-medium text-primary"
                    : "rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-[12.5px] text-foreground hover:border-primary/30 hover:bg-elevated"}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {step === "details" && (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-muted-foreground">Tell us who will manage this booking so we can verify the artist.</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground">Artist / skill</label>
              <p className="mt-0.5 text-[12.5px] font-medium">{SKILL_OPTIONS.find((o) => o.value === skill)?.label}</p>
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground">Manager / contact name</label>
              <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Full name of the booking manager" className="mt-0.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground">Manager contact <span className="ml-1 text-[9.5px] text-muted-foreground">{contactType === "phone" ? "Phone" : "Email"}</span></label>
              <div className="mt-0.5 flex gap-2">
                <div className="flex rounded-lg border border-border bg-surface overflow-hidden">
                  <button type="button" onClick={() => setContactType("phone")} className={cn("px-2.5 py-1 text-[10px] font-medium", contactType === "phone" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}>Phone</button>
                  <button type="button" onClick={() => setContactType("email")} className={cn("px-2.5 py-1 text-[10px] font-medium", contactType === "email" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}>Email</button>
                </div>
                <input type={contactType === "phone" ? "tel" : "email"} value={managerContact} onChange={(e) => setManagerContact(e.target.value)} placeholder={contactType === "phone" ? "+234 801 234 5678" : "manager@example.com"} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground" />
              </div>
            </div>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => setStep("select")} className="text-[11.5px] text-muted-foreground hover:text-foreground">Back</button>
            <div className="flex-1" />
            <button type="button" onClick={handleRequestVerification} disabled={!managerName.trim() || !managerContact.trim() || submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11.5px] text-primary-foreground hover:opacity-90 disabled:opacity-40">
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
              Request verification
            </button>
          </div>
        </div>
      )}
      {step === "done" && booking && (
        <div className="px-4 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
            <Check className="mt-0.5 size-5 text-[var(--color-success)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">Verification request submitted</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">Kurukoo will verify <span className="font-medium text-foreground">{booking.managerName}</span> as the booking manager.</p>
              <Rows>
                <li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Skill</span><span className="text-[12px]">{SKILL_OPTIONS.find((o) => o.value === booking.skill)?.label}</span></li>
                <li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Booking manager</span><span className="text-[12px]">{booking.managerName}</span></li>
                <li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Contact</span><span className="text-[12px] truncate max-w-[160px]">{booking.contactType === "phone" ? <span className="inline-flex items-center gap-1"><Phone className="size-3 text-muted-foreground" />{booking.managerContact}</span> : <span className="inline-flex items-center gap-1"><Mail className="size-3 text-muted-foreground" />{booking.managerContact}</span>}</span></li>
                <li className="flex items-center justify-between gap-4 px-4 py-2 text-left"><span className="text-[10.5px] text-muted-foreground">Status</span><span className={cn("text-[12px]", booking.status.includes("pending") ? "text-accent" : "text-muted-foreground")}>{booking.status.replace(/_/g, " ")}</span></li>
              </Rows>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => { setStep("select"); setSkill("dj"); setManagerName(""); setManagerContact(""); setBooking(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground hover:bg-elevated">Book another artist</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

const SKILL_OPTIONS = [
  { value: "dj", label: "DJ / Music" },
  { value: "mc", label: "MC / Host" },
  { value: "photographer", label: "Photographer" },
  { value: "videographer", label: "Videographer" },
  { value: "makeup_artist", label: "Makeup Artist" },
  { value: "hairdresser", label: "Hairdresser" },
  { value: "caterer", label: "Caterer" },
  { value: "decorator", label: "Event Decorator" },
  { value: "comedian", label: "Comedian" },
  { value: "band", label: "Live Band" },
  { value: "security", label: "Security Personnel" },
  { value: "other", label: "Other artist" },
];
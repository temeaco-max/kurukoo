import { Check, Download, ShieldCheck, Sparkles, UserRound, Waves } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel, Rows, SettingsRow, Tabs } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Kurukoo" },
      { name: "description", content: "Control how Kurukoo behaves, remembers, communicates and works for you." },
      { property: "og:title", content: "Settings — Kurukoo" },
      { property: "og:description", content: "Your personal controls for Kurukoo." },
    ],
  }),
  component: SettingsPage,
});

const tabs = ["Account", "Privacy", "Notifications", "Services", "Voice", "Money", "Appearance"] as const;

function SettingIntro({ icon: Icon, eyebrow, title, description }: { icon: typeof UserRound; eyebrow: string; title: string; description: string }) {
  return (
    <Panel className="mb-4 overflow-hidden p-0">
      <div className="flex items-start gap-4 p-5 md:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-elevated text-muted-foreground"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </Panel>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`);
  return payload as T;
}

function ProfileEditor() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<{ profile?: { name?: string | null; location?: string | null; email?: string | null } }>("/api/profile")
      .then(({ profile }) => { setName(profile?.name ?? ""); setLocation(profile?.location ?? ""); setEmail(profile?.email ?? ""); })
      .catch(() => setMessage("Sign in to edit your account profile."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setMessage("");
    try {
      await api("/api/profile/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, location }) });
      localStorage.setItem("kurukoo-profile-name", name.trim());
      window.dispatchEvent(new Event("kurukoo-profile-updated"));
      setMessage("Saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save profile."); }
    finally { setSaving(false); }
  }

  if (loading) return <span className="text-[12px] text-muted-foreground">Loading…</span>;
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Profile name" placeholder="Your name" className="h-9 w-32 rounded-lg border border-border bg-background px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location" placeholder="Location" className="h-9 w-32 rounded-lg border border-border bg-background px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button type="button" onClick={() => void save()} disabled={saving} className="h-9 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>
      <span className="text-[11px] text-muted-foreground">{message || email || "Account profile"}</span>
    </div>
  );
}

function PersistentToggle({ storageKey, label, defaultOn = false }: { storageKey: string; label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  useEffect(() => { const value = localStorage.getItem(storageKey); if (value !== null) setOn(value === "true"); }, [storageKey]);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => { const next = !on; setOn(next); localStorage.setItem(storageKey, String(next)); }}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "border border-border bg-elevated"}`}
    >
      <span className={`absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-surface shadow-[var(--shadow-soft)] transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

function DataExport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function exportData() {
    setBusy(true); setMessage("");
    try {
      const payload = await api<{ data?: unknown }>("/api/user/export");
      const blob = new Blob([JSON.stringify(payload.data ?? payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `kurukoo-data-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setMessage("Downloaded");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to export data."); }
    finally { setBusy(false); }
  }
  return <div className="flex items-center gap-2"><button type="button" onClick={() => void exportData()} disabled={busy} className={actionClass()}><Download className="mr-1.5 inline size-3.5" />{busy ? "Preparing…" : "Download"}</button>{message && <span className="text-[11px] text-muted-foreground">{message}</span>}</div>;
}

function SettingsPage() {
  const [tab, setTab] = useState<string>(tabs[0]);
  return (
    <>
      <PageHeader title="Settings" subtitle="Control how Kurukoo behaves, remembers, communicates and works for you." />
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Account" && <><SettingIntro icon={UserRound} eyebrow="Your identity" title="Make Kurukoo feel like yours" description="Your account profile is stored with Kurukoo and used to personalise your experience." /><Rows>
          <SettingsRow title="Profile" description="Name and location" control={<ProfileEditor />} />
          <SettingsRow title="Email and phone" description="Account contact details" control={<Link to="/trust" className={actionClass()}>Security</Link>} />
          <SettingsRow title="Security" description="Credentials, sessions and trusted execution" control={<Link to="/trust" className={actionClass()}>Manage</Link>} />
          <SettingsRow title="Language" description="English (UK)" control={<span className="text-[12px] text-muted-foreground">English (UK)</span>} />
          <SettingsRow title="Memory" description="What Kurukoo remembers about you" control={<Link to="/memory" className={actionClass()}>Open</Link>} />
        </Rows></>}
        {tab === "Privacy" && <><SettingIntro icon={ShieldCheck} eyebrow="Your control" title="Control what Kurukoo may use" description="These preferences take effect in this browser. Consequential actions still use Kurukoo's approval and trust controls." /><Rows>
          <SettingsRow title="Ask before contacting anyone" description="Require approval before outbound contact" control={<PersistentToggle storageKey="kurukoo-ask-before-contact" label="Ask before contacting" defaultOn />} />
          <SettingsRow title="Share location for discovery" description="Allow nearby recommendations to use your location" control={<PersistentToggle storageKey="kurukoo-share-location" label="Share location" />} />
          <SettingsRow title="Personalised recommendations" description="Use activity and interests to improve suggestions" control={<PersistentToggle storageKey="kurukoo-personalised" label="Personalised recommendations" defaultOn />} />
          <SettingsRow title="Download your data" description="Export your account data as JSON" control={<DataExport />} />
        </Rows></>}
        {tab === "Notifications" && <><SettingIntro icon={Sparkles} eyebrow="Stay informed" title="Only hear when it matters" description="Keep approvals, replies and important activity close without turning Kurukoo into a noisy feed." /><Rows>
          <SettingsRow title="Approvals" description="When Kurukoo needs a decision" control={<PersistentToggle storageKey="kurukoo-notifications-approvals" label="Approvals" defaultOn />} />
          <SettingsRow title="Network replies" description="When someone responds to a request" control={<PersistentToggle storageKey="kurukoo-notifications-replies" label="Network replies" defaultOn />} />
          <SettingsRow title="Followed topics and people" description="Updates from things you follow" control={<PersistentToggle storageKey="kurukoo-notifications-following" label="Following activity" />} />
          <SettingsRow title="Product updates" description="New Kurukoo features and improvements" control={<PersistentToggle storageKey="kurukoo-notifications-product" label="Product updates" />} />
        </Rows></>}
        {tab === "Services" && <><SettingIntro icon={Check} eyebrow="Connected services" title="Choose what Kurukoo can work with" description="Manage live service connections and resources from Connect." /><Rows>
          <SettingsRow title="Connected services" description="Storage, messaging, email, calendar and other resources" control={<Link to="/connect" className={actionClass()}>Open Connect</Link>} />
          <SettingsRow title="Outcomes and files" description="Connected resources and completed outputs" control={<Link to="/artifacts" className={actionClass()}>Open Artifacts</Link>} />
        </Rows></>}
        {tab === "Voice" && <><SettingIntro icon={Waves} eyebrow="Croon voice" title="Talk to Kurukoo naturally" description="Use voice as another way to tell Kurukoo what needs doing. Voice features fail clearly when the configured provider or browser capability is unavailable." /><Rows>
          <SettingsRow title="Voice input" description="Use voice in conversations" control={<PersistentToggle storageKey="kurukoo-voice-input" label="Voice input" defaultOn />} />
          <SettingsRow title="Read replies aloud" description="Browser speech output" control={<PersistentToggle storageKey="kurukoo-voice-output" label="Read replies aloud" />} />
          <SettingsRow title="Hey Kurukoo wake phrase" description="Listen for the phrase inside the open Croon voice screen" control={<PersistentToggle storageKey="kurukoo-voice-wake" label="Hey Kurukoo wake phrase" />} />
          <SettingsRow title="Voice preferences" description="Language and voice style are managed when you open Croon voice mode" control={<Link to="/chat" className={actionClass()}>Open Croon</Link>} />
          <SettingsRow title="Calls" description="Voice sessions connected to requests" control={<Link to="/calls" className={actionClass()}>Open Calls</Link>} />
        </Rows></>}
        {tab === "Money" && <><SettingIntro icon={ShieldCheck} eyebrow="Money" title="Keep payments under your control" description="Payment instruments and secure execution controls live in Trust." /><Rows>
          <SettingsRow title="Wallet and points" description="Balance and contribution value" control={<Link to="/wallet" className={actionClass()}>Open Wallet</Link>} />
          <SettingsRow title="Subscription" description="Plan and billing" control={<Link to="/subscriptions" className={actionClass()}>Manage</Link>} />
          <SettingsRow title="Payment methods" description="Protected payment instruments" control={<Link to="/trust" className={actionClass()}>Manage in Trust</Link>} />
          <SettingsRow title="Network, business and creator accounts" description="Account types connected to Kurukoo" control={<Link to="/network" className={actionClass()}>Open</Link>} />
        </Rows></>}
        {tab === "Appearance" && <><SettingIntro icon={Sparkles} eyebrow="Appearance" title="Make Kurukoo comfortable everywhere" description="The shell follows your system appearance and keeps the same Kurukoo visual language across surfaces." /><Rows>
          <SettingsRow title="Theme" description="Use the appearance control in the shell" control={<span className="text-[12px] text-muted-foreground">System / Light / Dark</span>} />
          <SettingsRow title="Reduce motion" description="Follows your system setting" control={<span className="text-[12px] text-muted-foreground">System</span>} />
          <SettingsRow title="Text size" description="Follows your browser setting" control={<span className="text-[12px] text-muted-foreground">Default</span>} />
        </Rows></>}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-[12px] text-muted-foreground"><span>Account controls are connected to Kurukoo services where available.</span><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--color-success)]" /> Ready</span></div>
    </>
  );
}
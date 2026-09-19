import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  LockKeyhole,
  Monitor,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Snowflake,
  Square,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app-shell";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";
import { encryptSecret } from "@/lib/crypto-client";
import {
  cancelCard,
  createCard,
  createExecutionSession,
  deleteCredential,
  describeError,
  exportTrustAudit,
  fetchExecutionActions,
  fetchTrustOverview,
  freezeCard,
  queueExecutionAction,
  stopExecutionSession,
  storeCredential,
  type ActionType,
  type AuditEntry,
  type Credential,
  type CredentialType,
  type ExecutionAction,
  type ExecutionSession,
  type PurchaseProtection,
  type TrustResourceState,
  type VirtualCard,
} from "@/lib/trust-api";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust — Kurukoo" },
      {
        name: "description",
        content:
          "Control credentials, protected payments, secure execution and your execution audit.",
      },
    ],
  }),
  component: TrustPage,
});

const credentialTypeLabel: Record<string, string> = {
  password: "Password",
  api_key: "API key",
  token: "Token",
  note: "Secure note",
  other: "Other",
};
const kindLabel: Record<string, string> = {
  intent: "Intent",
  request: "Request",
  goal: "Goal",
  action: "Action",
  outcome: "Outcome",
  evidence: "Evidence",
};
function kindIcon(kind: string) {
  switch (kind) {
    case "intent":
      return <Zap className="size-4 text-primary" />;
    case "request":
      return <Target className="size-4 text-accent" />;
    case "goal":
      return <Shield className="size-4 text-primary" />;
    case "outcome":
      return <CheckCircle2 className="size-4 text-[var(--color-success)]" />;
    default:
      return <FileText className="size-4 text-muted-foreground" />;
  }
}
function formatMinor(minor: number, currency: string) {
  const symbol =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}
function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
function statusTone(status: string) {
  if (["active", "ready", "completed", "approved", "available", "success"].includes(status))
    return "bg-[var(--color-success)]/15 text-[var(--color-success)]";
  if (
    ["frozen", "claimed", "queued", "running", "busy", "starting", "pending", "used"].includes(
      status,
    )
  )
    return "bg-accent/15 text-accent";
  if (["failed", "error", "denied", "provider_required", "cancelled", "expired"].includes(status))
    return "bg-destructive/15 text-destructive";
  return "bg-elevated text-muted-foreground";
}
function pretty(value: string) {
  return value.replace(/[_-]/g, " ");
}
function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-elevated" />
      ))}
    </div>
  );
}
function EmptyNote({ children }: { children: string }) {
  return (
    <div className="px-5 py-10 text-center text-[11.5px] text-muted-foreground">{children}</div>
  );
}

/** Honest rendering of a capability the backend refused or could not read. Nothing is simulated. */
function AvailabilityNote({
  label,
  state,
}: {
  label: string;
  state?: TrustResourceState | undefined;
}) {
  if (!state || state.state === "available") return null;
  if (state.state === "unavailable")
    return (
      <div className="px-5 py-10 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {label} is not enabled for this account or market yet, so nothing is shown as if it worked.
        {state.message ? ` ${state.message}` : ""}
      </div>
    );
  return (
    <div
      role="alert"
      className="flex items-start gap-2 px-5 py-10 text-[11.5px] leading-relaxed text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{state.message || `${label} could not be read from Kurukoo right now.`}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">{title}</h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
type TrustSnapshot = {
  credentials: Credential[];
  cards: VirtualCard[];
  sessions: ExecutionSession[];
  claims: PurchaseProtection[];
  audit: AuditEntry[];
  auditTotal: number;
  availability: Record<string, TrustResourceState>;
};

function TrustPage() {
  const [data, setData] = useState<TrustSnapshot>({
    credentials: [],
    cards: [],
    sessions: [],
    claims: [],
    audit: [],
    auditTotal: 0,
    availability: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const overview = await fetchTrustOverview();
      setData({
        credentials: overview.credentials.credentials,
        cards: overview.cards.cards,
        sessions: overview.sessions.sessions,
        claims: overview.protections.claims,
        audit: overview.audit.entries,
        auditTotal: overview.audit.total,
        availability: overview.availability as unknown as Record<string, TrustResourceState>,
      });
    } catch (cause) {
      setError(describeError(cause, "Trust controls could not be loaded."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, work: () => Promise<unknown>, success: string) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await work();
      await load(false);
      setNotice(success);
      return true;
    } catch (cause) {
      setError(describeError(cause, "The action could not be completed."));
      return false;
    } finally {
      setBusy(null);
    }
  }

  function storeNewCredential(input: {
    label: string;
    domain?: string;
    credentialType: CredentialType;
    ciphertext: string;
    iv: string;
    salt: string;
  }) {
    const payload: {
      label: string;
      ciphertext: string;
      iv: string;
      salt: string;
      domain?: string;
      credentialType?: CredentialType;
    } = { label: input.label, ciphertext: input.ciphertext, iv: input.iv, salt: input.salt };
    if (input.domain) payload.domain = input.domain;
    payload.credentialType = input.credentialType;
    return act(
      "credential:create",
      () => storeCredential(payload),
      "Credential encrypted in your browser and stored as ciphertext.",
    );
  }

  async function exportAudit() {
    setBusy("audit:export");
    setError("");
    try {
      const blob = await exportTrustAudit();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kurukoo-audit-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Audit export downloaded from Kurukoo.");
    } catch (cause) {
      setError(describeError(cause, "Audit export is not available."));
    } finally {
      setBusy(null);
    }
  }

  const states = Object.values(data.availability);
  const enabled = states.filter((state) => state.state === "available").length;
  const unavailable = states.filter((state) => state.state === "unavailable").length;
  const errored = states.filter((state) => state.state === "error").length;
  const activeSessions = data.sessions.filter((session) =>
    ["ready", "busy", "starting", "pending"].includes(session.status),
  ).length;
  const controls = !states.length
    ? {
        dot: "bg-muted-foreground",
        headline: loading
          ? "Checking your account controls…"
          : "Account controls are not readable yet",
        detail: "Availability depends on the connected service and your market.",
      }
    : errored
      ? {
          dot: "bg-destructive",
          headline: "Some account controls could not be checked",
          detail:
            `${errored} of ${states.length} capabilities could not be read from Kurukoo. ${enabled ? `${enabled} are available.` : ""}`.trim(),
        }
      : enabled === states.length
        ? {
            dot: "bg-[var(--color-success)]",
            headline: "Your account controls are active",
            detail: `All ${states.length} capabilities are enabled for this account.`,
          }
        : enabled > 0
          ? {
              dot: "bg-accent",
              headline: "Only some account controls are active",
              detail: `${enabled} of ${states.length} capabilities are enabled for this account; ${unavailable} are not enabled here yet.`,
            }
          : {
              dot: "bg-accent",
              headline: "No account controls are enabled for this account yet",
              detail: `All ${states.length} capabilities are feature-gated for this account or market, so Kurukoo shows their real state instead of a placeholder.`,
            };
  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Trust"
        subtitle="The controls around what Kurukoo may use, spend and do on your behalf. Important actions stay bounded, reviewable and reversible where the underlying service supports it."
      />

      <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium" role="status">
          <span aria-hidden="true" className={`size-2 rounded-full ${controls.dot}`} />{" "}
          {controls.headline}
        </span>
        <span className="text-[10.5px] text-muted-foreground">{controls.detail}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className={`${actionClass()} ml-auto`}
        >
          <RefreshCw className="size-3.5" />
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11.5px] text-destructive"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-3 text-[11.5px]"
        >
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Panel className="p-5">
          <KeyRound className="size-5 text-primary" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Credentials
          </p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : data.credentials.length}</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Encrypted before they leave your browser
          </p>
        </Panel>
        <Panel className="p-5">
          <CreditCard className="size-5 text-primary" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Protected payments
          </p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : data.cards.length}</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            {data.claims.length} protection {data.claims.length === 1 ? "claim" : "claims"} on
            record
          </p>
        </Panel>
        <Panel className="p-5">
          <LockKeyhole className="size-5 text-primary" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Secure execution
          </p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : activeSessions}</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            {data.sessions.length} session{data.sessions.length === 1 ? "" : "s"} recorded
          </p>
        </Panel>
      </section>

      <CredentialsSection
        credentials={data.credentials}
        state={data.availability["credentials"]}
        loading={loading}
        busy={busy}
        onCreate={storeNewCredential}
        onDelete={(id, label) => {
          if (window.confirm(`Delete ${label}?`))
            void act(`${id}:delete`, () => deleteCredential(id), "Credential deleted.");
        }}
      />

      <CardsSection
        cards={data.cards}
        claims={data.claims}
        cardsState={data.availability["cards"]}
        claimsState={data.availability["protections"]}
        loading={loading}
        busy={busy}
        onCreate={(input) =>
          void act(
            "card:create",
            async () => {
              const result = await createCard(input);
              if (!result.card)
                throw new Error("Kurukoo did not return an issued card, so none is shown.");
            },
            "Card created. Its status is whatever the card provider reports.",
          )
        }
        onFreeze={(id) => void act(`${id}:freeze`, () => freezeCard(id), "Card frozen.")}
        onCancel={(id) => void act(`${id}:cancel`, () => cancelCard(id), "Card cancelled.")}
      />

      <SessionsSection
        sessions={data.sessions}
        state={data.availability["sessions"]}
        loading={loading}
        busy={busy}
        newSessionId={newSessionId}
        onCreate={() =>
          void act(
            "session:create",
            async () => {
              const session = await createExecutionSession({ ttlMinutes: 30 });
              setNewSessionId(session.id);
            },
            "Secure session requested from the execution provider.",
          )
        }
        onQueue={(sessionId, type) =>
          void act(
            `${sessionId}:${type}`,
            () => queueExecutionAction(sessionId, type),
            `Action queued: ${pretty(type)}.`,
          )
        }
        onStop={(id) => void act(`${id}:stop`, () => stopExecutionSession(id), "Session stopped.")}
      />

      <AuditSection
        entries={data.audit}
        total={data.auditTotal}
        state={data.availability["audit"]}
        loading={loading}
        busy={busy}
        onExport={() => void exportAudit()}
      />

      <section className="border-t border-border pt-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="text-[13px] font-medium">
              Trust is part of the product, not an admin afterthought.
            </p>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Memory does not grant permission. A provider claim does not prove fulfilment. A queued
              action does not prove completion. Kurukoo keeps those boundaries visible.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/memory" className={actionClass()}>
                Manage Memory <ArrowRight className="size-3.5" />
              </Link>
              <Link to="/connect" className={actionClass()}>
                Manage Connections <ArrowRight className="size-3.5" />
              </Link>
              <Link to="/work" className={actionClass()}>
                Review Work <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CredentialsSection({
  credentials,
  state,
  loading,
  busy,
  onCreate,
  onDelete,
}: {
  credentials: Credential[];
  state?: TrustResourceState | undefined;
  loading: boolean;
  busy: string | null;
  onCreate: (input: {
    label: string;
    domain?: string;
    credentialType: CredentialType;
    ciphertext: string;
    iv: string;
    salt: string;
  }) => Promise<boolean>;
  onDelete: (id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [domain, setDomain] = useState("");
  const [credentialType, setCredentialType] = useState<CredentialType>("password");
  const [passphrase, setPassphrase] = useState("");
  const [secret, setSecret] = useState("");
  const [formError, setFormError] = useState("");

  async function submit() {
    setFormError("");
    if (!label.trim()) {
      setFormError("Give the credential a label so you recognise it later.");
      return;
    }
    if (!passphrase.trim()) {
      setFormError("A passphrase is required — Kurukoo never stores it.");
      return;
    }
    if (!secret.trim()) {
      setFormError("Enter the secret you want encrypted.");
      return;
    }
    try {
      const encrypted = await encryptSecret(secret, passphrase);
      const input: {
        label: string;
        domain?: string;
        credentialType: CredentialType;
        ciphertext: string;
        iv: string;
        salt: string;
      } = {
        label: label.trim(),
        credentialType,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      };
      if (domain.trim()) input.domain = domain.trim();
      const stored = await onCreate(input);
      if (stored) {
        setLabel("");
        setDomain("");
        setPassphrase("");
        setSecret("");
        setCredentialType("password");
        setOpen(false);
      }
    } catch (cause) {
      setFormError(
        describeError(cause, "This secret could not be encrypted, so nothing was stored."),
      );
    }
  }

  return (
    <section id="credentials" className="scroll-mt-6">
      <SectionHeading
        eyebrow="Encrypted credentials"
        title="Secrets Kurukoo can use but never read"
        body="Your secret is encrypted in this browser with AES-256-GCM and PBKDF2 (200k iterations, SHA-512) before it is sent. Kurukoo stores ciphertext, salt and iv only — never your passphrase and never the plain text."
        action={
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={actionClass("primary")}
          >
            <Plus className="size-3.5" /> {open ? "Close" : "Add credential"}
          </button>
        }
      />
      {open ? (
        <Panel className="mb-3 space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              aria-label="Credential label"
              placeholder="Label (e.g. Utility account)"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            />
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              aria-label="Credential domain"
              placeholder="Domain (optional)"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            />
            <select
              value={credentialType}
              onChange={(event) => setCredentialType(event.target.value as CredentialType)}
              aria-label="Credential type"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            >
              {Object.keys(credentialTypeLabel).map((type) => (
                <option key={type} value={type}>
                  {credentialTypeLabel[type]}
                </option>
              ))}
            </select>
            <input
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              aria-label="Encryption passphrase"
              placeholder="Encryption passphrase (never stored)"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              aria-label="Secret to encrypt"
              placeholder="Secret to encrypt"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none sm:col-span-2"
            />
          </div>
          {formError ? (
            <p role="alert" className="text-[11.5px] text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "credential:create"}
              onClick={() => void submit()}
              className={actionClass("primary")}
            >
              {busy === "credential:create" ? "Encrypting…" : "Encrypt & store"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFormError("");
              }}
              className={actionClass()}
            >
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}{" "}
      <Panel className="overflow-hidden p-0">
        {loading ? (
          <LoadingRows />
        ) : state && state.state !== "available" ? (
          <AvailabilityNote label="Encrypted credentials" state={state} />
        ) : credentials.length ? (
          <div className="divide-y divide-border">
            {credentials.map((credential) => (
              <div key={credential.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                <span className="grid size-9 shrink-0 place-items-center bg-elevated">
                  <LockKeyhole className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{credential.label}</p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {[
                      credential.domain,
                      credential.credentialType
                        ? (credentialTypeLabel[credential.credentialType] ??
                          credential.credentialType)
                        : null,
                      credential.lastUsedAt
                        ? `last used ${new Date(credential.lastUsedAt).toLocaleDateString()}`
                        : "not used yet",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete credential ${credential.label}`}
                  disabled={busy === `${credential.id}:delete`}
                  onClick={() => onDelete(credential.id, credential.label)}
                  className="grid size-9 place-items-center text-muted-foreground hover:bg-elevated hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>
            No credentials are stored for this account yet. Add one and it will be encrypted before
            it leaves your browser.
          </EmptyNote>
        )}
      </Panel>
    </section>
  );
}

function CardsSection({
  cards,
  claims,
  cardsState,
  claimsState,
  loading,
  busy,
  onCreate,
  onFreeze,
  onCancel,
}: {
  cards: VirtualCard[];
  claims: PurchaseProtection[];
  cardsState?: TrustResourceState | undefined;
  claimsState?: TrustResourceState | undefined;
  loading: boolean;
  busy: string | null;
  onCreate: (input: { spendLimitMinor: number; currency: string; merchantLock?: string }) => void;
  onFreeze: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("");
  const [merchant, setMerchant] = useState("");
  const [formError, setFormError] = useState("");

  function submit() {
    setFormError("");
    const amount = Number.parseFloat(limit.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a spend limit in pounds, for example 50.");
      return;
    }
    const input: { spendLimitMinor: number; currency: string; merchantLock?: string } = {
      spendLimitMinor: Math.round(amount * 100),
      currency: "GBP",
    };
    if (merchant.trim()) input.merchantLock = merchant.trim();
    onCreate(input);
    setLimit("");
    setMerchant("");
    setOpen(false);
  }

  return (
    <section id="cards" className="scroll-mt-6">
      <SectionHeading
        eyebrow="Protected payments"
        title="One-time cards with purchase protection"
        body="Cards are single-use virtual tokens with a spend limit and an optional merchant lock. Issue, freeze and cancel are delegated to the configured card provider, so a status is only shown when the provider reports one."
        action={
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={actionClass("primary")}
          >
            <Plus className="size-3.5" /> {open ? "Close" : "New card"}
          </button>
        }
      />
      {open ? (
        <Panel className="mb-3 space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              inputMode="decimal"
              aria-label="Spend limit in pounds"
              placeholder="Spend limit in pounds (e.g. 50)"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            />
            <input
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              aria-label="Merchant lock"
              placeholder="Merchant lock (optional)"
              className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-[12.5px] outline-none"
            />
          </div>
          {formError ? (
            <p role="alert" className="text-[11.5px] text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "card:create"}
              onClick={submit}
              className={actionClass("primary")}
            >
              {busy === "card:create" ? "Requesting…" : "Create card"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFormError("");
              }}
              className={actionClass()}
            >
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}
      <Panel className="overflow-hidden p-0">
        {loading ? (
          <LoadingRows />
        ) : cardsState && cardsState.state !== "available" ? (
          <AvailabilityNote label="One-time cards" state={cardsState} />
        ) : cards.length ? (
          <div className="grid gap-0 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y">
            {cards.map((card) => (
              <div key={card.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-primary" />
                    <span className="text-[13px] font-semibold">•••• {card.last4}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${statusTone(card.status)}`}
                  >
                    {pretty(card.status)}
                  </span>
                </div>
                <p className="mt-3 text-[20px] font-semibold tracking-tight">
                  {formatMinor(card.spendLimitMinor, card.currency)}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {[
                    card.currency,
                    card.merchantLock ? `locked to ${card.merchantLock}` : "any merchant",
                    card.expiresAt
                      ? `expires ${new Date(card.expiresAt).toLocaleDateString()}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.status === "active" ? (
                    <button
                      type="button"
                      disabled={busy === `${card.id}:freeze`}
                      onClick={() => onFreeze(card.id)}
                      className={actionClass()}
                    >
                      {busy === `${card.id}:freeze` ? (
                        "Freezing…"
                      ) : (
                        <>
                          <Snowflake className="size-3.5" /> Freeze
                        </>
                      )}
                    </button>
                  ) : null}
                  {card.status !== "cancelled" ? (
                    <button
                      type="button"
                      disabled={busy === `${card.id}:cancel`}
                      onClick={() => {
                        if (window.confirm("Cancel this card?")) onCancel(card.id);
                      }}
                      className={actionClass()}
                    >
                      {busy === `${card.id}:cancel` ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>
            No protected payment instruments are available for this account yet.
          </EmptyNote>
        )}
      </Panel>
      {claims.length ? (
        <Panel className="mt-3 overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Purchase protection claims
            </p>
          </div>
          <div className="divide-y divide-border">
            {claims.map((claim) => (
              <div key={claim.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                <AlertTriangle
                  className={`size-4 shrink-0 ${claim.status === "approved" ? "text-[var(--color-success)]" : claim.status === "denied" ? "text-destructive" : "text-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium">
                    {formatMinor(claim.amountMinor, claim.currency ?? "GBP")} · {claim.reason}
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {["Order " + claim.orderRef, pretty(claim.status), formatWhen(claim.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : claimsState && claimsState.state === "error" ? (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {claimsState.message}
        </p>
      ) : null}
    </section>
  );
}

function SessionsSection({
  sessions,
  state,
  loading,
  busy,
  newSessionId,
  onCreate,
  onQueue,
  onStop,
}: {
  sessions: ExecutionSession[];
  state?: TrustResourceState | undefined;
  loading: boolean;
  busy: string | null;
  newSessionId: string | null;
  onCreate: () => void;
  onQueue: (sessionId: string, type: ActionType) => void;
  onStop: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actions, setActions] = useState<ExecutionAction[]>([]);
  const [actionsError, setActionsError] = useState("");

  useEffect(() => {
    if (newSessionId) setActiveId(newSessionId);
  }, [newSessionId]);

  useEffect(() => {
    if (!activeId) {
      setActions([]);
      return;
    }
    let cancelled = false;
    setActionsError("");
    void fetchExecutionActions(activeId)
      .then((result) => {
        if (!cancelled) setActions(result.actions);
      })
      .catch((cause) => {
        if (!cancelled)
          setActionsError(describeError(cause, "Actions for this session could not be read."));
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, busy]);

  const active = sessions.find((session) => session.id === activeId) ?? null;
  const activeStatus = active?.status ?? "";
  const queueable =
    Boolean(active) && !["stopped", "error", "provider_required"].includes(activeStatus);

  return (
    <section id="execution" className="scroll-mt-6">
      <SectionHeading
        eyebrow="Secure execution"
        title="Work Kurukoo can control"
        body="Isolated sessions for tasks that need a real browser or OS-level action. Sessions expire, can be stopped, and every queued action is recorded. A missing execution provider stays an honest unavailable state instead of a fake success."
        action={
          <button
            type="button"
            disabled={busy === "session:create"}
            onClick={onCreate}
            className={actionClass("primary")}
          >
            <Plus className="size-3.5" />{" "}
            {busy === "session:create" ? "Requesting…" : "New session"}
          </button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Sessions · {sessions.length}
            </p>
          </div>
          {loading ? (
            <LoadingRows />
          ) : state && state.state !== "available" ? (
            <AvailabilityNote label="Secure execution" state={state} />
          ) : sessions.length ? (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  className={`flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-elevated/50 ${activeId === session.id ? "bg-elevated" : ""}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center bg-elevated">
                    <Monitor className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      Session {session.id.slice(0, 14)}…
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      {[
                        session.expiresAt ? `expires ${formatWhen(session.expiresAt)}` : null,
                        session.lastActionAt
                          ? `last action ${formatWhen(session.lastActionAt)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No expiry reported"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${statusTone(session.status)}`}
                  >
                    {pretty(session.status)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyNote>No secure execution sessions are recorded for this account.</EmptyNote>
          )}
        </Panel>
        <SessionActionsPanel session={active} busy={busy} onQueue={onQueue} onStop={onStop} />
      </div>
    </section>
  );
}

function SessionActionsPanel({
  session,
  busy,
  onQueue,
  onStop,
}: {
  session: ExecutionSession | null;
  busy: string | null;
  onQueue: (sessionId: string, type: ActionType) => void;
  onStop: (id: string) => void;
}) {
  const [actions, setActions] = useState<ExecutionAction[]>([]);
  const [actionsError, setActionsError] = useState("");
  const sessionId = session?.id ?? null;
  const status = session?.status ?? "";
  const queueable =
    Boolean(sessionId) && !["stopped", "error", "provider_required"].includes(status);

  useEffect(() => {
    if (!sessionId) {
      setActions([]);
      setActionsError("");
      return;
    }
    let cancelled = false;
    setActionsError("");
    void fetchExecutionActions(sessionId)
      .then((result) => {
        if (!cancelled) setActions(result.actions);
      })
      .catch((cause) => {
        if (!cancelled)
          setActionsError(describeError(cause, "Actions for this session could not be read."));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, busy]);

  const buttons: Array<{ type: ActionType; label: string; Icon: typeof Target }> = [
    { type: "navigate", label: "Navigate", Icon: Target },
    { type: "screenshot", label: "Screenshot", Icon: Monitor },
    { type: "extract", label: "Extract", Icon: FileText },
  ];

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {sessionId ? `Actions · ${sessionId.slice(0, 14)}…` : "Actions"}
        </p>
        {sessionId ? (
          <div className="flex items-center gap-1">
            {buttons.map(({ type, label, Icon }) => (
              <button
                key={type}
                type="button"
                aria-label={`Queue a ${label.toLowerCase()} action`}
                title={label}
                disabled={!queueable || busy === `${sessionId}:${type}`}
                onClick={() => onQueue(sessionId, type)}
                className="grid size-8 place-items-center rounded-lg hover:bg-elevated disabled:opacity-40"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
            <button
              type="button"
              aria-label="Stop this session"
              title="Stop session"
              disabled={busy === `${sessionId}:stop`}
              onClick={() => onStop(sessionId)}
              className="grid size-8 place-items-center rounded-lg text-destructive hover:bg-elevated disabled:opacity-40"
            >
              <Square className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      {session && !queueable ? (
        <p className="border-b border-border px-4 py-2 text-[10.5px] text-muted-foreground">
          This session is {pretty(status)}, so no further actions can be queued in it.
        </p>
      ) : null}
      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {actionsError ? (
          <p role="alert" className="p-3 text-[11.5px] text-destructive">
            {actionsError}
          </p>
        ) : !sessionId ? (
          <p className="p-3 text-center text-[11.5px] text-muted-foreground">
            Select a session to see the actions Kurukoo queued in it.
          </p>
        ) : actions.length ? (
          actions.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${statusTone(action.status)}`}
              >
                {pretty(action.status)}
              </span>
              <span className="text-[12px] font-medium">{pretty(action.type)}</span>
              {action.error ? (
                <span className="ml-auto truncate text-[10.5px] text-destructive">
                  {action.error}
                </span>
              ) : action.createdAt ? (
                <span className="ml-auto text-[10.5px] text-muted-foreground">
                  {formatWhen(action.createdAt)}
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <p className="p-3 text-center text-[11.5px] text-muted-foreground">
            No actions have been queued in this session yet.
          </p>
        )}
      </div>
    </Panel>
  );
}

function AuditSection({
  entries,
  total,
  state,
  loading,
  busy,
  onExport,
}: {
  entries: AuditEntry[];
  total: number;
  state?: TrustResourceState | undefined;
  loading: boolean;
  busy: string | null;
  onExport: () => void;
}) {
  const [kindFilter, setKindFilter] = useState("all");
  const kinds = Array.from(
    new Set(entries.map((entry) => entry.kind).filter((kind): kind is string => Boolean(kind))),
  );
  const filtered =
    kindFilter === "all" ? entries : entries.filter((entry) => entry.kind === kindFilter);
  const shown = filtered.slice(0, 25);

  return (
    <section id="audit" className="scroll-mt-6">
      <SectionHeading
        eyebrow="Evidence trail"
        title="Execution audit"
        body="A read-only timeline built from Kurukoo's existing event stores — what you asked, what was planned and what happened. It does not create a second history, and an event being recorded here is not a claim that an external action succeeded."
        action={
          <button
            type="button"
            disabled={loading || busy === "audit:export" || !entries.length}
            onClick={onExport}
            className={actionClass()}
          >
            {busy === "audit:export" ? (
              "Preparing…"
            ) : (
              <>
                <Download className="size-3.5" /> Export
              </>
            )}
          </button>
        }
      />
      {kinds.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Audit event kinds">
          {["all", ...kinds].map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
              className={`rounded-full border px-3 py-1.5 text-[10.5px] font-medium transition-colors ${kindFilter === kind ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-elevated"}`}
            >
              {kind === "all" ? "Everything" : (kindLabel[kind] ?? pretty(kind))}
            </button>
          ))}
        </div>
      ) : null}
      <Panel className="overflow-hidden p-0">
        {loading ? (
          <LoadingRows rows={5} />
        ) : state && state.state !== "available" ? (
          <AvailabilityNote label="Execution audit" state={state} />
        ) : shown.length ? (
          <>
            <div className="divide-y divide-border">
              {shown.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-4">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center bg-elevated">
                    {kindIcon(entry.kind ?? "action")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12.5px] font-medium">
                        {entry.title ?? entry.summary ?? pretty(entry.type ?? "Execution event")}
                      </p>
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                        {kindLabel[entry.kind ?? ""] ?? pretty(entry.kind ?? "event")}
                      </span>
                    </div>
                    {entry.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {entry.description}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                      <span>
                        {formatWhen(entry.occurredAt ?? entry.createdAt ?? entry.timestamp) ||
                          "Time not reported"}
                      </span>
                      {entry.actor ? <span>· {entry.actor}</span> : null}
                      <span
                        className={`inline-flex items-center gap-1 ${["completed", "success", "approved"].includes(entry.status ?? "") ? "text-[var(--color-success)]" : ""}`}
                      >
                        · {entry.status ? pretty(entry.status) : "recorded"}
                      </span>
                      {entry.ref || entry.requestId ? (
                        <Link
                          to="/work/$workId"
                          params={{ workId: String(entry.ref ?? entry.requestId) }}
                          className="underline decoration-dotted"
                        >
                          · Request
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3 text-[10.5px] text-muted-foreground">
              {filtered.length > shown.length
                ? `Showing the ${shown.length} most recent of ${filtered.length} recorded events.`
                : `${filtered.length} recorded event${filtered.length === 1 ? "" : "s"}.`}
              {total > entries.length ? ` Kurukoo returned ${entries.length} of ${total}.` : ""}
            </div>
          </>
        ) : (
          <EmptyNote>
            No audit events are available for this account yet. Once requests, goals or actions are
            recorded, they appear here.
          </EmptyNote>
        )}
      </Panel>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        For questions about what Kurukoo did on your behalf, ask in{" "}
        <Link to="/chat" className="text-primary hover:underline">
          Chat
        </Link>{" "}
        — the timeline is evidence, not a replacement for the conversation.
      </p>
    </section>
  );
}

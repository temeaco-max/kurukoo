import { createFileRoute } from "@tanstack/react-router";
import { Lock, Plus, Trash2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Panel } from "@/components/kurukoo/ui";
import { Action } from "@/components/kurukoo/primitives";
import {
  fetchCredentials,
  storeCredential,
  deleteCredential,
  type Credential,
  type CredentialType,
} from "@/lib/trust-api";
import { encryptSecret } from "@/lib/crypto-client";

export const Route = createFileRoute("/credentials")({
  head: () => ({
    meta: [
      { title: "Secure credentials — Kurukoo" },
      {
        name: "description",
        content: "Store passwords and secrets Kurukoo can use but never see.",
      },
    ],
  }),
  component: CredentialsPage,
});

function CredentialsPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [domain, setDomain] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [secret, setSecret] = useState("");
  const [credentialType, setCredentialType] = useState<Credential["credentialType"]>("password");

  async function load() {
    setLoading(true);
    try {
      const r = await fetchCredentials();
      setCreds(r.credentials);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load credentials");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    if (!label.trim() || !passphrase.trim() || !secret.trim()) {
      setError("Label, passphrase and secret are required");
      return;
    }
    try {
      const encrypted = await encryptSecret(secret, passphrase);
      const input: {
        label: string;
        ciphertext: string;
        iv: string;
        salt: string;
        domain?: string;
        credentialType?: CredentialType;
        expiresAt?: string;
      } = {
        label: label.trim(),
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      };
      if (domain.trim()) input.domain = domain.trim();
      if (credentialType) input.credentialType = credentialType;
      await storeCredential(input);
      setLabel("");
      setDomain("");
      setPassphrase("");
      setSecret("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not store credential");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this credential?")) return;
    try {
      await deleteCredential(id);
      await load();
    } catch {
      setError("Could not delete");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secure credentials"
        subtitle="Encrypted secrets Kurukoo can use on your behalf — but never see in plain text."
        action={
          <Action variant="primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-3.5" /> Add credential
          </Action>
        }
      />

      {error && (
        <Panel className="p-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </Panel>
      )}

      {showAdd && (
        <Panel className="p-4 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Your secret is encrypted in your browser with AES-256-GCM + PBKDF2 before it reaches
            Kurukoo's servers. Kurukoo never sees your passphrase or the plain text.
          </p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Gmail)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <select
            value={credentialType ?? "password"}
            onChange={(e) => setCredentialType(e.target.value as Credential["credentialType"])}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          >
            <option value="password">Password</option>
            <option value="api_key">API Key</option>
            <option value="token">Token</option>
            <option value="note">Secure Note</option>
            <option value="other">Other</option>
          </select>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Encryption passphrase (never stored)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret to encrypt"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <div className="flex gap-2">
            <Action variant="primary" onClick={handleAdd}>
              Encrypt & store
            </Action>
            <Action onClick={() => setShowAdd(false)}>Cancel</Action>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : creds.length === 0 ? (
        <EmptyState
          title="No credentials stored"
          body="Add a password or API key. It will be encrypted before it leaves your browser."
        />
      ) : (
        <Panel className="overflow-hidden p-0">
          <ul className="divide-y divide-border/70">
            {creds.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated">
                  <Lock className="size-4 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.domain || c.credentialType} · updated{" "}
                    {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Credentials are encrypted client-side (AES-256-GCM, PBKDF2 200k iterations). Kurukoo
          stores only ciphertext + salt + IV — never your passphrase or the plain text. To use a
          credential, ask Kurukoo in Chat; it retrieves the encrypted blob and your browser decrypts
          it locally.
        </p>
      </Panel>
    </div>
  );
}

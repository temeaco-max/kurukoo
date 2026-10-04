import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/whatsapp-linked-device")({
  head: () => ({
    meta: [
      { title: "WhatsApp linked device — Kurukoo" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "stylesheet", href: "/css/whatsapp-linked-device.css?v=1" }],
  }),
  component: WhatsAppLinkedDevicePage,
});

function WhatsAppLinkedDevicePage() {
  const [owner, setOwner] = useState<{ name: string; phone: string } | null>(null);
  useEffect(() => {
    const localAuth = window.localStorage.getItem("kurukoo-authenticated") === "true";
    const cookieToken = document.cookie.split(";").some((c) => c.trim().startsWith("kurukoo_auth_token="));
    if (!localAuth && !cookieToken) {
      window.location.assign("/login?return=/whatsapp-linked-device");
      return;
    }
    const phone = window.localStorage.getItem("kurukoo_user_phone") || "";
    const name = window.localStorage.getItem("kurukoo_user_name") || "";
    if (phone || name) setOwner({ name: name || phone, phone });
    const script = document.createElement("script");
    script.src = "/js/whatsapp-linked-device.js?v=1";
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <main className="linked-device-page">
      <section className="linked-device-shell" aria-labelledby="linked-device-title">
        <div className="linked-device-copy">
          <p className="eyebrow">Personal channel</p>
          <h1 id="linked-device-title">Link WhatsApp to Kurukoo</h1>
          <p className="linked-device-lede">
            Scan this code with the owner's iPhone, just as you would when linking WhatsApp Web.
            Your messages will continue through the same Kurukoo conversation and action system.
          </p>
          <div className="linked-device-steps" aria-label="Pairing steps">
            <div>
              <span>1</span>
              <p>Open WhatsApp on the owner phone.</p>
            </div>
            <div>
              <span>2</span>
              <p>
                Open <strong>Linked devices</strong> and choose <strong>Link a device</strong>.
              </p>
            </div>
            <div>
              <span>3</span>
              <p>Scan the code and keep the local connector running.</p>
            </div>
          </div>
          <p className="linked-device-note">
            <strong>Private account:</strong> this is a local linked-device session, not a Meta Cloud
            API business number. Group messages stay off unless explicitly enabled.
          </p>
          <div className="linked-device-boundary" role="note">
            <span className="linked-device-boundary__mark" aria-hidden="true">
              K
            </span>
            <div>
              <strong>Readiness boundary</strong>
              <span>
                A QR code appears only when the local pairing session is ready. Scanning it does not
                claim future message delivery, provider activation or external account verification.
              </span>
            </div>
            <Link to="/chat">Continue in Chat</Link>
          </div>
        </div>
        <div className="linked-device-card" data-linked-device-panel aria-live="polite">
          <div className="linked-device-status-row">
            <span data-linked-device-status-dot className="linked-device-status-dot"></span>
            <span data-linked-device-status>Ready to start pairing</span>
          </div>
          <div data-linked-device-qr-frame className="linked-device-qr-frame">
            <div className="linked-device-qr-placeholder">
              Start pairing to create a secure QR code.
            </div>
            <img
              data-linked-device-qr
              className="linked-device-qr"
              alt="WhatsApp linked-device pairing QR code"
              hidden
            />
          </div>
          <p data-linked-device-error className="linked-device-error" hidden></p>
          <div className="linked-device-actions">
            <button data-linked-device-start className="linked-device-primary" type="button">
              Start pairing
            </button>
            <button data-linked-device-stop className="linked-device-secondary" type="button" hidden>
              Stop
            </button>
            <button data-linked-device-logout className="linked-device-secondary" type="button" hidden>
              Log out device
            </button>
          </div>
          {owner ? (
            <p className="linked-device-owner">
              Signed in as <strong>{owner.name}</strong>
              {owner.phone ? ` · ${owner.phone}` : ""}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

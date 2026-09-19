import { createFileRoute } from "@tanstack/react-router";
import { Mic, MicOff, PhoneOff, ScreenShare, Video, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { VideoFrame } from "@/components/kurukoo/cards";
import { Action, IntegrationGap, Message } from "@/components/kurukoo/primitives";
import { Avatar, Badge, Panel, SectionHeader } from "@/components/kurukoo/ui";
import {
  createVoiceSession,
  endVoiceSession,
  isKurukooApiConfigured,
  type VoiceSession,
} from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "Voice and calls — Kurukoo" },
      {
        name: "description",
        content: "Voice sessions and call states for talking to Kurukoo, providers and businesses.",
      },
      { property: "og:title", content: "Voice and calls — Kurukoo" },
      {
        property: "og:description",
        content: "The voice modality of the same Kurukoo conversation.",
      },
    ],
  }),
  component: CallsPage,
});
const states = [
  { label: "Incoming", note: "A trusted contact is calling" },
  { label: "Outgoing", note: "Kurukoo is establishing the session" },
  { label: "Connecting", note: "Establishing a secure session" },
  { label: "Connected", note: "Live voice context" },
  { label: "Reconnecting", note: "Connection dropped, retrying" },
  { label: "Ended", note: "Session ended; conversation remains" },
];

function CallsPage() {
  const { messages, loadConversation } = useKurukoo();
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const activeConversation = session?.conversationId;
  useEffect(() => {
    if (activeConversation) void loadConversation(activeConversation);
  }, [activeConversation, loadConversation]);
  async function start() {
    if (!isKurukooApiConfigured()) {
      setNote("Preview session — the voice transport is not connected in this environment.");
      return;
    }
    setBusy(true);
    setNote("Opening the same Kurukoo conversation in voice…");
    try {
      const value = await createVoiceSession(activeConversation);
      setSession(value);
      setNote("Voice session ready. The conversation remains the same context.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Voice session could not be started.");
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    if (!session) return;
    setBusy(true);
    try {
      await endVoiceSession(session.sessionId);
      setNote("Voice ended. The conversation remains available in Chat and history.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Voice session could not be ended cleanly.");
    } finally {
      setSession(null);
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Voice and calls"
        subtitle="Speaking is another way into the same Kurukoo conversation."
      />
      <Panel className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name="Kurukoo" size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-medium">Voice session with Kurukoo</p>
            <p className="text-[13.5px] text-muted-foreground">
              {session
                ? "Connected to the same conversation context."
                : "Open voice when speaking is easier than typing."}
            </p>
          </div>
          <Badge tone={session ? "success" : "accent"}>{session ? "Connected" : "Ready"}</Badge>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-elevated/60 p-3">
          <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
            Live conversation
          </p>
          <p className="mt-1 text-[13px]">
            {messages.length
              ? messages[messages.length - 1]?.text || "Kurukoo is listening…"
              : "No turns yet. Start voice, then speak naturally."}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {session ? (
            <Action variant="primary" onClick={() => void stop()} disabled={busy}>
              <PhoneOff className="size-3.5" />
              {busy ? "Ending…" : "End voice"}
            </Action>
          ) : (
            <Action variant="primary" onClick={() => void start()} disabled={busy}>
              <Mic className="size-3.5" />
              {busy ? "Opening…" : "Open voice"}
            </Action>
          )}
          <Action
            onClick={() => {
              if (activeConversation)
                localStorage.setItem("kurukoo-open-conversation", activeConversation);
              window.location.assign("/chat");
            }}
          >
            Continue in Chat
          </Action>
        </div>
        <p className="mt-2 text-[10.5px] text-muted-foreground" aria-live="polite">
          {note ||
            (session?.provider
              ? `${session.provider}${session.model ? ` · ${session.model}` : ""}`
              : "Voice uses the same conversation identity when connected.")}
        </p>
      </Panel>
      {messages.length ? (
        <section className="mt-8">
          <SectionHeader
            title="Conversation context"
            subtitle="The same rich Chat response cards remain available after a voice turn."
          />
          <div className="space-y-4">
            {messages.slice(-4).map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-8">
        <SectionHeader
          title="Call states"
          subtitle="UI contracts for the connected voice session."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {states.map((s) => (
            <Panel key={s.label} className="p-4">
              <p className="text-[15px] font-medium">{s.label}</p>
              <p className="mt-0.5 text-[13.5px] text-muted-foreground">{s.note}</p>
            </Panel>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <SectionHeader title="In-call layout" subtitle="Participants, video and controls." />
        <Panel className="p-4">
          <VideoFrame label="Participant video" large />
          <ul className="mt-3 flex flex-wrap gap-3 text-[13.5px] text-muted-foreground">
            <li>You</li>
            <li>Kurukoo</li>
            <li>Connected provider, when authorised</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Call controls">
            {[Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff].map((Icon, i) => (
              <span
                key={i}
                className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground"
              >
                <Icon className="size-[18px]" />
              </span>
            ))}
          </div>
        </Panel>
      </section>
      {!isKurukooApiConfigured() ? (
        <IntegrationGap>
          Voice transport is still a preview in this environment. When the canonical voice session
          is configured, it uses the same conversation ID and returns to the same Chat history.
        </IntegrationGap>
      ) : null}
    </>
  );
}

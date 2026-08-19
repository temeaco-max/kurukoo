import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const voiceSource = fs.readFileSync(path.join(root, "components/voice-note-capture.tsx"), "utf8");
const chatSource = fs.readFileSync(path.join(root, "app/(tabs)/index.tsx"), "utf8");

describe("voice-note capture contract", () => {
  it("does not use the native-only file-system reader on web", () => {
    expect(voiceSource).toContain("Platform.OS !== \"web\"");
    expect(voiceSource).toContain("fetch(uri)");
    expect(voiceSource).toContain("audio/webm");
  });

  it("uses expo-audio playback status for native waveform progress", () => {
    expect(voiceSource).toContain("useAudioPlayerStatus");
    expect(voiceSource).toContain("playbackStatus.currentTime");
    expect(voiceSource).toContain("playbackStatus.duration");
  });

  it("renders waveform and playback progress during review", () => {
    expect(voiceSource).toContain("WAVEFORM");
    expect(voiceSource).toContain("Voice playback progress");
    expect(voiceSource).toContain("playbackPositionMs");
    expect(voiceSource).toContain("width: `${progress * 100}%`");
  });

  it("exposes a user-facing Retry now action for queued recordings", () => {
    expect(voiceSource).toContain('label={retryingQueue ? "Retrying…" : "Retry now"}');
    expect(voiceSource).toContain('onPress={() => void flushRetryQueue()}');
  });

  it("queues failed sync payloads and retries on app resume or browser reconnect", () => {
    expect(voiceSource).toContain("RETRY_QUEUE_KEY");
    expect(voiceSource).toContain("AsyncStorage.setItem");
    expect(voiceSource).toContain("flushRetryQueue");
    expect(voiceSource).toContain('window.addEventListener("online"');
    expect(voiceSource).toContain('state === "active"');
  });

  it("offers review playback before storage sync", () => {
    expect(voiceSource).toContain("useAudioPlayer");
    expect(voiceSource).toContain('accessibilityLabel={isPlaying ? "Stop listening" : "Listen"}');
    expect(voiceSource).toContain('name={isPlaying ? "pause.fill" : "play.fill"}');
    expect(voiceSource).toContain('label="Sync to storage"');
    expect(voiceSource).toContain('accessibilityLabel="Discard"');
    expect(voiceSource).toContain('name="trash.fill"');
  });

  it("shows microphone permission readiness before recording", () => {
    expect(voiceSource).toContain("Microphone ready");
    expect(voiceSource).toContain("Microphone permission needed");
    expect(voiceSource).toContain("Enable microphone");
    expect(voiceSource).toContain("requestRecordingPermissionsAsync");
  });

  it("keeps the microphone as a first-class Chat composer action", () => {
    expect(chatSource).toContain('name={showVoiceCapture ? "mic.slash.fill" : "mic.fill"}');
    expect(chatSource).toContain('accessibilityLabel={showVoiceCapture ? "Hide voice note recorder" : "Record a voice note"}');
    expect(chatSource).toContain("<VoiceNoteCapture");
  });
});

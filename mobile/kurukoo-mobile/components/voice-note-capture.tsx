import { AppState, ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import { ActionButton, SectionCard, StatusPill } from "@/components/kurukoo-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type VoiceNoteCaptureProps = {
  onTranscript: (text: string) => void;
};

type QueuedVoiceSync = {
  id: string;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  queuedAt: string;
};

const RETRY_QUEUE_KEY = "kurukoo.mobile.voice-sync-queue.v1";
const WAVEFORM = [0.28, 0.48, 0.72, 0.42, 0.88, 0.58, 0.34, 0.68, 0.94, 0.52, 0.36, 0.76, 0.46, 0.82, 0.3, 0.62, 0.9, 0.44, 0.7, 0.38, 0.56, 0.84, 0.32, 0.64];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  return btoa(binary);
}

async function readAudioAsBase64(uri: string): Promise<string> {
  if (Platform.OS !== "web") return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The recorded clip could not be read in this browser.");
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}

async function loadRetryQueue(): Promise<QueuedVoiceSync[]> {
  try {
    const raw = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is QueuedVoiceSync => Boolean(item && typeof item === "object" && "audioBase64" in item && "mimeType" in item && "durationMs" in item)) : [];
  } catch {
    return [];
  }
}

async function saveRetryQueue(queue: QueuedVoiceSync[]): Promise<void> {
  await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-3)));
}

export function VoiceNoteCapture({ onTranscript }: VoiceNoteCaptureProps) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const syncVoice = trpc.os.voice.sync.useMutation();
  const retryingRef = useRef(false);
  const [permission, setPermission] = useState<"checking" | "granted" | "denied">("checking");
  const [reviewUri, setReviewUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [retryingQueue, setRetryingQueue] = useState(false);
  const [mimeType, setMimeType] = useState(Platform.OS === "web" ? "audio/webm" : "audio/m4a");
  const startedAt = useRef<number | null>(null);
  const playbackPlayer = useAudioPlayer(reviewUri ? { uri: reviewUri } : null);
  const playbackStatus = useAudioPlayerStatus(playbackPlayer);

  const refreshQueueCount = async () => setQueuedCount((await loadRetryQueue()).length);

  const sendPayload = async (payload: Omit<QueuedVoiceSync, "id" | "queuedAt">) => {
    await syncVoice.mutateAsync({ audioBase64: payload.audioBase64, mimeType: payload.mimeType, durationMs: payload.durationMs });
  };

  const flushRetryQueue = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetryingQueue(true);
    try {
      const queue = await loadRetryQueue();
      for (const item of queue) {
        try {
          await sendPayload(item);
          const remaining = (await loadRetryQueue()).filter((candidate) => candidate.id !== item.id);
          await saveRetryQueue(remaining);
        } catch {
          break;
        }
      }
      await refreshQueueCount();
    } finally {
      retryingRef.current = false;
      setRetryingQueue(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const status = await requestRecordingPermissionsAsync();
        if (!mounted) return;
        setPermission(status.granted ? "granted" : "denied");
        if (status.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        if (mounted) setPermission("denied");
      }
      await refreshQueueCount();
      await flushRetryQueue();
    })();
    const appStateSubscription = AppState.addEventListener("change", (state) => { if (state === "active") void flushRetryQueue(); });
    const onlineHandler = () => void flushRetryQueue();
    if (Platform.OS === "web" && typeof window !== "undefined") window.addEventListener("online", onlineHandler);
    return () => {
      mounted = false;
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") window.removeEventListener("online", onlineHandler);
    };
  }, []);

  useEffect(() => {
    if (!reviewUri) {
      setIsPlaying(false);
      setPlaybackPositionMs(0);
      return;
    }
    setIsPlaying(Boolean(playbackStatus.playing));
    const nativePositionMs = Math.max(0, Math.round((playbackStatus.currentTime || 0) * 1000));
    if (nativePositionMs > 0 || playbackStatus.duration > 0) setPlaybackPositionMs(Math.min(durationMs, nativePositionMs));
    if (playbackStatus.didJustFinish) {
      setIsPlaying(false);
      setPlaybackPositionMs(0);
    }
  }, [reviewUri, playbackStatus.playing, playbackStatus.currentTime, playbackStatus.duration, playbackStatus.didJustFinish, durationMs]);

  const requestMicrophonePermission = async () => {
    try {
      const status = await requestRecordingPermissionsAsync();
      setPermission(status.granted ? "granted" : "denied");
      if (status.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    } catch {
      setPermission("denied");
    }
  };

  const startRecording = async () => {
    if (permission !== "granted" || recorderState.isRecording) return;
    setReviewUri(null);
    setSyncError(null);
    setDurationMs(0);
    setPlaybackPositionMs(0);
    startedAt.current = Date.now();
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    setDurationMs(Date.now() - (startedAt.current ?? Date.now()));
    setReviewUri(recorder.uri ?? null);
    setMimeType(Platform.OS === "web" ? "audio/webm" : "audio/m4a");
    startedAt.current = null;
  };

  const togglePlayback = () => {
    const player = playbackPlayer;
    if (!reviewUri) {
      setSyncError("Playback is not available for this clip yet.");
      return;
    }
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }
    player.seekTo(0);
    player.play();
    setPlaybackPositionMs(0);
    setIsPlaying(true);
  };

  const queuePayload = async (payload: Omit<QueuedVoiceSync, "id" | "queuedAt">) => {
    const queue = await loadRetryQueue();
    queue.push({ ...payload, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, queuedAt: new Date().toISOString() });
    await saveRetryQueue(queue);
    setQueuedCount(Math.min(queue.length, 3));
  };

  const sync = async () => {
    if (!reviewUri || syncVoice.isPending) return;
    setSyncError(null);
    try {
      const payload = { audioBase64: await readAudioAsBase64(reviewUri), mimeType, durationMs };
      try {
        await sendPayload(payload);
        setReviewUri(null);
        setDurationMs(0);
        setPlaybackPositionMs(0);
        setIsPlaying(false);
        await flushRetryQueue();
      } catch {
        await queuePayload(payload);
        setSyncError("Connection lost. This voice note is safely queued and will retry automatically when you are online.");
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "The recording could not be prepared for sync.");
    }
  };

  const discard = () => {
    setReviewUri(null);
    setDurationMs(0);
    setPlaybackPositionMs(0);
    setIsPlaying(false);
    setSyncError(null);
  };

  const progress = durationMs > 0 ? Math.min(1, playbackPositionMs / durationMs) : 0;
  const permissionLabel = permission === "checking" ? "Checking microphone" : permission === "granted" ? "Microphone ready" : "Microphone permission needed";

  const evidenceState = syncVoice.isPending ? "syncing" : queuedCount > 0 ? "queued" : recorderState.isRecording ? "recording" : reviewUri ? "review" : permission === "denied" ? "permission_required" : permission === "checking" ? "checking" : "ready";

  return (
    <View testID={`native-voice-state-${evidenceState}`} accessibilityLabel={`Voice Note · ${evidenceState}`}>
    <SectionCard>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17 }}>Voice note</Text>
          <Text style={{ color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>Record privately, listen back, then choose whether it enters Chat and connected storage.</Text>
        </View>
        <StatusPill label={recorderState.isRecording ? "Recording" : reviewUri ? "Review" : permission === "denied" ? "Permission needed" : "Ready"} tone={recorderState.isRecording ? "warning" : permission === "denied" ? "error" : reviewUri ? "neutral" : "success"} />
      </View>

      <View style={{ marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: permission === "denied" ? `${colors.error}12` : `${colors.primary}10`, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: permission === "denied" ? colors.error : colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{permissionLabel}</Text>
        <Text style={{ flex: 1, color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>{permission === "denied" ? "Allow microphone access in browser or device settings before recording. No audio has been captured." : permission === "checking" ? "Checking access before enabling recording." : "You will review the clip before it enters Chat or storage."}</Text>
      </View>

      {reviewUri ? <>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 12 }}>Recording ready for review · {Math.max(1, Math.round(durationMs / 1000))}s</Text>
        <View accessibilityLabel={`Voice playback progress ${Math.round(progress * 100)} percent`} style={{ marginTop: 10, gap: 7 }}>
          <View style={{ height: 42, flexDirection: "row", alignItems: "center", gap: 3 }}>
            {WAVEFORM.map((height, index) => <View key={`${index}-${height}`} style={{ flex: 1, height: Math.max(8, height * 38), borderRadius: 4, backgroundColor: index / WAVEFORM.length <= progress ? colors.primary : `${colors.primary}38` }} />)}
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: `${colors.primary}22`, overflow: "hidden" }}><View style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 3 }} /></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.muted, fontFamily: "Inter_500Medium", fontSize: 11 }}>{Math.floor(playbackPositionMs / 1000)}s</Text><Text style={{ color: colors.muted, fontFamily: "Inter_500Medium", fontSize: 11 }}>{Math.max(1, Math.round(durationMs / 1000))}s</Text></View>
        </View>
      </> : null}
      {syncError ? <Text style={{ color: colors.error, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 8 }}>{syncError}</Text> : null}
      {queuedCount > 0 ? <View style={{ marginTop: 8, gap: 8 }}><Text style={{ color: colors.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>Queued voice notes: {queuedCount}. They will retry automatically when the connection returns.</Text><ActionButton label={retryingQueue ? "Retrying…" : "Retry now"} variant="secondary" onPress={() => void flushRetryQueue()} /></View> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {!reviewUri ? <ActionButton label={recorderState.isRecording ? "Stop recording" : permission === "denied" ? "Enable microphone" : "Record voice note"} variant={recorderState.isRecording ? "secondary" : "primary"} onPress={() => void (recorderState.isRecording ? stopRecording() : permission === "denied" ? requestMicrophonePermission() : startRecording())} /> : <>
          <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Stop listening" : "Listen"} accessibilityHint={isPlaying ? "Pauses the voice note playback" : "Plays the recorded voice note"} onPress={togglePlayback} style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] }]}><IconSymbol name={isPlaying ? "pause.fill" : "play.fill"} size={21} color={colors.foreground} /></Pressable>
          <ActionButton label="Sync to storage" variant="primary" onPress={() => void sync()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Discard" accessibilityHint="Deletes this recording without syncing it" onPress={discard} style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: `${colors.error}55`, backgroundColor: `${colors.error}0D`, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] }]}><IconSymbol name="trash.fill" size={20} color={colors.error} /></Pressable>
        </>}
        {syncVoice.isPending ? <ActivityIndicator color={colors.primary} accessibilityLabel="Syncing voice note" /> : null}
      </View>
    </SectionCard>
    </View>
  );
}

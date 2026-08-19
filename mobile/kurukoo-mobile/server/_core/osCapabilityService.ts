import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { TRPCError } from "@trpc/server";

import { listUserArtifacts, listUserDeviceLinks, createArtifact, createDeviceLink, deleteArtifactReference, getArtifactById, getDeviceLinkByTokenHash, markDeviceLinked, revokeDeviceLink, updateArtifactStorage } from "../db";
import { deleteFromGoogleDrive, getGoogleDriveConnectionStatus, uploadToGoogleDrive } from "./googleDriveService";
import { OS_ARTIFACTS, OS_CAPABILITY_SKILLS, OS_OPPORTUNITIES } from "../../lib/os-capability-contract";
import { storageGetSignedUrl, storagePut } from "../storage";
import { transcribeAudio } from "./voiceTranscription";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const PAIRING_TTL_MS = 10 * 60 * 1000;

type VoiceNoteInput = { audioBase64: string; mimeType: string; durationMs?: number; language?: string };

function hashPairingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCapabilityPortfolio(userId: number) {
  const [artifacts, devices, drive] = await Promise.all([listUserArtifacts(userId), listUserDeviceLinks(userId), getGoogleDriveConnectionStatus(userId)]);
  return {
    source: "canonical-capability-service" as const,
    fetchedAt: new Date().toISOString(),
    skills: OS_CAPABILITY_SKILLS,
    artifacts: artifacts.length ? artifacts.map((artifact) => ({ title: artifact.title, detail: `${artifact.storageProvider === "google-drive" ? "Saved to Google Drive" : "Saved to Kurukoo-managed fallback"} · ${artifact.storageStatus}${artifact.transcriptState === "saved" ? " · transcript ready" : " · transcript needs review"}`, state: artifact.storageStatus === "verified" ? "Saved" as const : "Needs your input" as const })) : OS_ARTIFACTS,
    opportunities: OS_OPPORTUNITIES,
    voice: { state: "ready" as const, reviewBeforeSend: true, transcription: "available" as const },
    storage: { state: drive.status === "connected" ? "connected" as const : "available" as const, sync: "available" as const, provider: drive.status === "connected" ? "Google Drive" as const : "Kurukoo-managed fallback" as const, artifactCount: artifacts.length, googleDrive: drive },
    devices: devices.map((device) => ({ id: device.id, label: device.label, platform: device.platform, status: device.status, lastSeenAt: device.lastSeenAt?.toISOString() ?? null })),
  };
}

function extensionForMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("webm")) return "webm";
  return "m4a";
}

export async function syncVoiceNote(userId: number, input: VoiceNoteInput) {
  if (!input.audioBase64 || !input.mimeType.startsWith("audio/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid audio recording before syncing." });
  const audio = Buffer.from(input.audioBase64, "base64");
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "This voice note is too large to sync. Keep recordings under 12 MB." });

  const key = `users/${userId}/voice-notes/${Date.now()}-${randomBytes(8).toString("hex")}.${extensionForMimeType(input.mimeType)}`;
  let stored: { key: string; url: string };
  try {
    stored = await storagePut(key, audio, input.mimeType);
  } catch (error) {
    throw new TRPCError({ code: "TIMEOUT", message: error instanceof Error ? `Voice note storage is unavailable: ${error.message}` : "Voice note storage is unavailable. Try again when you are online." });
  }

  let transcript: Awaited<ReturnType<typeof transcribeAudio>> | null = null;
  let transcriptState: "saved" | "needs-review" = "needs-review";
  try {
    const signedUrl = await storageGetSignedUrl(stored.key);
    transcript = await transcribeAudio({ audioUrl: signedUrl, language: input.language });
    if ("text" in transcript && transcript.text.trim()) transcriptState = "saved";
  } catch (error) {
    console.warn("[OS] Voice note stored but transcription was unavailable", error);
  }

  const text = transcript && "text" in transcript ? transcript.text.trim() : null;
  let storageProvider: "google-drive" | "kurukoo-managed" = "kurukoo-managed";
  let storageStatus: "pending_upload" | "uploaded" | "verified" | "pending_external_storage" | "retrying" | "failed" | "expired" = "verified";
  let externalObjectId: string | null = null;
  let connectionId: number | null = null;
  let storageUrl = stored.url;
  let storageDetail = "Saved to Kurukoo-managed fallback storage";
  try {
    const drive = await getGoogleDriveConnectionStatus(userId);
    if (drive.status === "connected") {
      const external = await uploadToGoogleDrive(userId, { bytes: audio, name: `kurukoo-voice-${Date.now()}.${extensionForMimeType(input.mimeType)}`, mimeType: input.mimeType });
      storageProvider = "google-drive";
      storageStatus = "verified";
      externalObjectId = external.externalObjectId;
      connectionId = external.connectionId;
      storageUrl = external.webViewLink;
      storageDetail = "Saved to your Google Drive · verified";
    } else {
      storageStatus = "verified";
      storageDetail = "Saved to Kurukoo-managed fallback storage · connect Google Drive to externalize it";
    }
  } catch (error) {
    storageStatus = "pending_external_storage";
    storageDetail = "Audio is staged for retry; Google Drive storage was not confirmed";
    console.warn("[OS] External Drive upload unavailable; retaining bounded fallback staging", error instanceof Error ? error.message : "unknown error");
  }
  const artifact = await createArtifact({ userId, kind: "voice-note", title: "Voice note transcript", storageKey: stored.key, storageUrl, storageProvider, storageStatus, externalObjectId, connectionId, mimeType: input.mimeType, durationMs: input.durationMs ?? null, transcript: text, transcriptState });
  return { artifact: { id: artifact?.id ?? null, title: "Voice note transcript", detail: `${storageDetail} · ${transcriptState === "saved" ? "transcript ready" : "transcript needs review"}`, state: transcriptState === "saved" ? "Saved" as const : "Needs your input" as const, storageKey: stored.key, storageUrl, storageProvider, storageStatus, externalObjectId, durationMs: input.durationMs ?? null }, transcript: text, transcriptState };
}

export async function listStoredArtifacts(userId: number, filters: { search?: string; from?: string; to?: string } = {}) {
  const rows = await listUserArtifacts(userId);
  const search = filters.search?.trim().toLowerCase();
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : undefined;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : undefined;
  return rows.filter((artifact) => {
    const created = artifact.createdAt.getTime();
    const haystack = `${artifact.title} ${artifact.transcript ?? ""}`.toLowerCase();
    return (!search || haystack.includes(search)) && (from === undefined || created >= from) && (to === undefined || created <= to);
  }).map((artifact) => ({ id: artifact.id, kind: artifact.kind, title: artifact.title, storageUrl: artifact.storageUrl, storageProvider: artifact.storageProvider, storageStatus: artifact.storageStatus, externalObjectId: artifact.externalObjectId, mimeType: artifact.mimeType, durationMs: artifact.durationMs, transcript: artifact.transcript, transcriptState: artifact.transcriptState, createdAt: artifact.createdAt.toISOString() }));
}

export async function deleteStoredArtifact(userId: number, id: number, deleteOriginal: boolean) {
  const artifact = await getArtifactById(id, userId);
  if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found." });
  const hasDriveOriginal = artifact.storageProvider === "google-drive" && Boolean(artifact.externalObjectId);
  if (deleteOriginal && hasDriveOriginal) await deleteFromGoogleDrive(userId, artifact.externalObjectId!);
  await deleteArtifactReference(id, userId);
  return { deletedReference: true, deletedOriginal: deleteOriginal && hasDriveOriginal };
}

export async function migrateArtifactToGoogleDrive(userId: number, id: number) {
  const artifact = await getArtifactById(id, userId);
  if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found." });
  if (artifact.storageProvider === "google-drive") return { artifact, migrated: false, detail: "Artifact is already stored in Google Drive." };
  if (!artifact.storageKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This artifact has no retrievable fallback object." });
  const signedUrl = await storageGetSignedUrl(artifact.storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The fallback recording could not be retrieved for migration." });
  const external = await uploadToGoogleDrive(userId, { bytes: Buffer.from(await response.arrayBuffer()), name: artifact.title || `kurukoo-artifact-${artifact.id}`, mimeType: artifact.mimeType || "audio/m4a" });
  const updated = await updateArtifactStorage(id, userId, { storageProvider: "google-drive", storageStatus: "verified", externalObjectId: external.externalObjectId, connectionId: external.connectionId, storageUrl: external.webViewLink });
  return { artifact: updated, migrated: true, detail: "Artifact migrated to Google Drive. The fallback copy remains until you remove it explicitly." };
}

export async function createDevicePairing(userId: number, input: { label: string; platform: string; deviceKey: string }) {
  const label = input.label.trim().slice(0, 120);
  const platform = input.platform.trim().slice(0, 32);
  const deviceKey = input.deviceKey.trim().slice(0, 128);
  if (!label || !platform || !deviceKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Device label, platform, and device key are required." });
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  const device = await createDeviceLink({ userId, label, platform, deviceKey, status: "pending", pairingTokenHash: hashPairingToken(token), pairingExpiresAt: expiresAt });
  const payload = `kurukoo://connect/device?token=${encodeURIComponent(token)}&pairingId=${device?.id ?? ""}`;
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1 });
  return { pairingId: device?.id ?? null, token, payload, qrDataUrl, expiresAt: expiresAt.toISOString(), status: "pending" as const };
}

export async function listConnectedDevices(userId: number) {
  const devices = await listUserDeviceLinks(userId);
  return devices.map((device) => ({ id: device.id, label: device.label, platform: device.platform, status: device.status, lastSeenAt: device.lastSeenAt?.toISOString() ?? null, createdAt: device.createdAt.toISOString(), expiresAt: device.pairingExpiresAt.toISOString() }));
}

export async function confirmDevicePairing(userId: number, token: string) {
  const normalized = token.trim();
  if (!normalized) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter or scan a valid pairing token." });
  const device = await getDeviceLinkByTokenHash(hashPairingToken(normalized));
  if (!device || device.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "That pairing session is unavailable or belongs to another account." });
  if (device.status === "revoked") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This device link was revoked. Start a new pairing session." });
  if (device.pairingExpiresAt.getTime() < Date.now()) throw new TRPCError({ code: "TIMEOUT", message: "This QR pairing session expired. Generate a new code and try again." });
  const linked = await markDeviceLinked(device.id);
  return { id: linked?.id ?? device.id, label: linked?.label ?? device.label, platform: linked?.platform ?? device.platform, status: "linked" as const, linkedAt: linked?.lastSeenAt?.toISOString() ?? new Date().toISOString() };
}

export async function revokeConnectedDevice(userId: number, id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "A valid device link is required." });
  return revokeDeviceLink(userId, id);
}

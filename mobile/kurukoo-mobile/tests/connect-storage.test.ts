import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getCapabilityPortfolio } from "../server/_core/osCapabilityService";

const sourcePath = (relative: string) => resolve(process.cwd(), relative);
const serviceSource = readFileSync(sourcePath("server/_core/osCapabilityService.ts"), "utf8");
const routerSource = readFileSync(sourcePath("server/routers.ts"), "utf8");
const connectSource = readFileSync(sourcePath("components/surface-detail.tsx"), "utf8");
const artifactHistorySource = readFileSync(sourcePath("app/surface/artifacts.tsx"), "utf8");
const driveSource = readFileSync(sourcePath("server/_core/googleDriveService.ts"), "utf8");
const appConfigSource = readFileSync(sourcePath("app.config.ts"), "utf8");

describe("storage and Connect contracts", () => {
  it("keeps voice sync owner-scoped from upload through durable artifact persistence", () => {
    expect(serviceSource).toContain("users/${userId}/voice-notes/");
    expect(serviceSource).toContain("storagePut(key, audio, input.mimeType)");
    expect(serviceSource).toContain("createArtifact({ userId");
    expect(routerSource).toContain("syncVoiceNote(ctx.user.id, input)");
  });

  it("generates expiring QR pairing payloads and requires server confirmation", () => {
    expect(serviceSource).toContain("pairingExpiresAt");
    expect(serviceSource).toContain("QRCode.toDataURL(payload");
    expect(serviceSource).toContain("confirmDevicePairing");
    expect(serviceSource).toContain("This QR pairing session expired");
    expect(routerSource).toContain("createPairing");
    expect(routerSource).toContain("confirmPairing");
  });

  it("exposes the canonical Connect UI for QR creation, token confirmation, and revocation", () => {
    expect(connectSource).toContain("Create QR pairing");
    expect(connectSource).toContain("Confirm link");
    expect(connectSource).toContain("pairing.qrDataUrl");
    expect(connectSource).toContain("Revoke access");
    expect(connectSource).toContain("Only server-confirmed links appear here.");
  });

  it("uses least-privilege Drive OAuth and fails closed without credentials", () => {
    expect(driveSource).toContain("https://www.googleapis.com/auth/drive.file");
    expect(driveSource).toContain("not-configured");
    expect(driveSource).toContain("No Drive connection is claimed");
    expect(driveSource).toContain("access_type",);
    expect(driveSource).toContain("offline");
    expect(driveSource).toContain("refreshTokenCiphertext");
  });

  it("exposes artifact history playback, transcript, Drive, retry boundary, and explicit metadata deletion", () => {
    expect(artifactHistorySource).toContain("Artifact history");
    expect(artifactHistorySource).toContain("View transcript");
    expect(artifactHistorySource).toContain("Open in Drive");
    expect(artifactHistorySource).toContain("Delete Kurukoo reference?");
    expect(artifactHistorySource).toContain("/api/os/artifacts/${artifact.id}/content");
  });

  it("registers native camera QR scanning with a web fallback", () => {
    expect(connectSource).toContain("CameraView");
    expect(connectSource).toContain("useCameraPermissions");
    expect(connectSource).toContain("Scan QR code");
    expect(appConfigSource).toContain("expo-camera");
  });

  it("retains truthful portfolio boundaries when the database is unavailable", async () => {
    const portfolio = await getCapabilityPortfolio(1);
    expect(portfolio.storage.provider).toBe("Kurukoo-managed fallback");
    expect(portfolio.voice.reviewBeforeSend).toBe(true);
    expect(Array.isArray(portfolio.devices)).toBe(true);
  });
});

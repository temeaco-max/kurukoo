import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { consumeOAuthState, createOAuthState, getGoogleDriveConnection, saveGoogleDriveConnection, revokeGoogleDriveConnection } from "../db";

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Kurukoo";
const REDIRECT_FALLBACK = "http://localhost:3000/api/connect/google/callback";

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string };
type DriveFile = { id?: string; name?: string; mimeType?: string; webViewLink?: string };

function config() {
  return { clientId: process.env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || REDIRECT_FALLBACK };
}

export function googleDriveReadiness() {
  const { clientId, clientSecret, redirectUri } = config();
  if (!clientId || !clientSecret || !redirectUri) return { state: "not-configured" as const, detail: "Google Drive is not configured for this environment. No Drive connection is claimed." };
  return { state: "ready" as const, detail: "Google Drive OAuth is ready to connect with the least-privilege drive.file scope." };
}

function stateHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function encryptionKey() { return createHash("sha256").update(process.env.MEMORY_ENCRYPTION_KEY || "kurukoo-drive-key-not-configured").digest(); }
function encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv); const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`; }
function decrypt(value: string) { const [ivRaw, tagRaw, ciphertextRaw] = value.split("."); const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url")); decipher.setAuthTag(Buffer.from(tagRaw, "base64url")); return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8"); }

export async function beginGoogleDriveAuthorization(userId: number) {
  const ready = googleDriveReadiness();
  if (ready.state !== "ready") throw new TRPCError({ code: "PRECONDITION_FAILED", message: ready.detail });
  const state = randomBytes(32).toString("base64url");
  await createOAuthState({ userId, provider: "google-drive", stateHash: stateHash(state), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const { clientId, redirectUri } = config();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
  url.searchParams.set("state", state);
  return { authorizationUrl: url.toString(), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), scope: GOOGLE_DRIVE_SCOPE };
}

async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const body = new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Google authorization could not be completed.");
  return (await response.json()) as GoogleTokenResponse;
}

async function driveRequest<T>(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status}).`);
  return (await response.json()) as T;
}

async function createFolder(accessToken: string, name: string, parentId?: string) {
  const query = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ""}`);
  const existing = await driveRequest<{ files?: DriveFile[] }>(accessToken, `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)`);
  if (existing.files?.[0]?.id) return existing.files[0].id;
  const created = await driveRequest<DriveFile>(accessToken, "https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }) });
  if (!created.id) throw new Error("Google Drive did not return a folder ID.");
  return created.id;
}

export async function completeGoogleDriveAuthorization(code: string, state: string) {
  const saved = await consumeOAuthState(stateHash(state));
  if (!saved || saved.provider !== "google-drive" || saved.expiresAt.getTime() < Date.now()) throw new Error("This Google Drive authorization session expired or was already used.");
  const tokens = await exchangeCode(code);
  if (!tokens.refresh_token) throw new Error("Google did not return an offline refresh token. Reconnect and approve Drive access.");
  const userInfo = await driveRequest<{ sub?: string; email?: string }>(tokens.access_token!, "https://www.googleapis.com/oauth2/v3/userinfo");
  if (!userInfo.sub) throw new Error("Google account identity could not be verified.");
  const rootId = await createFolder(tokens.access_token!, FOLDER_NAME);
  const voiceId = await createFolder(tokens.access_token!, "Voice", rootId);
  const savedConnection = await saveGoogleDriveConnection({ userId: saved.userId, provider: "google-drive", externalAccountId: userInfo.sub, accountEmail: userInfo.email ?? null, refreshTokenCiphertext: encrypt(tokens.refresh_token), folderId: voiceId, status: "connected", scope: GOOGLE_DRIVE_SCOPE, lastValidatedAt: new Date() });
  return { connectionId: savedConnection?.id ?? null, accountEmail: userInfo.email ?? null, folderId: voiceId };
}

export async function getGoogleDriveConnectionStatus(userId: number) {
  const ready = googleDriveReadiness();
  if (ready.state !== "ready") return { provider: "google-drive" as const, status: "not-configured" as const, detail: ready.detail, accountEmail: null, folderId: null };
  const connection = await getGoogleDriveConnection(userId);
  if (!connection || connection.status !== "connected") return { provider: "google-drive" as const, status: "not-connected" as const, detail: "Connect Google Drive to make it the preferred durable storage for voice notes and user artifacts.", accountEmail: null, folderId: null };
  return { provider: "google-drive" as const, status: "connected" as const, detail: "New user artifacts will prefer your Kurukoo folder in Google Drive.", accountEmail: connection.accountEmail, folderId: connection.folderId };
}

async function refreshAccessToken(userId: number) {
  const connection = await getGoogleDriveConnection(userId);
  if (!connection || connection.status !== "connected") throw new Error("Google Drive is not connected for this account.");
  const { clientId, clientSecret } = config();
  try {
    const body = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, refresh_token: decrypt(connection.refreshTokenCiphertext), grant_type: "refresh_token" });
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error("Google token refresh failed.");
    const tokens = (await response.json()) as GoogleTokenResponse;
    if (!tokens.access_token) throw new Error("Google token refresh returned no access token.");
    return { accessToken: tokens.access_token, connection };
  } catch {
    await revokeGoogleDriveConnection(userId);
    throw new Error("Google Drive authorization expired or was revoked. Reconnect Drive before syncing artifacts.");
  }
}

export async function uploadToGoogleDrive(userId: number, input: { bytes: Buffer; name: string; mimeType: string }) {
  const { accessToken, connection } = await refreshAccessToken(userId);
  const boundary = `kurukoo-${randomBytes(12).toString("hex")}`;
  const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: input.name, mimeType: input.mimeType, parents: connection.folderId ? [connection.folderId] : undefined })}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`);
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: Buffer.concat([metadata, input.bytes, ending]) });
  if (!response.ok) throw new Error("Google Drive upload failed. The recording remains eligible for retry.");
  const file = (await response.json()) as DriveFile;
  if (!file.id) throw new Error("Google Drive returned no file ID.");
  await driveRequest<DriveFile>(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,mimeType`, { method: "GET" });
  return { connectionId: connection.id, externalObjectId: file.id, webViewLink: file.webViewLink ?? `https://drive.google.com/open?id=${file.id}` };
}

export async function deleteFromGoogleDrive(userId: number, fileId: string) {
  const { accessToken } = await refreshAccessToken(userId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok && response.status !== 404) throw new Error("Google Drive file deletion failed.");
  return { deleted: response.status !== 404, externalObjectId: fileId };
}

export async function downloadFromGoogleDrive(userId: number, fileId: string) {
  const { accessToken } = await refreshAccessToken(userId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Google Drive playback retrieval failed.");
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") || "application/octet-stream" };
}

export async function revokeGoogleDrive(userId: number) {
  await revokeGoogleDriveConnection(userId);
  return { status: "revoked" as const, detail: "Google Drive access was revoked. Existing Drive files remain in your Drive; Kurukoo will stop accessing them." };
}

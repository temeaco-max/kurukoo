/**
 * Client-side encryption for the canonical Secure Credential Store.
 *
 * Mirrors the backend `secureCredentialStore.ts` crypto (AES-256-GCM + PBKDF2, SHA-512,
 * 200k iterations) but runs entirely in the browser: the plaintext and the passphrase never
 * leave the client. Kurukoo only ever receives ciphertext + iv + salt.
 */
const PBKDF2_ITERATIONS = 200_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
/**
 * Web Crypto (SubtleCrypto) uses the standard WebCrypto/JOSE name `AES-GCM`. It does NOT accept
 * the OpenSSL/Node label `aes-256-gcm` that the backend service uses, so the name here must stay
 * `AES-GCM` even though the backend records `aes-256-gcm` in its stored metadata.
 *
 * The key is still AES-256 because `length: KEY_LENGTH * 8` (256 bits) is requested when deriving.
 */
const ALGORITHM = "AES-GCM";

export type EncryptedSecret = { ciphertext: string; iv: string; salt: string };

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-512" },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH * 8 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts a secret in the browser. The passphrase is never transmitted or stored. */
export async function encryptSecret(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedSecret> {
  if (!plaintext.trim()) throw new Error("A secret is required before it can be encrypted.");
  if (!passphrase.trim()) throw new Error("A passphrase is required to encrypt this secret.");
  if (typeof crypto === "undefined" || !crypto.subtle)
    throw new Error("This browser cannot encrypt a secret safely, so nothing was stored.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/** Decrypts a stored secret locally, using the same passphrase the owner supplied. */
export async function decryptSecret(
  ciphertext: string,
  iv: string,
  salt: string,
  passphrase: string,
): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle)
    throw new Error("This browser cannot decrypt a secret locally.");
  const key = await deriveKey(passphrase, fromBase64(salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) as BufferSource },
    key,
    fromBase64(ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(decrypted);
}

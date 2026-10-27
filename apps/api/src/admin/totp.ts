import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Two-step login for admins: the 6-digit codes of an authenticator app
// (Google Authenticator, Microsoft Authenticator…), as RFC 6238 defines them
// — HMAC-SHA-1, 30-second steps — with Node's own crypto, no library. The
// app's secret is kept encrypted (AES-256-GCM) with ADMIN_SECRETS_KEY, which
// lives outside the database.

export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret for an authenticator app: 20 random bytes, as base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 30-second step a moment falls in. */
export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/** The code for one step (RFC 6238 / 4226 dynamic truncation). `digits` is 6 for the app; the RFC's test values use 8. */
export function totpCode(secretBase32: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * The step a typed code belongs to, allowing one step either side for a phone
 * clock that's a little off — or null. A step at or before `lastUsedStep`
 * never counts, so a code can't be used twice.
 */
export function matchTotp(secretBase32: string, code: string, nowMs: number, lastUsedStep: number): number | null {
  const now = totpStep(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastUsedStep) continue;
    const expected = Buffer.from(totpCode(secretBase32, step));
    const given = Buffer.from(code);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return step;
  }
  return null;
}

/** What the app scans: otpauth://totp/… with the issuer and the admin's name. */
export function otpauthUri(secretBase32: string, accountName: string, issuer = "Khmio Admin"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

/** "iv.tag.ciphertext", each base64url — AES-256-GCM with the key from ADMIN_SECRETS_KEY. */
export function encryptSecret(plain: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

/** Throws if the key is wrong or the value was tampered with (GCM checks both). */
export function decryptSecret(sealed: string, keyBase64: string): string {
  const [iv, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !data) throw new Error("bad sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8 one-time backup codes like "4F7K-9QX2" (no 0/O/1/I to misread). */
export function newBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((byte) => BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/** Backup codes are compared without the dash. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

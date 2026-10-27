import type { SystemDb } from "@khmio/db";
import { DAY_MS, SESSION_TTL_DAYS } from "@khmio/shared";
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "khmio_session";

/** Only this is stored: a stolen database backup can't be turned back into a working cookie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Starts a session and returns the token for the cookie (32 random bytes). */
export async function createSession(db: SystemDb, merchantId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * DAY_MS);
  await db.session.create({ data: { merchantId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

/** The merchant a cookie belongs to, or null if it's unknown, signed out or expired. */
export async function resolveSession(db: SystemDb, token: string, now = new Date()): Promise<string | null> {
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt <= now) return null;
  return session.merchantId;
}

export async function revokeSession(db: SystemDb, token: string): Promise<void> {
  await db.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Reads one cookie from a raw Cookie header (no cookie library needed for one value). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The Set-Cookie value: not readable by page scripts, sent only to the API, Secure outside development. */
export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, ...(secure ? ["Secure"] : [])].join("; ");
}

export function clearedSessionCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", ...(secure ? ["Secure"] : [])].join("; ");
}

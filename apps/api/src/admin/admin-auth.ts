import type { AdminRole, SystemDb } from "@khmio/db";
import { createHash, randomBytes } from "node:crypto";
import { hashToken } from "../auth/sessions";
import { decryptSecret, encryptSecret, matchTotp, newBackupCodes, newTotpSecret, normalizeBackupCode, otpauthUri } from "./totp";

// The admin login (roadmap step 7), separate from sellers': its own table of
// admins, its own sessions and cookie. Step one is Telegram (or, on a
// developer's PC, the development login); step two is the authenticator
// app's code. Only after both is a session "active".

export const ADMIN_COOKIE = "khmio_admin";
/** Between step one and the code. */
const PENDING_MS = 10 * 60_000;
/** A working day; then sign in again. */
const ACTIVE_MS = 12 * 60 * 60_000;
/** Wrong codes in a row before the login locks. */
export const MAX_FAILED_CODES = 5;
export const LOCK_MS = 15 * 60_000;

export interface AdminIdentity {
  adminId: string;
  role: AdminRole;
  name: string;
}

export type AdminSessionState =
  | { stage: "active"; admin: AdminIdentity }
  | { stage: "pending_2fa"; admin: AdminIdentity; enrolled: boolean }
  | null;

/** The listed, not-disabled admin with this Telegram account — or null: nobody else gets a session. */
export async function findActiveAdmin(db: SystemDb, telegramId: string) {
  const admin = await db.adminUser.findUnique({ where: { telegramId } });
  return admin && !admin.disabledAt ? admin : null;
}

/** Step one passed: a short session that can only finish the login. */
export async function startAdminSession(db: SystemDb, adminUserId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PENDING_MS);
  await db.adminSession.create({ data: { adminUserId, tokenHash: hashToken(token), stage: "pending_2fa", expiresAt } });
  return { token, expiresAt };
}

export async function readAdminSession(db: SystemDb, token: string, now = new Date()): Promise<AdminSessionState> {
  const session = await db.adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { adminUser: true } });
  if (!session || session.revokedAt || session.expiresAt <= now || session.adminUser.disabledAt) return null;
  const admin = { adminId: session.adminUser.id, role: session.adminUser.role, name: session.adminUser.name };
  if (session.stage === "active") return { stage: "active", admin };
  return { stage: "pending_2fa", admin, enrolled: session.adminUser.totpSecretEnc !== null };
}

export async function revokeAdminSession(db: SystemDb, token: string): Promise<void> {
  await db.adminSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

/** First login: a new secret for the app, kept pending until a code proves the app has it. */
export async function beginEnrolment(db: SystemDb, adminId: string, key: string): Promise<{ otpauthUri: string; secret: string }> {
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: adminId } });
  if (admin.totpSecretEnc) throw new Error("already enrolled");
  const secret = newTotpSecret();
  await db.adminUser.update({ where: { id: adminId }, data: { totpPendingEnc: encryptSecret(secret, key) } });
  return { otpauthUri: otpauthUri(secret, admin.telegramUsername || admin.name), secret };
}

export type CodeOutcome = { ok: true; backupCodes?: string[]; usedBackupCode?: boolean } | { ok: false; reason: "wrong_code" | "locked"; lockedJustNow?: boolean };

/**
 * Step two: checks a code (or, once enrolled, a backup code), counts wrong
 * ones and locks after MAX_FAILED_CODES, and on success makes the session
 * active. Enrolling returns the 8 backup codes — shown once, stored hashed.
 */
export async function verifyCode(db: SystemDb, sessionToken: string, code: string, key: string, now = new Date()): Promise<CodeOutcome> {
  const session = await db.adminSession.findUnique({ where: { tokenHash: hashToken(sessionToken) }, include: { adminUser: true } });
  if (!session || session.stage !== "pending_2fa" || session.revokedAt || session.expiresAt <= now) return { ok: false, reason: "wrong_code" };
  const admin = session.adminUser;
  if (admin.lockedUntil && admin.lockedUntil > now) return { ok: false, reason: "locked" };

  const enrolling = admin.totpSecretEnc === null;
  const sealed = enrolling ? admin.totpPendingEnc : admin.totpSecretEnc;
  let step: number | null = null;
  let usedBackupCode = false;
  if (sealed && /^\d{6}$/.test(code)) step = matchTotp(decryptSecret(sealed, key), code, now.getTime(), admin.totpLastStep);
  if (step === null && !enrolling && !/^\d{6}$/.test(code)) {
    // A backup code: each works once.
    const hash = createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
    const { count } = await db.adminBackupCode.updateMany({ where: { adminUserId: admin.id, codeHash: hash, usedAt: null }, data: { usedAt: now } });
    usedBackupCode = count === 1;
  }

  if (step === null && !usedBackupCode) {
    const failed = admin.failedCodes + 1;
    const lock = failed >= MAX_FAILED_CODES;
    await db.adminUser.update({ where: { id: admin.id }, data: lock ? { failedCodes: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) } : { failedCodes: failed } });
    return lock ? { ok: false, reason: "locked", lockedJustNow: true } : { ok: false, reason: "wrong_code" };
  }

  const backupCodes = enrolling ? newBackupCodes() : undefined;
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: admin.id },
      data: {
        failedCodes: 0,
        lockedUntil: null,
        lastActiveAt: now,
        ...(step !== null ? { totpLastStep: step } : {}),
        ...(enrolling ? { totpSecretEnc: admin.totpPendingEnc, totpPendingEnc: null } : {}),
      },
    });
    if (backupCodes) {
      await tx.adminBackupCode.deleteMany({ where: { adminUserId: admin.id } });
      await tx.adminBackupCode.createMany({
        data: backupCodes.map((plain) => ({ adminUserId: admin.id, codeHash: createHash("sha256").update(normalizeBackupCode(plain)).digest("hex") })),
      });
    }
    await tx.adminSession.update({ where: { id: session.id }, data: { stage: "active", expiresAt: new Date(now.getTime() + ACTIVE_MS) } });
  });
  return { ok: true, backupCodes, usedBackupCode };
}

/** The admin cookie: only for the API's /admin routes, never readable by page scripts. */
export function adminCookie(token: string, expiresAt: Date, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [`${ADMIN_COOKIE}=${encodeURIComponent(token)}`, "Path=/admin", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAge}`, ...(secure ? ["Secure"] : [])].join("; ");
}

export function clearedAdminCookie(secure: boolean): string {
  return [`${ADMIN_COOKIE}=`, "Path=/admin", "HttpOnly", "SameSite=Strict", "Max-Age=0", ...(secure ? ["Secure"] : [])].join("; ");
}

/** Development's admin login: the first owner who isn't disabled. */
export function firstActiveOwner(db: SystemDb) {
  return db.adminUser.findFirst({ where: { role: "owner", disabledAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
}

/** Whether the admin has set up their authenticator app: then step two asks for a code, else it enrols them. */
export async function hasAuthenticator(db: SystemDb, adminId: string): Promise<boolean> {
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: adminId }, select: { totpSecretEnc: true } });
  return Boolean(admin.totpSecretEnc);
}

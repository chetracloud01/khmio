import { queueAdminAlert, type SystemDb, writeAudit } from "@khmio/db";
import { adminCodeSchema, telegramLoginPayloadSchema, type AuditAction } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Post, Req, Res, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { readCookie } from "../auth/sessions";
import { checkTelegramLogin } from "../auth/telegram";
import { getEnv } from "../config";
import { SYSTEM_DB } from "../db";
import { AppException, InvalidInputException } from "../errors";
import { clientAddress, RATE_LIMITER, type RateLimiter } from "../security/rate-limit";
import {
  ADMIN_COOKIE,
  adminCookie,
  beginEnrolment,
  clearedAdminCookie,
  findActiveAdmin,
  firstActiveOwner,
  hasAuthenticator,
  readAdminSession,
  revokeAdminSession,
  startAdminSession,
  verifyCode,
} from "./admin-auth";

interface CookieResponse {
  setHeader(name: string, value: string): unknown;
}
interface CookieRequest {
  headers: { cookie?: string };
  ip?: string;
}

/**
 * The admin login: Telegram (or the development login), then the
 * authenticator code. Nobody becomes an admin here — admins are listed by
 * the add-owner command (and, in Release 3, invited by an owner).
 */
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    @Inject(SYSTEM_DB) private readonly db: SystemDb,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  private key(): string {
    const key = getEnv().ADMIN_SECRETS_KEY;
    if (!key) throw new AppException(503, "admin_not_configured");
    return key;
  }

  private secure = () => getEnv().NODE_ENV === "production";

  /** Step one with Telegram's signed login. An unlisted or disabled account gets nothing — and isn't told why. */
  @Post("telegram")
  @HttpCode(200)
  async telegram(@Req() req: CookieRequest, @Body() body: unknown, @Res({ passthrough: true }) res: CookieResponse) {
    await this.limits.hit("adminLogin", clientAddress(req));
    this.key();
    const botToken = getEnv().TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new ServiceUnavailableException();
    const payload = telegramLoginPayloadSchema.parse(body);
    if (!checkTelegramLogin(payload, botToken, Math.floor(Date.now() / 1000)).ok) throw new UnauthorizedException();
    const admin = await findActiveAdmin(this.db, String(payload.id));
    if (!admin) throw new UnauthorizedException();
    return this.startStepTwo(admin.id, res);
  }

  /** Development only: step one as the first active owner. The code is still required. */
  @Post("dev-login")
  @HttpCode(200)
  async devLogin(@Res({ passthrough: true }) res: CookieResponse) {
    if (getEnv().NODE_ENV === "production") throw new NotFoundException();
    this.key();
    const owner = await firstActiveOwner(this.db);
    if (!owner) throw new UnauthorizedException();
    return this.startStepTwo(owner.id, res);
  }

  /** First login only: the secret for the authenticator app, as a link to show as a QR code. */
  @Post("enrol")
  @HttpCode(200)
  async enrol(@Req() req: CookieRequest) {
    await this.limits.hit("adminCode", clientAddress(req));
    const key = this.key();
    const session = await this.pending(req);
    if (session.enrolled) throw new AppException(409, "action_not_allowed");
    return beginEnrolment(this.db, session.admin.adminId, key);
  }

  /** Step two: a code from the app (or a backup code). The first time, also returns the 8 backup codes — shown once. */
  @Post("verify")
  @HttpCode(200)
  async verify(@Req() req: CookieRequest, @Body() body: unknown) {
    await this.limits.hit("adminCode", clientAddress(req));
    const key = this.key();
    const session = await this.pending(req);
    const { code } = adminCodeSchema.parse(body);
    const token = readCookie(req.headers.cookie, ADMIN_COOKIE)!;
    const outcome = await verifyCode(this.db, token, code, key);
    if (!outcome.ok) {
      await this.audit(session.admin.adminId, outcome.reason === "locked" ? "admin.login_locked" : "admin.code_wrong");
      if (outcome.lockedJustNow) {
        await queueAdminAlert(this.db, { reason: "admin_locked", adminName: session.admin.name });
      }
      if (outcome.reason === "locked") throw new AppException(429, "code_locked");
      throw new InvalidInputException({ code: "otp_invalid" });
    }
    await this.audit(session.admin.adminId, outcome.backupCodes ? "admin.two_step_set_up" : outcome.usedBackupCode ? "admin.login_backup_code" : "admin.login");
    return { ok: true, ...(outcome.backupCodes ? { backupCodes: outcome.backupCodes } : {}) };
  }

  /** Who is signed in, and how far: "pending_2fa" (with whether the app is set up) or "active". */
  @Get("me")
  async me(@Req() req: CookieRequest) {
    const token = readCookie(req.headers.cookie, ADMIN_COOKIE);
    const session = token ? await readAdminSession(this.db, token) : null;
    if (!session) throw new UnauthorizedException();
    return session.stage === "active"
      ? { stage: "active", name: session.admin.name, role: session.admin.role }
      : { stage: "pending_2fa", name: session.admin.name, enrolled: session.enrolled };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: CookieResponse) {
    const token = readCookie(req.headers.cookie, ADMIN_COOKIE);
    if (token) await revokeAdminSession(this.db, token);
    res.setHeader("Set-Cookie", clearedAdminCookie(this.secure()));
    return { ok: true };
  }

  private async startStepTwo(adminId: string, res: CookieResponse) {
    const { token, expiresAt } = await startAdminSession(this.db, adminId);
    res.setHeader("Set-Cookie", adminCookie(token, expiresAt, this.secure()));
    return { next: (await hasAuthenticator(this.db, adminId)) ? "code" : "enrol" };
  }

  private async pending(req: CookieRequest) {
    const token = readCookie(req.headers.cookie, ADMIN_COOKIE);
    const session = token ? await readAdminSession(this.db, token) : null;
    if (!session || session.stage !== "pending_2fa") throw new UnauthorizedException();
    return session;
  }

  private audit(adminId: string, action: AuditAction) {
    return writeAudit(this.db, { actorType: "admin", actorId: adminId }, { action, entity: "admin_user", entityId: adminId });
  }
}

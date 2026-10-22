import { withContext, type AppDb, type SystemDb } from "@khmio/db";
import { telegramLoginPayloadSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Post, Req, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { getEnv } from "../config";
import { APP_DB, SYSTEM_DB } from "../db";
import { findOrCreateTelegramMerchant } from "./accounts";
import { DEV_MERCHANTS } from "./dev-merchants";
import { CurrentMerchant, SessionGuard } from "./session.guard";
import { clearedSessionCookie, createSession, readCookie, revokeSession, SESSION_COOKIE, sessionCookie } from "./sessions";
import { checkTelegramLogin } from "./telegram";
import { clientAddress, RATE_LIMITER, type RateLimiter } from "../security/rate-limit";

interface CookieResponse {
  setHeader(name: string, value: string): unknown;
}
interface CookieRequest {
  headers: { cookie?: string };
  ip?: string;
}

const devLoginSchema = z.object({ as: z.enum(["a", "b", "garage"]) });

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(SYSTEM_DB) private readonly system: SystemDb,
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  /** "Log in with Telegram": checks Telegram's signature, then signs the merchant in (creating them the first time). */
  @Post("telegram")
  @HttpCode(200)
  async telegram(@Req() req: CookieRequest, @Body() body: unknown, @Res({ passthrough: true }) res: CookieResponse) {
    await this.limits.hit("sellerLogin", clientAddress(req));
    const botToken = getEnv().TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new ServiceUnavailableException();
    const payload = telegramLoginPayloadSchema.parse(body);
    if (!checkTelegramLogin(payload, botToken, Math.floor(Date.now() / 1000)).ok) throw new UnauthorizedException();
    const merchantId = await findOrCreateTelegramMerchant(this.system, {
      telegramId: String(payload.id),
      username: payload.username,
      firstName: payload.first_name,
      lastName: payload.last_name,
    });
    return this.signIn(merchantId, res);
  }

  /** Development only: Telegram's button needs a public web address, so locally you sign in as test merchant A, B or the demo garage. */
  @Post("dev-login")
  @HttpCode(200)
  async devLogin(@Body() body: unknown, @Res({ passthrough: true }) res: CookieResponse) {
    if (getEnv().NODE_ENV === "production") throw new NotFoundException();
    const { as } = devLoginSchema.parse(body);
    const merchantId = await findOrCreateTelegramMerchant(this.system, DEV_MERCHANTS[as]);
    return this.signIn(merchantId, res);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: CookieResponse) {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) await revokeSession(this.system, token);
    res.setHeader("Set-Cookie", clearedSessionCookie(getEnv().NODE_ENV === "production"));
    return { ok: true };
  }

  /** Who is signed in, and their store if they have one — read as them, under row-level security. */
  @Get("me")
  @UseGuards(SessionGuard)
  async me(@CurrentMerchant() merchantId: string) {
    const { merchant, storeIds } = await withContext(this.app, { merchantId }, async (tx) => ({
      merchant: await tx.merchant.findUniqueOrThrow({
        where: { id: merchantId },
        select: { firstName: true, lastName: true, identities: { select: { method: true, telegramUsername: true, providerUserId: true } } },
      }),
      storeIds: (await tx.storeMember.findMany({ where: { merchantId }, select: { storeId: true }, orderBy: { createdAt: "asc" } })).map((member) => member.storeId),
    }));
    const storeId = storeIds[0];
    const store = storeId
      ? await withContext(this.app, { merchantId, storeId }, (tx) =>
          tx.store.findUnique({
            where: { id: storeId },
            select: {
              id: true,
              slug: true,
              name: true,
              businessType: true,
              phone: true,
              subscription: { select: { plan: true, status: true, trialEndsAt: true } },
            },
          }),
        )
      : null;
    const telegram = merchant.identities.find((identity) => identity.method === "telegram");
    return {
      merchant: { firstName: merchant.firstName, lastName: merchant.lastName, telegramUsername: telegram?.telegramUsername ?? null, signedInWithTelegram: telegram !== undefined },
      store,
    };
  }

  private async signIn(merchantId: string, res: CookieResponse) {
    const { token, expiresAt } = await createSession(this.system, merchantId);
    res.setHeader("Set-Cookie", sessionCookie(token, expiresAt, getEnv().NODE_ENV === "production"));
    return { ok: true };
  }
}

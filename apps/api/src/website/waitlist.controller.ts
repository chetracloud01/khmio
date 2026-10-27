import type { SystemDb } from "@khmio/db";
import { toFieldErrors, waitlistRequestSchema, type WaitlistRequest } from "@khmio/shared";
import { Body, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { getEnv } from "../config";
import { SYSTEM_DB } from "../db";
import { InvalidInputException } from "../errors";
import { clientAddress, RATE_LIMITER, type RateLimiter } from "../security/rate-limit";
import { requireHuman } from "../security/turnstile";
import { captureError } from "../sentry";

interface AddressRequest {
  ip?: string;
}

export function parseWaitlistRequest(body: unknown): WaitlistRequest {
  const result = waitlistRequestSchema.safeParse(body);
  if (!result.success) throw new InvalidInputException(toFieldErrors(result.error));
  return result.data;
}

/**
 * "Tell me when it's ready" on the platform website's coming-soon pages
 * (docs/platform-launch-plan.md Stage 3). Platform data with no store_id, so
 * it goes through SystemDb. Signing up again with the same phone updates the
 * sign-up, and the answer is the same either way: it never tells a visitor
 * whether a phone is already on the list. The phone is never logged.
 */
@Controller("public/waitlist")
export class WaitlistController {
  constructor(
    @Inject(SYSTEM_DB) private readonly db: SystemDb,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  @Post()
  @HttpCode(200)
  async signUp(@Req() req: AddressRequest, @Body() body: unknown) {
    const address = clientAddress(req);
    await this.limits.hit("waitlistAddress", address);
    const { botCheck, ...signup } = parseWaitlistRequest(body);
    await this.limits.hit("waitlistPhone", signup.phone);
    await requireHuman(getEnv().TURNSTILE_SECRET_KEY, botCheck, address, () => captureError(new Error("Turnstile unreachable: a waitlist sign-up went through without the bot check")));
    await this.db.waitlistSignup.upsert({
      where: { product_phone: { product: signup.product, phone: signup.phone } },
      create: signup,
      update: { name: signup.name, businessType: signup.businessType },
    });
    return { ok: true };
  }
}

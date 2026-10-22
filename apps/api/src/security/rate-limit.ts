import type { AppDb } from "@khmio/db";
import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { getEnv } from "../config";
import { APP_DB } from "../db";

/**
 * How often each thing may be done, per key, in a fixed window. Generous on
 * purpose: many Cambodian mobile users share one address (carrier NAT), so
 * the address limits only stop floods; checkout also counts per phone, and
 * Turnstile stops bots. Wrong admin codes have their own lockout too.
 */
export const RATE_LIMITS = {
  /** Seller "Log in with Telegram", per address. */
  sellerLogin: { limit: 20, windowSeconds: 600 },
  /** Admin step one, per address. */
  adminLogin: { limit: 10, windowSeconds: 600 },
  /** Admin step two (codes and set-up), per address. */
  adminCode: { limit: 20, windowSeconds: 600 },
  /** Placing an order, per address. */
  checkoutAddress: { limit: 60, windowSeconds: 3600 },
  /** Placing an order, per buyer phone. */
  checkoutPhone: { limit: 10, windowSeconds: 3600 },
  /** A buyer's Telegram follow link or cancel, per address. */
  buyerAction: { limit: 30, windowSeconds: 3600 },
  /** "Track my order" (code + phone), per address: enough for typos, too few to guess codes. */
  trackOrder: { limit: 10, windowSeconds: 600 },
  /** A staff-group link, per shop. */
  groupLink: { limit: 10, windowSeconds: 3600 },
  /** Website waitlist sign-ups, per address. */
  waitlistAddress: { limit: 30, windowSeconds: 3600 },
  /** Website waitlist sign-ups, per phone. */
  waitlistPhone: { limit: 5, windowSeconds: 3600 },
  /** Photo uploads, per shop. */
  photoUpload: { limit: 120, windowSeconds: 3600 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

/** 429 "too_many_requests", with Retry-After in seconds (until this window ends). */
export class RateLimitedException extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("too many requests");
  }
}

/** The database keeps only a hash: no raw address or phone in the counters. */
export function bucketFor(scope: RateLimitScope, subject: string): string {
  return `${scope}:${createHash("sha256").update(`${scope}\n${subject}`).digest("hex").slice(0, 40)}`;
}

/** Seconds left in the current window (the same windows the database counts in). */
export function secondsLeftInWindow(windowSeconds: number, now = Date.now()): number {
  const nowSeconds = Math.floor(now / 1000);
  return windowSeconds - (nowSeconds % windowSeconds);
}

/** The requester's address, as Express worked it out from TRUST_PROXY_HOPS (main.ts). */
export function clientAddress(req: { ip?: string }): string {
  return req.ip ?? "unknown";
}

export const RATE_LIMITER = Symbol("RATE_LIMITER");

/** Counts in PostgreSQL (app_rate_limit_hit), so limits hold across restarts and several API copies. */
@Injectable()
export class RateLimiter {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  /** Counts one more for this key; throws RateLimitedException once over the limit. */
  async hit(scope: RateLimitScope, subject: string): Promise<void> {
    if (getEnv().RATE_LIMITS === "off") return;
    const rule = RATE_LIMITS[scope];
    const [row] = await this.app.$queryRaw<{ hits: number }[]>`SELECT app_rate_limit_hit(${bucketFor(scope, subject)}, ${rule.windowSeconds}::int) AS hits`;
    if ((row?.hits ?? 0) > rule.limit) throw new RateLimitedException(secondsLeftInWindow(rule.windowSeconds));
  }
}

export const rateLimiterProvider = { provide: RATE_LIMITER, useClass: RateLimiter };

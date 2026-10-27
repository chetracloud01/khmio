import { TELEGRAM_LOGIN_MAX_AGE_SECONDS, type TelegramLoginPayload } from "@khmio/shared";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramCheck = { ok: true } | { ok: false; reason: "bad_signature" | "expired" };

/**
 * Checks a Telegram Login Widget payload the way Telegram documents it
 * (core.telegram.org/widgets/login): every field except `hash`, sorted and
 * joined as "key=value" lines, signed with HMAC-SHA-256 whose key is the
 * SHA-256 of the bot token. Anything that fails is refused — the browser
 * could have sent anything.
 */
export function checkTelegramLogin(payload: TelegramLoginPayload, botToken: string, nowSeconds: number): TelegramCheck {
  const { hash, ...fields } = payload;
  const dataCheckString = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  // A real signature, but old: someone may be replaying a copied login.
  if (nowSeconds - payload.auth_date > TELEGRAM_LOGIN_MAX_AGE_SECONDS) return { ok: false, reason: "expired" };
  return { ok: true };
}

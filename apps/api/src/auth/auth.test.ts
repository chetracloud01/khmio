import { TELEGRAM_LOGIN_MAX_AGE_SECONDS, type TelegramLoginPayload } from "@khmio/shared";
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { toMeMerchant } from "./accounts";
import { hashToken, readCookie, sessionCookie } from "./sessions";
import { checkTelegramLogin } from "./telegram";

// A made-up bot token: the check is the same maths whatever the token.
const BOT_TOKEN = "123456789:TEST-bot-token-for-unit-tests-only_xyz";
const NOW = 1_790_000_000;

/** Signs a payload the way Telegram does, so the tests don't depend on Telegram. */
function signed(fields: Omit<TelegramLoginPayload, "hash">, token = BOT_TOKEN): TelegramLoginPayload {
  const dataCheckString = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  return { ...fields, hash: createHmac("sha256", secret).update(dataCheckString).digest("hex") };
}

const login = { id: 42, first_name: "Srey", username: "srey_neang", auth_date: NOW - 60 };

describe("Telegram login check", () => {
  it("accepts a login Telegram signed for our bot", () => {
    expect(checkTelegramLogin(signed(login), BOT_TOKEN, NOW)).toEqual({ ok: true });
  });

  it("refuses a login with any field changed", () => {
    const payload = signed(login);
    expect(checkTelegramLogin({ ...payload, id: 43 }, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_signature" });
    expect(checkTelegramLogin({ ...payload, username: "someone_else" }, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a login signed for another bot", () => {
    expect(checkTelegramLogin(signed(login, "987654321:another-bot-token-entirely_abcdef"), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a real login that is too old to trust", () => {
    const old = signed({ ...login, auth_date: NOW - TELEGRAM_LOGIN_MAX_AGE_SECONDS - 1 });
    expect(checkTelegramLogin(old, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("session cookie", () => {
  it("is invisible to page scripts, and Secure outside development", () => {
    const expires = new Date(Date.now() + 60_000);
    expect(sessionCookie("tok", expires, true)).toMatch(/^khmio_session=tok; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
    expect(sessionCookie("tok", expires, false)).not.toContain("Secure");
  });

  it("is read back from a Cookie header among others", () => {
    expect(readCookie("theme=dark; khmio_session=abc%3D; lang=km", "khmio_session")).toBe("abc=");
    expect(readCookie(undefined, "khmio_session")).toBeUndefined();
  });

  it("is stored only as a hash", () => {
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("who is signed in", () => {
  it("names their Telegram username when they signed in with Telegram", () => {
    expect(toMeMerchant({ firstName: "Sokha", lastName: "", identities: [{ method: "telegram", telegramUsername: "sokha_shop" }] })).toEqual({
      firstName: "Sokha",
      lastName: "",
      telegramUsername: "sokha_shop",
      signedInWithTelegram: true,
    });
  });

  it("says so when they didn't, so the dashboard can ask them to connect Telegram for alerts", () => {
    expect(toMeMerchant({ firstName: "Sokha", lastName: "", identities: [{ method: "phone", telegramUsername: null }] })).toMatchObject({ telegramUsername: null, signedInWithTelegram: false });
  });
});

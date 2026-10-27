import { z } from "zod";
import { AppException } from "../errors";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type BotCheckOutcome = "passed" | "failed" | "unreachable";

/** Cloudflare's answer when the token is from a person; anything else is a fail. */
const passedSchema = z.object({ success: z.literal(true) });

/** Asks Cloudflare whether this Turnstile token is from a person. Never throws. */
export async function checkTurnstile(secret: string, token: string | undefined, address: string, fetcher: typeof fetch = fetch): Promise<BotCheckOutcome> {
  if (!token) return "failed";
  try {
    const response = await fetcher(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: address }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unreachable";
    return passedSchema.safeParse(await response.json()).success ? "passed" : "failed";
  } catch {
    return "unreachable";
  }
}

/**
 * Checkout's bot check. Off when TURNSTILE_SECRET_KEY isn't set (local).
 * A token Cloudflare rejects stops the order (403 "bot_check_failed"); if
 * Cloudflare can't be reached, the order goes through — the rate limits
 * still apply — rather than every shop losing its orders for that time.
 */
export async function requireHuman(secret: string | undefined, token: string | undefined, address: string, onUnreachable: () => void): Promise<void> {
  if (!secret) return;
  const outcome = await checkTurnstile(secret, token, address);
  if (outcome === "failed") throw new AppException(403, "bot_check_failed");
  if (outcome === "unreachable") onUnreachable();
}

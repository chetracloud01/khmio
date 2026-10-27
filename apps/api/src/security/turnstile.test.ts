import { describe, expect, it, vi } from "vitest";
import { AppException } from "../errors";
import { checkTurnstile, requireHuman } from "./turnstile";

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("Cloudflare Turnstile", () => {
  it("passes only when Cloudflare says success", async () => {
    expect(await checkTurnstile("secret", "token", "1.2.3.4", answer({ success: true }))).toBe("passed");
    expect(await checkTurnstile("secret", "token", "1.2.3.4", answer({ success: false, "error-codes": ["invalid-input-response"] }))).toBe("failed");
  });

  it("fails without a token, without asking Cloudflare", async () => {
    const fetcher = answer({ success: true });
    expect(await checkTurnstile("secret", undefined, "1.2.3.4", fetcher)).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("tells an outage apart from a refusal", async () => {
    expect(await checkTurnstile("secret", "token", "1.2.3.4", answer({}, false))).toBe("unreachable");
    expect(await checkTurnstile("secret", "token", "1.2.3.4", vi.fn(async () => Promise.reject(new Error("offline"))))).toBe("unreachable");
  });

  it("is off when no secret is set", async () => {
    await expect(requireHuman(undefined, undefined, "1.2.3.4", () => undefined)).resolves.toBeUndefined();
  });

  it("refuses a checkout without a token when it is on", async () => {
    await expect(requireHuman("secret", undefined, "1.2.3.4", () => undefined)).rejects.toEqual(new AppException(403, "bot_check_failed"));
  });
});

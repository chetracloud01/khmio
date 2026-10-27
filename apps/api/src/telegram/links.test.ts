import { TELEGRAM_LINK_MINUTES } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { hashLinkCode, newLinkCode } from "./links";

describe("one-time Telegram link codes", () => {
  it("say what they're for by their first letter: g_ a staff group, f_ following an order", () => {
    expect(newLinkCode("group_link").code).toMatch(/^g_[A-Za-z0-9_-]{24}$/);
    expect(newLinkCode("order_follow").code).toMatch(/^f_[A-Za-z0-9_-]{24}$/);
  });

  it("are different every time, and only their hash is kept", () => {
    const { code, codeHash } = newLinkCode("group_link");
    expect(newLinkCode("group_link").code).not.toBe(code);
    expect(codeHash).toBe(hashLinkCode(code));
    expect(codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(codeHash).not.toContain(code);
  });

  it("stop working after the link time", () => {
    const before = Date.now();
    const { expiresAt } = newLinkCode("order_follow");
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(TELEGRAM_LINK_MINUTES * 60_000);
    expect(expiresAt.getTime() - before).toBeLessThan(TELEGRAM_LINK_MINUTES * 60_000 + 5_000);
  });
});

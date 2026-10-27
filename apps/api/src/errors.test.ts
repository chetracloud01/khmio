import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { phoneLoginSchema } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { toErrorResponse } from "./errors";
import { requestPath } from "./logger";
import { bucketFor, RateLimitedException, secondsLeftInWindow } from "./security/rate-limit";

describe("API error shape", () => {
  it("names each bad field with the codes the screens translate", () => {
    const result = phoneLoginSchema.safeParse({ phone: "12" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toErrorResponse(result.error)).toEqual({ status: 400, body: { error: "invalid_input", fields: { phone: "phone_invalid" } } });
  });

  it("gives known HTTP errors a short code", () => {
    expect(toErrorResponse(new NotFoundException())).toEqual({ status: 404, body: { error: "not_found" } });
    expect(toErrorResponse(new UnauthorizedException("token expired for user 855…"))).toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("never sends the details of an unexpected error", () => {
    expect(toErrorResponse(new Error("connection string postgresql://user:secret@db"))).toEqual({ status: 500, body: { error: "internal" } });
    expect(toErrorResponse(new ServiceUnavailableException("db down"))).toEqual({ status: 503, body: { error: "internal" } });
  });
});

describe("request logging", () => {
  it("drops the query string, which can carry a phone number or a token", () => {
    expect(requestPath("/orders/SC-1?phone=85512345678&token=abc")).toBe("/orders/SC-1");
    expect(requestPath(undefined)).toBe("");
  });

  it("never logs a buyer's order token: it opens the order page", () => {
    expect(requestPath("/public/orders/WcO4FKpyEQzgPIYP1c6a4tq163aFwz3f/cancel")).toBe("/public/orders/:token/cancel");
    expect(requestPath("/public/orders/WcO4FKpyEQzgPIYP1c6a4tq163aFwz3f")).toBe("/public/orders/:token");
  });
});

describe("rate limits", () => {
  it("answers 429 with how long to wait", () => {
    expect(toErrorResponse(new RateLimitedException(42))).toEqual({ status: 429, body: { error: "too_many_requests" }, headers: { "Retry-After": "42" } });
  });

  it("waits only until the window ends", () => {
    expect(secondsLeftInWindow(600, 1_200_000)).toBe(600);
    expect(secondsLeftInWindow(600, 1_500_000)).toBe(300);
  });

  it("keeps only a hash of the address or phone, separate per scope", () => {
    const bucket = bucketFor("checkoutPhone", "85512345678");
    expect(bucket).toMatch(/^checkoutPhone:[0-9a-f]{40}$/);
    expect(bucket).not.toContain("12345678");
    expect(bucketFor("sellerLogin", "85512345678").split(":")[1]).not.toBe(bucket.split(":")[1]);
  });
});

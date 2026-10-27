import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, decryptSecret, encryptSecret, matchTotp, newBackupCodes, newTotpSecret, normalizeBackupCode, otpauthUri, totpCode, totpStep } from "./totp";

// RFC 6238 Appendix B, SHA-1: the secret is the ASCII bytes "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("totpCode", () => {
  it("matches every SHA-1 test value in RFC 6238", () => {
    for (const [seconds, expected] of RFC_VECTORS) expect(totpCode(RFC_SECRET, Math.floor(seconds / 30), 8)).toBe(expected);
  });

  it("gives the app's 6 digits — the last 6 of the RFC's 8", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
  });
});

describe("base32", () => {
  it("round-trips any bytes", () => {
    const bytes = randomBytes(20);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("matchTotp", () => {
  const secret = newTotpSecret();
  const now = Date.UTC(2026, 9, 2, 3, 0, 15);
  const step = totpStep(now);

  it("accepts the current code and one step either side", () => {
    expect(matchTotp(secret, totpCode(secret, step), now, 0)).toBe(step);
    expect(matchTotp(secret, totpCode(secret, step - 1), now, 0)).toBe(step - 1);
    expect(matchTotp(secret, totpCode(secret, step + 1), now, 0)).toBe(step + 1);
  });

  it("refuses an older code, a wrong one, and any code already used", () => {
    expect(matchTotp(secret, totpCode(secret, step - 2), now, 0)).toBeNull();
    expect(matchTotp(secret, "000000", now, 0) === null || totpCode(secret, step) === "000000").toBe(true);
    expect(matchTotp(secret, totpCode(secret, step), now, step)).toBeNull();
    expect(matchTotp(secret, totpCode(secret, step - 1), now, step - 1)).toBeNull();
  });
});

describe("secret encryption", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips, and differs every time", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(decryptSecret(a, key)).toBe("JBSWY3DPEHPK3PXP");
    expect(encryptSecret("JBSWY3DPEHPK3PXP", key)).not.toBe(a);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
  });

  it("refuses the wrong key and a tampered value", () => {
    const sealed = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(() => decryptSecret(sealed, randomBytes(32).toString("base64"))).toThrow();
    const [iv, tag, data] = sealed.split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64url")].join("."), key)).toThrow();
  });
});

describe("backup codes and the app link", () => {
  it("makes 8 different readable codes", () => {
    const codes = newBackupCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeBackupCode(" ab2c-d3ef ")).toBe("AB2CD3EF");
  });

  it("builds the otpauth link the apps scan", () => {
    expect(otpauthUri("JBSWY3DPEHPK3PXP", "Chetra")).toBe(
      "otpauth://totp/Khmio%20Admin%3AChetra?secret=JBSWY3DPEHPK3PXP&issuer=Khmio%20Admin&algorithm=SHA1&digits=6&period=30",
    );
  });
});

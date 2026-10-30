import { describe, expect, it } from "vitest";
import { InvalidInputException } from "../errors";
import { parseWaitlistRequest } from "./waitlist.controller";

describe("waitlist sign-up input", () => {
  it("saves the phone the one way every phone is saved", () => {
    const request = parseWaitlistRequest({ product: "class", name: " Dara ", phone: "012 345 678", businessType: "teacher", botCheck: "token" });
    expect(request).toEqual({ product: "class", name: "Dara", phone: "85512345678", businessType: "teacher", botCheck: "token" });
  });

  it("answers with the field that's wrong", () => {
    try {
      parseWaitlistRequest({ product: "class", name: "D", phone: "123", businessType: "farmer" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInputException);
      expect((error as InvalidInputException).fields).toEqual({ name: "too_short", phone: "phone_invalid", businessType: "required" });
    }
  });

  it("refuses a product the platform doesn't have", () => {
    expect(() => parseWaitlistRequest({ product: "cinema", name: "Dara", phone: "012345678", businessType: "other" })).toThrow(InvalidInputException);
  });

  it("takes a sign-up for a coming-soon business solution (Khmio Shop, that business)", () => {
    expect(parseWaitlistRequest({ product: "shop", name: "Sophea", phone: "097 123 4567", businessType: "cafe" })).toMatchObject({ product: "shop", businessType: "cafe" });
    expect(parseWaitlistRequest({ product: "shop", name: "Sophea", phone: "097 123 4567", businessType: "auto_parts" })).toMatchObject({ businessType: "auto_parts" });
  });

  it("refuses a business the website doesn't list", () => {
    expect(() => parseWaitlistRequest({ product: "shop", name: "Sophea", phone: "097 123 4567", businessType: "cinema" })).toThrow(InvalidInputException);
  });
});

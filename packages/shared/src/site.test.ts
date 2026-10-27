import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import { isPromotionLive, picturesUsedIn, promotionTiming, siteLinkSchema, sitePictureDetailsSchema, siteSectionSchema, visibleSections, waitlistSignupSchema } from "./site";

const text = (km: string, en: string) => ({ km, en });

const promotion = {
  id: "promo-1",
  visible: true,
  type: "promotion" as const,
  title: text("ខែដំបូងឥតគិតថ្លៃ", "First month free"),
  line: text("សម្រាប់ហាងថ្មី", "For new shops"),
  startsAt: "2026-11-01T00:00:00+07:00",
  endsAt: "2026-12-01T00:00:00+07:00",
};

describe("site content", () => {
  it("needs both languages", () => {
    const result = siteSectionSchema.safeParse({ ...promotion, title: text("", "First month free") });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)["title.km"]).toBe("required");
  });

  it("takes only site pages and https links", () => {
    const link = (href: string) => siteLinkSchema.safeParse({ label: text("មើល", "See"), href }).success;
    expect(link("/pricing")).toBe(true);
    expect(link("/products/shop")).toBe(true);
    expect(link("https://t.me/khmio")).toBe(true);
    expect(link("#waitlist")).toBe(true);
    expect(link("#<script>")).toBe(false);
    expect(link("http://example.com")).toBe(false);
    expect(link("javascript:alert(1)")).toBe(false);
    expect(link("//evil.example")).toBe(false);
  });

  it("refuses a promotion that ends before it starts", () => {
    const result = siteSectionSchema.safeParse({ ...promotion, endsAt: "2026-10-01T00:00:00+07:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).endsAt).toBe("ends_before_start");
  });

  it("shows a promotion only while it runs", () => {
    expect(isPromotionLive(promotion, new Date("2026-10-31T23:59:59+07:00"))).toBe(false);
    expect(isPromotionLive(promotion, new Date("2026-11-01T00:00:00+07:00"))).toBe(true);
    expect(isPromotionLive(promotion, new Date("2026-12-01T00:00:00+07:00"))).toBe(false);
  });

  it("tells scheduled, showing and ended promotions apart", () => {
    expect(promotionTiming(promotion, new Date("2026-10-15T12:00:00+07:00"))).toBe("scheduled");
    expect(promotionTiming(promotion, new Date("2026-11-15T12:00:00+07:00"))).toBe("showing");
    expect(promotionTiming(promotion, new Date("2026-12-01T00:00:00+07:00"))).toBe("ended");
  });

  it("leaves out switched-off sections and promotions that aren't running", () => {
    const closing = { id: "end", visible: false, type: "closing" as const, headline: text("ចាប់ផ្តើម", "Start"), line: text("ឥតគិតថ្លៃ", "Free"), button: { label: text("ចាប់ផ្តើម", "Start"), href: "/" } };
    const page = { sections: [promotion, closing] };
    expect(visibleSections(page, new Date("2026-11-15T12:00:00+07:00")).map((s) => s.id)).toEqual(["promo-1"]);
    expect(visibleSections(page, new Date("2027-01-01T12:00:00+07:00"))).toEqual([]);
  });

  it("checks a waitlist sign-up and saves the phone in one form", () => {
    const ok = waitlistSignupSchema.safeParse({ product: "class", name: "Dara", phone: "012 345 678", businessType: "teacher" });
    expect(ok.success && ok.data.phone).toBe("85512345678");
    const bad = waitlistSignupSchema.safeParse({ product: "class", name: "D", phone: "123", businessType: undefined });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(toFieldErrors(bad.error)).toEqual({ name: "too_short", phone: "phone_invalid", businessType: "required" });
  });
  it("finds the library pictures a page uses, deep in its sections and link preview", () => {
    const page = {
      seo: { title: text("ក", "A"), description: text("ខ", "B"), image: { src: "library:cover", alt: text("គ", "C") } },
      sections: [
        { ...promotion, image: { src: "library:promo", alt: text("ឃ", "D") } },
        { id: "f", visible: true, type: "features" as const, title: text("ង", "E"), features: [{ icon: "qr" as const, title: text("ច", "F"), line: text("ឆ", "G"), image: { src: "/site/shop/khqr.jpg", alt: text("ជ", "H") } }, { icon: "bell" as const, title: text("ឈ", "I"), line: text("ញ", "J"), image: { src: "library:alert", alt: text("ដ", "K") } }] },
      ],
    };
    expect([...picturesUsedIn(page)].sort()).toEqual(["alert", "cover", "promo"]);
  });

  it("needs a picture description in both languages", () => {
    const result = sitePictureDetailsSchema.safeParse({ alt: text("រូបថតហាង", "") });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)).toEqual({ "alt.en": "required" });
  });
});

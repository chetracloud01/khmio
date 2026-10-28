import type { Currency } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { detectPhotoType, isStorePhotoKey, newPhotoKey } from "../files/photos";
import { photoUrl, productRow } from "../testing/rows";
import { firstFreeSku, suggestSku, toProductDto } from "./products";

const STORE = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

describe("photo checks", () => {
  it("knows a JPEG, PNG or WebP by its bytes, whatever it's called", () => {
    expect(detectPhotoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(detectPhotoType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectPhotoType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]))).toBe("image/webp");
  });

  it("refuses anything else, including a script renamed to .jpg", () => {
    expect(detectPhotoType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(detectPhotoType(Buffer.from("GIF89a"))).toBeNull();
    expect(detectPhotoType(Buffer.alloc(0))).toBeNull();
  });

  it("keeps each store's photos in its own folder, and refuses another store's", () => {
    const key = newPhotoKey(STORE, "image/webp");
    expect(key).toMatch(new RegExp(`^stores/${STORE}/[0-9a-f-]{36}\\.webp$`));
    expect(isStorePhotoKey(STORE, key)).toBe(true);
    expect(isStorePhotoKey(OTHER, key)).toBe(false);
    expect(isStorePhotoKey(STORE, `stores/${STORE}/../${OTHER}/x.webp`)).toBe(false);
    expect(isStorePhotoKey(STORE, "https://evil.example/photo.jpg")).toBe(false);
  });
});

describe("SKUs", () => {
  it("are made from the English title and the option name", () => {
    expect(suggestSku("Iced Coffee", "កាហ្វេទឹកកក", "Large")).toBe("ICED-COFFEE-LARGE");
    expect(suggestSku("Croissant", "ក្រូឆ្សង់")).toBe("CROISSANT");
  });

  it("still work for a Khmer-only title", () => {
    expect(suggestSku("", "កាហ្វេទឹកកក")).toBe("ITEM");
    expect(suggestSku("", "កាហ្វេទឹកកក", "M")).toBe("ITEM-M");
  });

  it("never repeat one already used in the store", () => {
    expect(firstFreeSku("ITEM", new Set())).toBe("ITEM");
    expect(firstFreeSku("ITEM", new Set(["ITEM", "ITEM-2"]))).toBe("ITEM-3");
  });
});

describe("a product as the seller sees it", () => {
  it("shows wholesale prices only on plans that have them", () => {
    expect(toProductDto(productRow(), photoUrl, true).variants[0]).toMatchObject({ wholesalePriceUsdCents: 180 });
    expect(toProductDto(productRow(), photoUrl, false).variants[0]).not.toHaveProperty("wholesalePriceUsdCents");
  });

  it("sends cost prices to the seller only, never to the shop page", () => {
    const costCurrency: Currency = "USD";
    const row = productRow({ variants: productRow().variants.map((variant) => ({ ...variant, costMinor: 120, costCurrency })) });
    expect(toProductDto(row, photoUrl, false, true).variants[0]).toMatchObject({ costMinor: 120, costCurrency: "USD" });
    expect(toProductDto(row, photoUrl).variants[0]).not.toHaveProperty("costMinor");
    expect(JSON.stringify(toProductDto(row, photoUrl, true))).not.toContain("cost");
  });

  it("gives each photo its address and its small copy's, and says whether it has options", () => {
    const dto = toProductDto(productRow(), photoUrl);
    expect(dto.photos[0]).toMatchObject({ key: "stores/store-1/photo.jpg", url: "https://files.test/stores/store-1/photo.jpg" });
    expect(dto.photos[0]?.thumbUrl).not.toBe(dto.photos[0]?.url);
    expect(dto.hasOptions).toBe(false);
  });
});

describe("a product with option groups", () => {
  const AT = new Date("2026-10-27T03:00:00Z");
  const group = (id: string, kind: "variant" | "choice", values: { id: string; labelEn: string; extraUsdCents?: number }[], sortOrder: number) => ({
    id,
    storeId: "store-1",
    productId: "product-1",
    kind,
    nameKm: id,
    nameEn: id,
    pick: "one" as const,
    required: kind === "choice",
    sortOrder,
    createdAt: AT,
    updatedAt: AT,
    values: values.map((value, index) => ({ id: value.id, storeId: "store-1", groupId: id, labelKm: value.labelEn, labelEn: value.labelEn, extraUsdCents: value.extraUsdCents ?? null, extraKhr: null, sortOrder: index, createdAt: AT })),
  });
  const base = productRow();
  const variant = { ...base.variants[0]!, isDefault: false, labelEn: "M · Red", values: [{ valueId: "red" }, { valueId: "m" }] };
  const row = productRow({
    variants: [variant],
    optionGroups: [group("Size", "variant", [{ id: "m", labelEn: "M" }], 0), group("Colour", "variant", [{ id: "red", labelEn: "Red" }], 1), group("Sugar", "choice", [{ id: "less", labelEn: "Less", extraUsdCents: 0 }], 2)],
  });

  it("sends its variant groups, and each variant's values in the groups' order", () => {
    const dto = toProductDto(row, photoUrl);
    expect(dto.variantGroups.map((entry) => entry.id)).toEqual(["Size", "Colour"]);
    expect(dto.variants[0]?.valueIds).toEqual(["m", "red"]);
  });

  it("sends its choice groups with their rules and extra prices", () => {
    expect(toProductDto(row, photoUrl).choiceGroups).toEqual([
      { id: "Sugar", nameKm: "Sugar", nameEn: "Sugar", pick: "one", required: true, values: [{ id: "less", labelKm: "Less", labelEn: "Less", extraUsdCents: 0, extraKhr: null }] },
    ]);
  });
});

import type { ProductRow } from "../products/products";

// Database rows for tests of the mappers (what leaves the API), built with
// every column filled so a test names only what it's about.

const AT = new Date("2026-10-01T03:00:00Z");

export function productRow(overrides: Partial<ProductRow> = {}): ProductRow {
  const id = overrides.id ?? "product-1";
  return {
    id,
    storeId: "store-1",
    categoryId: "category-1",
    brandId: null,
    unitId: null,
    titleKm: "កាហ្វេ",
    titleEn: "Coffee",
    descriptionKm: "",
    descriptionEn: "",
    discountPercent: null,
    isVisible: true,
    kind: "item",
    customValues: {},
    deletedAt: null,
    createdAt: AT,
    updatedAt: AT,
    photos: [{ id: "photo-1", storeId: "store-1", productId: id, fileKey: "stores/store-1/photo.jpg", sortOrder: 0, createdAt: AT }],
    variants: [
      {
        id: "variant-1",
        storeId: "store-1",
        productId: id,
        sku: "COFFEE",
        labelKm: "",
        labelEn: "",
        isDefault: true,
        priceUsdCents: 250,
        priceKhr: null,
        wholesalePriceUsdCents: 180,
        wholesalePriceKhr: null,
        sortOrder: 0,
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT,
        values: [],
      },
    ],
    optionGroups: [],
    ...overrides,
  };
}

/** A photo key's public address, as the file storage would give it. */
export const photoUrl = (key: string) => `https://files.test/${key}`;

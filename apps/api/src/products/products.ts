import type { Prisma, Tx } from "@khmio/db";
import { canAddProduct, planHasFeature, productSaveSchema, slugify, toFieldErrors, type FormErrorCode, type PlanId, type ProductSave } from "@khmio/shared";
import { AppException, InvalidInputException } from "../errors";
import { isStorePhotoKey, thumbKeyOf } from "../files/photos";
import { storePlan } from "../merchant/plan";

// Saving and reading products. Every function here runs inside the store's
// own context (withContext), so row-level security already limits it to
// this store; the checks below are about the product itself.

export const productInclude = {
  variants: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  photos: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductInclude;
export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** A product as the dashboard and the shop page see it. Wholesale prices are left out unless the plan has them. */
export function toProductDto(product: ProductRow, photoUrl: (key: string) => string, showWholesale = false) {
  return {
    id: product.id,
    titleKm: product.titleKm,
    titleEn: product.titleEn,
    descriptionKm: product.descriptionKm,
    descriptionEn: product.descriptionEn,
    categoryId: product.categoryId,
    brandId: product.brandId,
    unitId: product.unitId,
    discountPercent: product.discountPercent,
    isVisible: product.isVisible,
    photos: product.photos.map((photo) => ({ key: photo.fileKey, url: photoUrl(photo.fileKey), thumbUrl: photoUrl(thumbKeyOf(photo.fileKey)) })),
    hasOptions: !product.variants.some((variant) => variant.isDefault),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      labelKm: variant.labelKm,
      labelEn: variant.labelEn,
      priceUsdCents: variant.priceUsdCents,
      priceKhr: variant.priceKhr,
      ...(showWholesale ? { wholesalePriceUsdCents: variant.wholesalePriceUsdCents, wholesalePriceKhr: variant.wholesalePriceKhr } : {}),
    })),
  };
}

/**
 * Checks a save request. Field names in the answer match the product form's
 * own (`retailPrice`, `options.0.sku`, `photoKeys.1`) — no "product." prefix —
 * so the form shows the API's problems exactly where it shows its own.
 */
export function parseProductSave(body: unknown): ProductSave {
  const result = productSaveSchema.safeParse(body);
  if (result.success) return result.data;
  const fields = Object.fromEntries(Object.entries(toFieldErrors(result.error)).map(([key, code]) => [key.replace(/^product\./, ""), code]));
  throw new InvalidInputException(fields);
}

/** "ICED-COFFEE-LARGE": from the English title (or Khmer, or "ITEM") and the option name. */
export function suggestSku(titleEn: string, titleKm: string, label = ""): string {
  const base = slugify(titleEn) || slugify(titleKm) || "item";
  const option = slugify(label);
  return (option ? `${base}-${option}` : base).slice(0, 36).replace(/-+$/, "").toUpperCase();
}

/** The first of BASE, BASE-2, BASE-3… not already taken. */
export function firstFreeSku(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

interface VariantPlan {
  id?: string;
  sku: string;
  labelKm: string;
  labelEn: string;
  isDefault: boolean;
  priceUsdCents: number | null;
  priceKhr: number | null;
  wholesalePriceUsdCents: number | null;
  wholesalePriceKhr: number | null;
  sortOrder: number;
}

/**
 * Creates or updates one product with its variants and photos, all or
 * nothing. `existingId` = editing. Returns the product's id.
 */
export async function saveProduct(tx: Tx, storeId: string, plan: PlanId, input: ProductSave, existingId?: string): Promise<string> {
  const { product, photoKeys } = input;
  const errors: Record<string, FormErrorCode> = {};

  // The category, brand and unit must be this store's own (row-level security hides any other store's).
  const [category, brand, unit] = await Promise.all([
    tx.category.findFirst({ where: { id: product.categoryId }, select: { id: true } }).catch(() => null),
    product.brandId ? tx.brand.findFirst({ where: { id: product.brandId }, select: { id: true } }).catch(() => null) : null,
    product.uomId ? tx.unit.findFirst({ where: { id: product.uomId }, select: { id: true } }).catch(() => null) : null,
  ]);
  if (!category) errors.categoryId = "required";
  if (product.brandId && !brand) errors.brandId = "required";
  if (product.uomId && !unit) errors.uomId = "required";
  photoKeys.forEach((key, index) => {
    if (!isStorePhotoKey(storeId, key)) errors[`photoKeys.${index}`] = "photo_required";
  });

  const existing = existingId
    ? await tx.product.findFirst({ where: { id: existingId, deletedAt: null }, include: { variants: { where: { deletedAt: null } } } })
    : null;
  if (existingId && !existing) throw new AppException(404, "no_store");
  if (!existingId) {
    const count = await tx.product.count({ where: { deletedAt: null } });
    if (!canAddProduct(plan, count)) throw new AppException(403, "plan_limit");
  }

  // Wholesale prices are a Pro feature: on a lower plan they're kept as they were, never cleared.
  const canWholesale = planHasFeature(plan, "wholesalePrice");
  const keptWholesale = (variantId?: string) => {
    const old = existing?.variants.find((variant) => variant.id === variantId);
    return { wholesalePriceUsdCents: old?.wholesalePriceUsdCents ?? null, wholesalePriceKhr: old?.wholesalePriceKhr ?? null };
  };
  const ownVariantIds = new Set(existing?.variants.map((variant) => variant.id));

  // SKUs already used by the store's other products.
  const takenElsewhere = new Set(
    (await tx.productVariant.findMany({ where: { deletedAt: null, ...(existingId ? { productId: { not: existingId } } : {}) }, select: { sku: true } })).map(
      (variant) => variant.sku.toUpperCase(),
    ),
  );
  const usedHere = new Set<string>();
  const skuFor = (given: string, label: string, index: number): string => {
    const wanted = given.trim().toUpperCase();
    if (wanted) {
      if (takenElsewhere.has(wanted)) errors[`options.${index}.sku`] = "sku_duplicate";
      usedHere.add(wanted);
      return wanted;
    }
    const sku = firstFreeSku(suggestSku(product.titleEn, product.titleKm, label), new Set([...takenElsewhere, ...usedHere]));
    usedHere.add(sku);
    return sku;
  };

  let variants: VariantPlan[];
  if (product.options?.length) {
    variants = product.options.map((option, index) => {
      const id = ownVariantIds.has(option.id) ? option.id : undefined;
      return {
        id,
        sku: skuFor(option.sku, option.labelEn || option.labelKm, index),
        labelKm: option.labelKm || option.labelEn,
        labelEn: option.labelEn || option.labelKm,
        isDefault: false,
        priceUsdCents: option.retailPriceUsdCents ?? null,
        priceKhr: option.retailPriceKhr ?? null,
        ...(canWholesale
          ? { wholesalePriceUsdCents: option.wholesalePriceUsdCents ?? null, wholesalePriceKhr: option.wholesalePriceKhr ?? null }
          : keptWholesale(id)),
        sortOrder: index,
      };
    });
  } else {
    // No options: one hidden default variant carries the price.
    const current = existing?.variants.find((variant) => variant.isDefault);
    variants = [
      {
        id: current?.id,
        sku: current?.sku ?? skuFor("", "", 0),
        labelKm: "",
        labelEn: "",
        isDefault: true,
        priceUsdCents: product.retailPriceUsdCents ?? null,
        priceKhr: product.retailPriceKhr ?? null,
        ...(canWholesale
          ? { wholesalePriceUsdCents: product.wholesalePriceUsdCents ?? null, wholesalePriceKhr: product.wholesalePriceKhr ?? null }
          : keptWholesale(current?.id)),
        sortOrder: 0,
      },
    ];
  }

  if (Object.keys(errors).length > 0) throw new InvalidInputException(errors);

  const fields = {
    categoryId: product.categoryId,
    brandId: product.brandId ?? null,
    unitId: product.uomId ?? null,
    titleKm: product.titleKm,
    titleEn: product.titleEn || product.titleKm,
    descriptionKm: product.descriptionKm,
    descriptionEn: product.descriptionEn,
    discountPercent: product.discountPercent || null,
    isVisible: product.isVisible,
  };
  const productId = existing
    ? (await tx.product.update({ where: { id: existing.id }, data: fields })).id
    : (await tx.product.create({ data: { storeId, ...fields } })).id;

  // Variants: options removed in the form are soft-deleted (old orders still point at them); the rest updated or added.
  const keep = new Set(variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
  const removed = (existing?.variants ?? []).filter((variant) => !keep.has(variant.id)).map((variant) => variant.id);
  if (removed.length) await tx.productVariant.updateMany({ where: { id: { in: removed } }, data: { deletedAt: new Date() } });
  for (const { id, ...variant } of variants) {
    if (id) await tx.productVariant.update({ where: { id }, data: variant });
    else await tx.productVariant.create({ data: { storeId, productId, ...variant } });
  }

  // Photos: replaced in the order the seller arranged them; the first is the cover.
  await tx.productPhoto.deleteMany({ where: { productId } });
  if (photoKeys.length) {
    await tx.productPhoto.createMany({ data: photoKeys.map((fileKey, sortOrder) => ({ storeId, productId, fileKey, sortOrder })) });
  }
  return productId;
}

/** The seller's products; wholesale prices only on plans that have them. */
export async function readProducts(tx: Tx, storeId: string, photoUrl: (key: string) => string) {
  const { plan } = await storePlan(tx, storeId);
  const products = await tx.product.findMany({ where: { deletedAt: null }, include: productInclude, orderBy: { createdAt: "desc" } });
  return products.map((product) => toProductDto(product, photoUrl, planHasFeature(plan, "wholesalePrice")));
}

/** One of the seller's products, or null when there's no such product. */
export async function readProduct(tx: Tx, storeId: string, id: string, photoUrl: (key: string) => string) {
  const { plan } = await storePlan(tx, storeId);
  const product = await tx.product.findFirst({ where: { id, deletedAt: null }, include: productInclude });
  return product ? toProductDto(product, photoUrl, planHasFeature(plan, "wholesalePrice")) : null;
}

export async function productExists(tx: Tx, id: string): Promise<boolean> {
  return (await tx.product.findFirst({ where: { id, deletedAt: null }, select: { id: true } })) !== null;
}

/** The "Show in shop" switch; false when there's no such product. */
export async function setProductVisibility(tx: Tx, id: string, isVisible: boolean): Promise<boolean> {
  const { count } = await tx.product.updateMany({ where: { id, deletedAt: null }, data: { isVisible } });
  return count > 0;
}

/** Soft delete: the product and its options leave the dashboard and the shop; old orders keep pointing at them. False when there's no such product. */
export async function deleteProduct(tx: Tx, id: string, now = new Date()): Promise<boolean> {
  const { count } = await tx.product.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now } });
  if (count === 0) return false;
  await tx.productVariant.updateMany({ where: { productId: id, deletedAt: null }, data: { deletedAt: now } });
  return true;
}

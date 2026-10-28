import type { Prisma, Tx } from "@khmio/db";
import {
  canAddProduct,
  hasModule,
  planHasFeature,
  productSaveSchema,
  slugify,
  toFieldErrors,
  variantLabel,
  type ChoiceGroupInput,
  type Currency,
  type FormErrorCode,
  type PlanId,
  type ProductSave,
  type VariantGroupInput,
} from "@khmio/shared";
import { AppException, InvalidInputException } from "../errors";
import { isStorePhotoKey, thumbKeyOf } from "../files/photos";
import { storePlan } from "../merchant/plan";
import { checkCustomValues, readCustomFields, readCustomValues } from "../custom-fields/custom-fields";
import { readStoreModules } from "../modules/modules";

// Saving and reading products. Every function here runs inside the store's
// own context (withContext), so row-level security already limits it to
// this store; the checks below are about the product itself.

export const productInclude = {
  variants: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { values: { select: { valueId: true } } } },
  photos: { orderBy: { sortOrder: "asc" } },
  optionGroups: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
} satisfies Prisma.ProductInclude;
export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * A product as the dashboard and the shop page see it. Wholesale prices are
 * left out unless the plan has them; cost prices unless it's for the seller.
 */
export function toProductDto(product: ProductRow, photoUrl: (key: string) => string, showWholesale = false, forSeller = false) {
  const variantGroups = product.optionGroups.filter((group) => group.kind === "variant");
  // A variant's values in its groups' order: [size, colour].
  const valueOrder = new Map(variantGroups.flatMap((group, at) => group.values.map((value) => [value.id, at] as const)));
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
    kind: product.kind,
    /** The shop's own fields; the shop page keeps only the public ones (public-shop.ts). */
    customValues: readCustomValues(product.customValues),
    photos: product.photos.map((photo) => ({ key: photo.fileKey, url: photoUrl(photo.fileKey), thumbUrl: photoUrl(thumbKeyOf(photo.fileKey)) })),
    hasOptions: !product.variants.some((variant) => variant.isDefault),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      labelKm: variant.labelKm,
      labelEn: variant.labelEn,
      valueIds: variant.values
        .map((link) => link.valueId)
        .filter((id) => valueOrder.has(id))
        .sort((a, b) => (valueOrder.get(a) ?? 0) - (valueOrder.get(b) ?? 0)),
      priceUsdCents: variant.priceUsdCents,
      priceKhr: variant.priceKhr,
      ...(showWholesale ? { wholesalePriceUsdCents: variant.wholesalePriceUsdCents, wholesalePriceKhr: variant.wholesalePriceKhr } : {}),
      // What it costs the shop: the seller's own pages only, never the shop page.
      ...(forSeller ? { costMinor: variant.costMinor, costCurrency: variant.costCurrency } : {}),
    })),
    variantGroups: variantGroups.map((group) => ({
      id: group.id,
      nameKm: group.nameKm,
      nameEn: group.nameEn,
      values: group.values.map((value) => ({ id: value.id, labelKm: value.labelKm, labelEn: value.labelEn })),
    })),
    choiceGroups: product.optionGroups
      .filter((group) => group.kind === "choice")
      .map((group) => ({
        id: group.id,
        nameKm: group.nameKm,
        nameEn: group.nameEn,
        pick: group.pick,
        required: group.required,
        values: group.values.map((value) => ({ id: value.id, labelKm: value.labelKm, labelEn: value.labelEn, extraUsdCents: value.extraUsdCents, extraKhr: value.extraKhr })),
      })),
  };
}

type StoredGroup = Prisma.ProductOptionGroupGetPayload<{ include: { values: true } }>;

/** Either kind of group, as saved: a variant group picks one, needs nothing and adds no price. */
interface GroupToSave {
  id: string;
  nameKm: string;
  nameEn: string;
  pick: "one" | "many";
  required: boolean;
  values: { id: string; labelKm: string; labelEn: string; extraUsdCents: number | null; extraKhr: number | null }[];
}
const variantGroupToSave = (group: VariantGroupInput): GroupToSave => ({
  ...group,
  pick: "one",
  required: false,
  values: group.values.map((value) => ({ ...value, extraUsdCents: null, extraKhr: null })),
});
const choiceGroupToSave = (group: ChoiceGroupInput): GroupToSave => ({
  ...group,
  values: group.values.map((value) => ({ ...value, extraUsdCents: value.extraUsdCents ?? null, extraKhr: value.extraKhr ?? null })),
});

/**
 * Saves one kind of a product's option groups as the form sent them: groups
 * and values it already has keep their ids (a buyer's cart may hold them),
 * new ones are added, the rest removed. Returns form value id → saved id.
 */
async function saveOptionGroups(
  tx: Tx,
  where: { storeId: string; productId: string; kind: "variant" | "choice" },
  groups: GroupToSave[],
  stored: StoredGroup[],
): Promise<Map<string, string>> {
  const savedIds = new Map<string, string>();
  const keptGroups: string[] = [];
  for (const [groupOrder, group] of groups.entries()) {
    const old = stored.find((entry) => entry.id === group.id && entry.kind === where.kind);
    const data = { nameKm: group.nameKm || group.nameEn, nameEn: group.nameEn || group.nameKm, pick: group.pick, required: group.required, sortOrder: groupOrder };
    const groupId = old
      ? (await tx.productOptionGroup.update({ where: { id: old.id }, data, select: { id: true } })).id
      : (await tx.productOptionGroup.create({ data: { storeId: where.storeId, productId: where.productId, kind: where.kind, ...data }, select: { id: true } })).id;
    keptGroups.push(groupId);
    const keptValues: string[] = [];
    for (const [valueOrder, value] of group.values.entries()) {
      const valueData = { labelKm: value.labelKm || value.labelEn, labelEn: value.labelEn || value.labelKm, sortOrder: valueOrder, extraUsdCents: value.extraUsdCents, extraKhr: value.extraKhr };
      const kept = old?.values.some((entry) => entry.id === value.id);
      const valueId = kept
        ? (await tx.productOptionValue.update({ where: { id: value.id }, data: valueData, select: { id: true } })).id
        : (await tx.productOptionValue.create({ data: { storeId: where.storeId, groupId, ...valueData }, select: { id: true } })).id;
      savedIds.set(value.id, valueId);
      keptValues.push(valueId);
    }
    await tx.productOptionValue.deleteMany({ where: { groupId, id: { notIn: keptValues } } });
  }
  await tx.productOptionGroup.deleteMany({ where: { productId: where.productId, kind: where.kind, id: { notIn: keptGroups } } });
  return savedIds;
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
  /** The form's value ids, one per variant group; undefined = leave its links as they are. */
  valueIds?: string[];
  sku: string;
  labelKm: string;
  labelEn: string;
  isDefault: boolean;
  priceUsdCents: number | null;
  priceKhr: number | null;
  wholesalePriceUsdCents: number | null;
  wholesalePriceKhr: number | null;
  costMinor: number | null;
  costCurrency: Currency | null;
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

  // Option groups need their module (Features); switched off, what the product has is kept as it is.
  const modules = await readStoreModules(tx, storeId);
  const optionsOn = hasModule(modules, "options");
  const choicesOn = hasModule(modules, "choices");
  const servicesOn = hasModule(modules, "services");
  if ((!optionsOn && product.variantGroups.length) || (!choicesOn && product.choiceGroups.length) || (!servicesOn && product.kind === "service")) {
    throw new AppException(403, "module_off");
  }
  const variantGroups = optionsOn ? product.variantGroups : [];
  const storedGroups = existing ? await tx.productOptionGroup.findMany({ where: { productId: existing.id }, include: { values: true } }) : [];
  const labelOf = (valueIds: string[] | undefined, language: "km" | "en") => (variantGroups.length && valueIds ? variantLabel(variantGroups, valueIds, language) : "");
  // The shop's own fields, checked against its product fields; switched off, the values stay as they are.
  const customValues = hasModule(modules, "customFields") ? checkCustomValues(await readCustomFields(tx, "product"), product.customValues) : undefined;
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

  // One cost currency for the whole product (the schema requires it once a cost is given); no amount = no currency.
  const costOf = (costMinor: number | undefined) =>
    costMinor !== undefined && product.costCurrency ? { costMinor, costCurrency: product.costCurrency } : { costMinor: null, costCurrency: null };

  let variants: VariantPlan[];
  if (product.options?.length) {
    variants = product.options.map((option, index) => {
      const id = ownVariantIds.has(option.id) ? option.id : undefined;
      // With variant groups the name comes from the values ("M · Red"); otherwise it's typed.
      const labelKm = labelOf(option.valueIds, "km") || option.labelKm || option.labelEn;
      const labelEn = labelOf(option.valueIds, "en") || option.labelEn || option.labelKm;
      return {
        id,
        valueIds: variantGroups.length ? (option.valueIds ?? []) : undefined,
        sku: skuFor(option.sku, labelEn, index),
        labelKm,
        labelEn,
        isDefault: false,
        priceUsdCents: option.retailPriceUsdCents ?? null,
        priceKhr: option.retailPriceKhr ?? null,
        ...(canWholesale
          ? { wholesalePriceUsdCents: option.wholesalePriceUsdCents ?? null, wholesalePriceKhr: option.wholesalePriceKhr ?? null }
          : keptWholesale(id)),
        ...costOf(option.costMinor),
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
        ...costOf(product.costMinor),
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
    ...(customValues ? { customValues } : {}),
    // Services off: a product keeps the kind it has.
    ...(servicesOn ? { kind: product.kind } : {}),
  };
  const productId = existing
    ? (await tx.product.update({ where: { id: existing.id }, data: fields })).id
    : (await tx.product.create({ data: { storeId, ...fields } })).id;

  // Variants: options removed in the form are soft-deleted (old orders still point at them); the rest updated or added.
  const keep = new Set(variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
  const removed = (existing?.variants ?? []).filter((variant) => !keep.has(variant.id)).map((variant) => variant.id);
  if (removed.length) await tx.productVariant.updateMany({ where: { id: { in: removed } }, data: { deletedAt: new Date() } });
  const savedVariants: { id: string; valueIds?: string[] }[] = [];
  for (const { id, valueIds, ...variant } of variants) {
    const saved = id ? await tx.productVariant.update({ where: { id }, data: variant, select: { id: true } }) : await tx.productVariant.create({ data: { storeId, productId, ...variant }, select: { id: true } });
    savedVariants.push({ id: saved.id, valueIds });
  }

  // Option groups, then which values make each variant.
  if (optionsOn) {
    const valueIds = await saveOptionGroups(tx, { storeId, productId, kind: "variant" }, variantGroups.map(variantGroupToSave), storedGroups);
    await tx.productVariantValue.deleteMany({ where: { variant: { productId } } });
    await tx.productVariantValue.createMany({
      data: savedVariants.flatMap((variant) => (variant.valueIds ?? []).flatMap((formId) => {
        const valueId = valueIds.get(formId);
        return valueId ? [{ storeId, variantId: variant.id, valueId }] : [];
      })),
    });
  }
  if (choicesOn) await saveOptionGroups(tx, { storeId, productId, kind: "choice" }, product.choiceGroups.map(choiceGroupToSave), storedGroups);

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
  return products.map((product) => toProductDto(product, photoUrl, planHasFeature(plan, "wholesalePrice"), true));
}

/** One of the seller's products, or null when there's no such product. */
export async function readProduct(tx: Tx, storeId: string, id: string, photoUrl: (key: string) => string) {
  const { plan } = await storePlan(tx, storeId);
  const product = await tx.product.findFirst({ where: { id, deletedAt: null }, include: productInclude });
  return product ? toProductDto(product, photoUrl, planHasFeature(plan, "wholesalePrice"), true) : null;
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

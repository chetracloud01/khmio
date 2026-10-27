import type { Tx } from "@khmio/db";
import { BUSINESS_TYPE_DEFAULTS, type BusinessType, type CatalogName } from "@khmio/shared";

// The lists the product form picks from — categories, brands and units —
// each store's own, inside the merchant's withContext.

const nameSelect = { id: true, nameKm: true, nameEn: true } as const;
type Named = { id: string; nameKm: string; nameEn: string };

export type CatalogKind = "categories" | "brands" | "units";

export async function readCatalog(tx: Tx, storeId: string) {
  const [store, categories, brands, units] = await Promise.all([
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { businessType: true } }),
    tx.category.findMany({ select: nameSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    tx.brand.findMany({ select: nameSelect, orderBy: { createdAt: "asc" } }),
    tx.unit.findMany({ select: { ...nameSelect, key: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return toCatalog(store.businessType, categories, brands, units);
}

/** New products start with the business type's own unit (a café's "cup", a salon's "service"), else the first one. */
export function toCatalog(businessType: BusinessType, categories: Named[], brands: Named[], units: (Named & { key: string | null })[]) {
  const defaultUnitKey = BUSINESS_TYPE_DEFAULTS[businessType].unitKey;
  return {
    categories,
    brands,
    units: units.map(({ key: _key, ...unit }) => unit),
    defaultUnitId: units.find((unit) => unit.key === defaultUnitKey)?.id ?? units[0]?.id ?? null,
  };
}

/** "+ Add new category / brand / unit" in the product form. */
export function addCatalogName(tx: Tx, storeId: string, kind: CatalogKind, input: CatalogName): Promise<Named> {
  const data = { storeId, ...input };
  if (kind === "categories") return tx.category.create({ data, select: nameSelect });
  if (kind === "brands") return tx.brand.create({ data, select: nameSelect });
  return tx.unit.create({ data, select: nameSelect });
}

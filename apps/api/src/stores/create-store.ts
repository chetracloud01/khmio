import { merchantActor, type SystemDb, writeAudit } from "@khmio/db";
import { BUSINESS_TYPE_DEFAULTS, type CreateStoreInput, DAY_MS, DEFAULT_UNITS, FREE_TRIAL_DAYS, isReservedSlug, shopSlugSchema } from "@khmio/shared";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type CreateStoreResult = { ok: true; storeId: string } | { ok: false; reason: "slug_taken" | "already_has_store" };

/**
 * Onboarding's two answers become a shop, all or nothing: the store, the
 * merchant as its owner, the 14-day Free trial, and the business type's
 * categories and units. Runs as the owner user because the merchant isn't a
 * member yet — row-level security would rightly refuse them.
 */
export async function createStore(db: SystemDb, merchantId: string, input: CreateStoreInput, now = new Date()): Promise<CreateStoreResult> {
  const storeId = randomUUID();
  try {
    return await db.$transaction(async (tx) => {
      // One shop per merchant in Release 1.
      if (await tx.storeMember.findFirst({ where: { merchantId } })) return { ok: false, reason: "already_has_store" } as const;
      await tx.store.create({ data: newShopData(storeId, merchantId, input, now) });
      await writeAudit(tx, merchantActor({ merchantId, storeId }), { action: "store.created", entity: "store", entityId: storeId, after: { slug: input.slug, businessType: input.businessType } });
      return { ok: true, storeId } as const;
    });
  } catch (error) {
    // Someone took the link between the availability check and now.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

/** What a new shop starts with: its owner, the Free trial, and its business type's categories and the standard units. */
export function newShopData(storeId: string, merchantId: string, input: CreateStoreInput, now: Date) {
  const defaults = BUSINESS_TYPE_DEFAULTS[input.businessType];
  return {
    id: storeId,
    slug: input.slug,
    name: input.shopName,
    businessType: input.businessType,
    members: { create: { merchantId, role: "owner" as const } },
    subscription: { create: { plan: "free" as const, status: "trialing" as const, currentPeriodStart: now, trialEndsAt: new Date(now.getTime() + FREE_TRIAL_DAYS * DAY_MS) } },
    categories: { create: defaults.categories.map((category, index) => ({ nameKm: category.nameKm, nameEn: category.nameEn, sortOrder: index })) },
    units: { create: DEFAULT_UNITS.map((unit) => ({ key: unit.key, nameKm: unit.nameKm, nameEn: unit.nameEn })) },
  } satisfies Prisma.StoreCreateInput;
}

export type SlugAvailability = { available: true } | { available: false; reason: "invalid" | "taken" };

/**
 * Onboarding's live check while the seller types a link: yes, or why not.
 * It never says whose shop holds a link.
 */
export async function slugAvailability(db: SystemDb, slug: unknown): Promise<SlugAvailability> {
  const usable = usableSlug(slug);
  if (!usable) return { available: false, reason: "invalid" };
  return (await db.store.count({ where: { slug: usable } })) > 0 ? { available: false, reason: "taken" } : { available: true };
}

/** A link a shop may have: well formed, and not one Khmio keeps for itself (admin, api…). */
export function usableSlug(slug: unknown): string | null {
  const parsed = shopSlugSchema.safeParse(slug);
  return parsed.success && !isReservedSlug(parsed.data) ? parsed.data : null;
}

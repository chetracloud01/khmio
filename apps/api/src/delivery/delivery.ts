import type { Prisma, Tx } from "@khmio/db";
import type { DeliveryFee, DeliverySettings } from "@khmio/shared";

// A store's delivery as packages/shared delivery.ts sees it, read from its
// rows: zones with their districts, pickup and provinces (columns on stores),
// and — for the seller only — the drivers.

export const deliveryStoreSelect = {
  pickupEnabled: true,
  pickupAddress: true,
  pickupHours: true,
  provinceDeliveryEnabled: true,
  provinceFeeUsdCents: true,
  provinceFeeKhr: true,
  provinceNote: true,
  deliveryConfiguredAt: true,
} satisfies Prisma.StoreSelect;
type DeliveryStoreRow = Prisma.StoreGetPayload<{ select: typeof deliveryStoreSelect }>;

/** A fee as the shared rules want it: blank in a currency = undefined, not null. */
export function toFee(usdCents: number | null, khr: number | null): DeliveryFee {
  return { ...(usdCents !== null ? { feeUsdCents: usdCents } : {}), ...(khr !== null ? { feeKhr: khr } : {}) };
}

/**
 * The store's delivery settings, inside withContext (the seller, drivers
 * included) or withPublicStore (the buyer: drivers are hidden by the database,
 * so the list comes back empty).
 */
export async function readDeliverySettings(tx: Tx, storeId: string): Promise<{ settings: DeliverySettings; configured: boolean }> {
  const [store, zones, drivers] = await Promise.all([
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: deliveryStoreSelect }),
    tx.deliveryZone.findMany({ include: { districts: { select: { districtId: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    tx.storeDriver.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  return { settings: toDeliverySettings(store, zones, drivers), configured: store.deliveryConfiguredAt !== null };
}

export function toDeliverySettings(
  store: DeliveryStoreRow,
  zones: Prisma.DeliveryZoneGetPayload<{ include: { districts: { select: { districtId: true } } } }>[],
  drivers: Prisma.StoreDriverGetPayload<object>[],
): DeliverySettings {
  return {
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      districtIds: zone.districts.map((district) => district.districtId),
      ...toFee(zone.feeUsdCents, zone.feeKhr),
    })),
    pickup: { enabled: store.pickupEnabled, address: store.pickupAddress, hours: store.pickupHours },
    province: { enabled: store.provinceDeliveryEnabled, note: store.provinceNote, ...toFee(store.provinceFeeUsdCents, store.provinceFeeKhr) },
    drivers: drivers.map((driver) => ({ id: driver.id, name: driver.name, phone: driver.phone, kind: driver.kind })),
  };
}

/**
 * Saves the whole delivery page at once, inside the seller's withContext.
 * Zones are replaced; drivers keep their ids. Pickup is left as it is: it's
 * set with the shop address on Shop details (design/screens.md S10).
 */
export async function saveDeliverySettings(tx: Tx, storeId: string, settings: Omit<DeliverySettings, "pickup">): Promise<void> {
  await tx.store.update({
    where: { id: storeId },
    data: {
      provinceDeliveryEnabled: settings.province.enabled,
      provinceNote: settings.province.note,
      provinceFeeUsdCents: settings.province.feeUsdCents ?? null,
      provinceFeeKhr: settings.province.feeKhr ?? null,
      // The setup checklist's "delivery" step: saved at least once.
      deliveryConfiguredAt: new Date(),
    },
  });

  await tx.deliveryZone.deleteMany({});
  for (const [sortOrder, zone] of settings.zones.entries()) {
    await tx.deliveryZone.create({
      data: {
        storeId,
        name: zone.name,
        feeUsdCents: zone.feeUsdCents ?? null,
        feeKhr: zone.feeKhr ?? null,
        sortOrder,
        districts: { create: zone.districtIds.map((districtId) => ({ storeId, districtId })) },
      },
    });
  }

  // Drivers keep their ids, so step 6's dispatches can point at them; removed ones go.
  const existing = new Set((await tx.storeDriver.findMany({ select: { id: true } })).map((driver) => driver.id));
  const kept = settings.drivers.filter((driver) => existing.has(driver.id)).map((driver) => driver.id);
  await tx.storeDriver.deleteMany({ where: { id: { notIn: kept } } });
  for (const [sortOrder, driver] of settings.drivers.entries()) {
    const data = { name: driver.name, phone: driver.phone, kind: driver.kind, sortOrder };
    if (existing.has(driver.id)) await tx.storeDriver.update({ where: { id: driver.id }, data });
    else await tx.storeDriver.create({ data: { storeId, ...data } });
  }
}

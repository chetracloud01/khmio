import { describe, expect, it } from "vitest";
import { toDeliverySettings, toFee } from "./delivery";

type StoreRow = Parameters<typeof toDeliverySettings>[0];
type ZoneRow = Parameters<typeof toDeliverySettings>[1][number];
type DriverRow = Parameters<typeof toDeliverySettings>[2][number];

const AT = new Date("2026-10-01T03:00:00Z");
const store: StoreRow = {
  pickupEnabled: true,
  pickupAddress: "St. 240",
  pickupHours: "7–17",
  provinceDeliveryEnabled: true,
  provinceFeeUsdCents: null,
  provinceFeeKhr: 8000,
  provinceNote: "By bus",
  deliveryConfiguredAt: AT,
};
const zone: ZoneRow = { id: "zone-1", storeId: "store-1", name: "Central", feeUsdCents: 100, feeKhr: null, sortOrder: 0, createdAt: AT, updatedAt: AT, districts: [{ districtId: "daun-penh" }, { districtId: "chamkar-mon" }] };
const driver: DriverRow = { id: "driver-1", storeId: "store-1", name: "Dara", phone: "85512345678", kind: "own", sortOrder: 0, createdAt: AT, updatedAt: AT };

describe("delivery settings from their rows", () => {
  it("reads a blank fee as no fee in that currency (the shared rules want undefined, not null)", () => {
    expect(toFee(100, null)).toEqual({ feeUsdCents: 100 });
    expect(toFee(null, null)).toEqual({});
  });

  it("puts zones with their districts, pickup, provinces and drivers in the shared shape", () => {
    expect(toDeliverySettings(store, [zone], [driver])).toEqual({
      zones: [{ id: "zone-1", name: "Central", districtIds: ["daun-penh", "chamkar-mon"], feeUsdCents: 100 }],
      pickup: { enabled: true, address: "St. 240", hours: "7–17" },
      province: { enabled: true, note: "By bus", feeKhr: 8000 },
      drivers: [{ id: "driver-1", name: "Dara", phone: "85512345678", kind: "own" }],
    });
  });
});

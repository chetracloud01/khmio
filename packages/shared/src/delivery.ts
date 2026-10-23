import { z } from "zod";
import { isPhnomPenhDistrict, PHNOM_PENH_DISTRICTS } from "./locations";
import { convertKhrToUsdCents, convertUsdCentsToKhr, type Currency } from "./money";
import { khmerPhoneSchema } from "./phone";

// How a shop gets orders to buyers (docs/blueprint.md "Workflows from start to end", workflow 1):
// Phnom Penh districts grouped into zones with a fee each, pickup at the
// shop, provinces by bus, and the drivers an order can be handed to.

export const fulfilmentSchema = z.enum(["delivery", "pickup"]);
export type Fulfilment = z.infer<typeof fulfilmentSchema>;

export const MAX_DELIVERY_ZONES = PHNOM_PENH_DISTRICTS.length;
export const MAX_DRIVERS = 50;

/** Cents or riel. Blank in both currencies = free. */
const feeSchema = (max: number) =>
  z
    .number({ invalid_type_error: "price_invalid" })
    .int("price_invalid")
    .min(0, "price_invalid")
    .max(max, "price_invalid")
    .optional();

const feeFields = {
  feeUsdCents: feeSchema(10_000),
  feeKhr: feeSchema(400_000),
};

export interface DeliveryFee {
  feeUsdCents?: number;
  feeKhr?: number;
}

export const deliveryZoneSchema = z.object({
  id: z.string().min(1, "required"),
  /** The seller's own label ("Central", "Outer") — buyers see the district and the fee, not this. */
  name: z.string().trim().min(1, "required").max(40, "too_long"),
  districtIds: z.array(z.string().refine(isPhnomPenhDistrict, "required")),
  ...feeFields,
});
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;

export const driverSchema = z.object({
  id: z.string().min(1, "required"),
  name: z.string().trim().min(2, "too_short").max(60, "too_long"),
  phone: khmerPhoneSchema,
  /** own = the shop's staff; partner = an outside driver the shop calls. */
  kind: z.enum(["own", "partner"]),
});
export type Driver = z.infer<typeof driverSchema>;

/**
 * A shop's delivery settings without the rules that tie the fields together:
 * what a saved answer from the API is read with. A save is checked with
 * deliverySettingsSchema below.
 */
export const deliverySettingsShape = z.object({
  zones: z.array(deliveryZoneSchema).max(MAX_DELIVERY_ZONES, "too_long"),
  pickup: z.object({
    enabled: z.boolean(),
    address: z.string().trim().max(200, "too_long"),
    hours: z.string().trim().max(100, "too_long"),
  }),
  /** Outside Phnom Penh: sent by bus or transport company, one fee for every province. */
  province: z.object({
    enabled: z.boolean(),
    note: z.string().trim().max(200, "too_long"),
    ...feeFields,
  }),
  drivers: z.array(driverSchema).max(MAX_DRIVERS, "too_long"),
});

/**
 * True when a buyer has at least one way to get an order: a Phnom Penh zone,
 * pickup or provinces. Delivery and Shop details (where pickup is set) both
 * check it, so neither page can switch the last way off.
 */
export function offersAnyFulfilment(settings: { zones: readonly unknown[]; pickup: { enabled: boolean }; province: { enabled: boolean } }): boolean {
  return settings.zones.length > 0 || settings.pickup.enabled || settings.province.enabled;
}

export const deliverySettingsSchema = deliverySettingsShape.superRefine((settings, ctx) => {
  const seen = new Set<string>();
  settings.zones.forEach((zone, index) => {
    if (zone.districtIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "zone_empty", path: ["zones", index, "districtIds"] });
    }
    // One fee per district: a district can't sit in two zones.
    if (zone.districtIds.some((id) => seen.has(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "district_duplicate", path: ["zones", index, "districtIds"] });
    }
    zone.districtIds.forEach((id) => seen.add(id));
  });
  // A buyer who picks up needs to know where.
  if (settings.pickup.enabled && !settings.pickup.address) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["pickup", "address"] });
  }
  // With nothing on, no buyer could ever complete checkout.
  if (!offersAnyFulfilment(settings)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "delivery_required", path: ["zones"] });
  }
});

export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

/** What the buyer chose at checkout. */
export interface DeliveryChoice {
  fulfilment: Fulfilment;
  area: "phnom_penh" | "province";
  districtId?: string;
  provinceId?: string;
}

export type DeliveryQuote =
  /** The shop can do it; the fee (blank = free). */
  | { status: "ok"; fee: DeliveryFee }
  /** Waiting for the buyer to pick a district or province. */
  | { status: "incomplete" }
  /** The shop doesn't offer this (pickup off, district not covered, provinces off). */
  | { status: "unavailable" };

export function getDeliveryQuote(settings: DeliverySettings, choice: DeliveryChoice): DeliveryQuote {
  if (choice.fulfilment === "pickup") {
    return settings.pickup.enabled ? { status: "ok", fee: {} } : { status: "unavailable" };
  }
  if (choice.area === "province") {
    if (!settings.province.enabled) return { status: "unavailable" };
    if (!choice.provinceId) return { status: "incomplete" };
    return { status: "ok", fee: { feeUsdCents: settings.province.feeUsdCents, feeKhr: settings.province.feeKhr } };
  }
  if (settings.zones.length === 0) return { status: "unavailable" };
  if (!choice.districtId) return { status: "incomplete" };
  const zone = settings.zones.find((candidate) => candidate.districtIds.includes(choice.districtId ?? ""));
  return zone ? { status: "ok", fee: { feeUsdCents: zone.feeUsdCents, feeKhr: zone.feeKhr } } : { status: "unavailable" };
}

/**
 * A fee in the order's currency: the amount set in that currency, else the
 * other one converted at the store's rate; blank in both = free.
 */
export function deliveryFeeIn(fee: DeliveryFee, currency: Currency, usdToKhrRate: number): number {
  if (currency === "USD") {
    if (fee.feeUsdCents !== undefined) return fee.feeUsdCents;
    return fee.feeKhr !== undefined ? convertKhrToUsdCents(fee.feeKhr, usdToKhrRate) : 0;
  }
  if (fee.feeKhr !== undefined) return fee.feeKhr;
  return fee.feeUsdCents !== undefined ? convertUsdCentsToKhr(fee.feeUsdCents, usdToKhrRate) : 0;
}

/** Districts the shop delivers to — what the buyer's district picker lists. */
export function getDeliverableDistrictIds(settings: DeliverySettings): string[] {
  return settings.zones.flatMap((zone) => zone.districtIds);
}

/**
 * What a new shop's delivery page starts from, for the seller to review and
 * save (saving is what ticks "delivery" on the setup checklist): the central
 * districts and the outer ones as two zones, provinces by bus. Pickup starts
 * off and there are no drivers — those are the shop's own details.
 */
export const SUGGESTED_DELIVERY_SETTINGS: DeliverySettings = {
  zones: [
    {
      id: "suggested-central",
      name: "Central",
      districtIds: ["daun-penh", "chamkar-mon", "prampir-makara", "boeng-keng-kang", "tuol-kouk"],
      feeUsdCents: 100,
      feeKhr: 4000,
    },
    {
      id: "suggested-outer",
      name: "Outer",
      districtIds: ["sen-sok", "russey-keo", "chroy-changvar", "mean-chey", "chbar-ampov", "pou-senchey"],
      feeUsdCents: 150,
      feeKhr: 6000,
    },
  ],
  pickup: { enabled: false, address: "", hours: "" },
  province: { enabled: true, note: "", feeUsdCents: 200, feeKhr: 8000 },
  drivers: [],
};

export const MAX_MAP_URL_LENGTH = 300;

/** The link the seller copied from Google Maps (Share → Copy link); empty = none. Only web links. */
export const shopMapUrlSchema = z
  .string()
  .trim()
  .max(MAX_MAP_URL_LENGTH, "too_long")
  .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "map_link_invalid");

const pickupFields = deliverySettingsShape.shape.pickup.shape;

/**
 * Shop details' "Location and pickup" (design/screens.md S10): the shop's
 * address (also printed on invoices), its map link, and whether buyers can
 * pick up there and when. Whether pickup may be switched off depends on the
 * delivery settings too (offersAnyFulfilment), checked on save.
 */
export const shopLocationFields = z.object({
  address: pickupFields.address,
  mapUrl: shopMapUrlSchema,
  pickupEnabled: pickupFields.enabled,
  pickupHours: pickupFields.hours,
});

/** A buyer who picks up needs to know where. */
export function requirePickupAddress(location: { address: string; pickupEnabled: boolean }, ctx: z.RefinementCtx): void {
  if (location.pickupEnabled && !location.address) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["address"] });
  }
}

export const shopLocationSchema = shopLocationFields.superRefine(requirePickupAddress);
export type ShopLocation = z.infer<typeof shopLocationSchema>;

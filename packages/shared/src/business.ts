import { z } from "zod";

// Picked once during onboarding. It only pre-fills starting defaults (unit of
// measure, suggested categories) — every feature works the same for every
// type. See docs/blueprint.md "Business types".
export const businessTypeSchema = z.enum(["shop", "restaurant", "service", "garage", "other"]);
export type BusinessType = z.infer<typeof businessTypeSchema>;

export const BUSINESS_TYPES: readonly BusinessType[] = businessTypeSchema.options;

/**
 * The business types a new shop can pick, and a shop can switch to. Every
 * type since 2026-10-28 (docs/blueprint.md "Garage first"): the garage is the
 * most tested, the others are in beta. Take one out of this list to hide it
 * again; the API accepts every type either way.
 */
export const OFFERED_BUSINESS_TYPES: readonly BusinessType[] = BUSINESS_TYPES;

export interface NamedDefault {
  /** Stable id within a store, e.g. "piece" or "new-arrivals". */
  key: string;
  nameKm: string;
  nameEn: string;
}

/** Every new store gets all of these units; the business type only picks which one new products start with. */
export const DEFAULT_UNITS: readonly NamedDefault[] = [
  { key: "piece", nameKm: "ដុំ", nameEn: "Piece" },
  { key: "cup", nameKm: "កែវ", nameEn: "Cup" },
  { key: "kg", nameKm: "គីឡូក្រាម", nameEn: "Kilogram" },
  { key: "box", nameKm: "ប្រអប់", nameEn: "Box" },
  { key: "carton", nameKm: "កេស", nameEn: "Carton" },
  { key: "plate", nameKm: "ចាន", nameEn: "Plate" },
  { key: "service", nameKm: "សេវា", nameEn: "Service" },
  { key: "litre", nameKm: "លីត្រ", nameEn: "Litre" },
  { key: "set", nameKm: "ឈុត", nameEn: "Set" },
  { key: "vehicle", nameKm: "គ្រឿង", nameEn: "Vehicle" },
];

/** What a new store starts with, by business type: its categories and the unit new products default to. */
export const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, { unitKey: string; categories: readonly NamedDefault[] }> = {
  shop: {
    unitKey: "piece",
    categories: [
      { key: "new-arrivals", nameKm: "ទំនិញថ្មី", nameEn: "New arrivals" },
      { key: "best-sellers", nameKm: "លក់ដាច់", nameEn: "Best sellers" },
    ],
  },
  restaurant: {
    unitKey: "plate",
    categories: [
      { key: "food", nameKm: "ម្ហូប", nameEn: "Food" },
      { key: "drinks", nameKm: "ភេសជ្ជៈ", nameEn: "Drinks" },
      { key: "desserts", nameKm: "បង្អែម", nameEn: "Desserts" },
    ],
  },
  service: {
    unitKey: "service",
    categories: [
      { key: "services", nameKm: "សេវាកម្ម", nameEn: "Services" },
      { key: "packages", nameKm: "កញ្ចប់", nameEn: "Packages" },
    ],
  },
  // A garage sells cars, the parts for them and its workshop's services.
  garage: {
    unitKey: "piece",
    categories: [
      { key: "cars", nameKm: "រថយន្ត", nameEn: "Cars" },
      { key: "engine-oil", nameKm: "ប្រេងម៉ាស៊ីន", nameEn: "Engine oil" },
      { key: "tyres", nameKm: "កង់ឡាន", nameEn: "Tyres" },
      { key: "batteries", nameKm: "អាគុយ", nameEn: "Batteries" },
      { key: "parts", nameKm: "គ្រឿងបន្លាស់", nameEn: "Parts" },
      { key: "accessories", nameKm: "គ្រឿងតុបតែង", nameEn: "Accessories" },
      { key: "services", nameKm: "សេវាជួសជុល", nameEn: "Workshop services" },
    ],
  },
  other: {
    unitKey: "piece",
    categories: [{ key: "general", nameKm: "ទូទៅ", nameEn: "General" }],
  },
};

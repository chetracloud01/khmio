import { z } from "zod";
import type { BusinessType } from "./business";

// What a shop's kind of business needs beyond the shared core (products,
// orders, stock, payments): one list of modules, each switched on or off per
// shop. A business type only picks the modules a new shop starts with; the
// seller can change them (Features for my business). The API checks the
// module on every write that needs it, never just the screen.

export const businessModuleSchema = z.enum([
  /** Option groups that make variants: Size × Colour, each with its own price, SKU and stock. */
  "options",
  /** Choices added to an item at order time: sugar level, add-ons — "pick one" or "pick any", with an extra price. */
  "choices",
  /** The shop's own fields on products and order lines: warranty, material, IMEI. */
  "customFields",
  /** Products that are services: no stock, no delivery; the buyer asks for a date and time. */
  "services",
  /** Dine-in tables and kitchen tickets. */
  "tables",
  /** Vehicles and job cards: parts and labour for one car. */
  "jobCards",
]);
export type BusinessModule = z.infer<typeof businessModuleSchema>;
export const BUSINESS_MODULES: readonly BusinessModule[] = businessModuleSchema.options;

/** What each kind of business starts with. */
export const BUSINESS_TYPE_MODULES: Record<BusinessType, readonly BusinessModule[]> = {
  shop: ["options", "customFields"],
  restaurant: ["options", "choices", "tables"],
  service: ["services", "customFields"],
  garage: ["options", "services", "customFields", "jobCards"],
  other: ["options"],
};

/** Saving the shop's modules: each at most once, in the list's own order. */
export const storeModulesInputSchema = z.object({
  modules: z.array(businessModuleSchema).max(BUSINESS_MODULES.length).transform((chosen) => BUSINESS_MODULES.filter((module) => chosen.includes(module))),
});
export type StoreModulesInput = z.infer<typeof storeModulesInputSchema>;

export function hasModule(modules: readonly BusinessModule[], module: BusinessModule): boolean {
  return modules.includes(module);
}

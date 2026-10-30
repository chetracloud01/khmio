import { z } from "zod";
import { rawCustomValuesSchema } from "./custom-fields";
import { currencySchema, minorAmountSchema } from "./money";
import { productKindSchema } from "./services";
import { choiceGroupInputSchema, MAX_CHOICE_GROUPS, MAX_VARIANT_GROUPS, variantGroupInputSchema } from "./product-options";

// A product as the merchant saves it from the product form. The same schema
// checks the form now and the API request later. Rules from docs/blueprint.md
// "Multi-currency pricing and totals": a sellable line needs a price in at
// least one currency; prices are whole cents / riel.

/** Above this a discount is almost certainly a typo, and 100% would give the product away. */
export const MAX_DISCOUNT_PERCENT = 90;
export const MAX_PRODUCT_OPTIONS = 50;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;

const optionalAmount = minorAmountSchema.optional();

const priceFields = {
  /** Price the storefront shows buyers. */
  retailPriceUsdCents: optionalAmount,
  retailPriceKhr: optionalAmount,
  /** Bulk/B2B price — Pro and Advance only; kept, hidden, on lower plans. */
  wholesalePriceUsdCents: optionalAmount,
  wholesalePriceKhr: optionalAmount,
  /** What one costs the shop (the seller's only, for profit), in the product's costCurrency; blank = not known. */
  costMinor: optionalAmount,
};

type Prices = { [K in keyof typeof priceFields]?: number };

/** Adds the price rules shared by a simple product and each of its options. */
function checkPrices(prices: Prices, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (prices.retailPriceUsdCents === undefined && prices.retailPriceKhr === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "price_required", path: [...path, "retailPrice"] });
  }
  const aboveRetail =
    (prices.wholesalePriceUsdCents !== undefined &&
      prices.retailPriceUsdCents !== undefined &&
      prices.wholesalePriceUsdCents > prices.retailPriceUsdCents) ||
    (prices.wholesalePriceKhr !== undefined &&
      prices.retailPriceKhr !== undefined &&
      prices.wholesalePriceKhr > prices.retailPriceKhr);
  if (aboveRetail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "wholesale_above_retail", path: [...path, "wholesalePrice"] });
  }
}

export const productOptionInputSchema = z.object({
  id: z.string().min(1, "required"),
  /** Blank = generated from the title and option name on save. */
  sku: z
    .string()
    .trim()
    .max(40, "too_long")
    .regex(/^[A-Za-z0-9._-]*$/, "sku_invalid"),
  labelKm: z.string().trim().max(40, "too_long"),
  labelEn: z.string().trim().max(40, "too_long"),
  /** With variant groups: one value id per group (the label then comes from them). */
  valueIds: z.array(z.string().min(1)).max(MAX_VARIANT_GROUPS).optional(),
  ...priceFields,
});

export const productInputSchema = z
  .object({
    titleKm: z.string().trim().min(2, "too_short").max(120, "too_long"),
    /** Blank = the Khmer title is used. */
    titleEn: z.string().trim().max(120, "too_long"),
    /** Shown on the buyer's product page. Optional; blank English = the Khmer text is used. */
    descriptionKm: z.string().trim().max(MAX_PRODUCT_DESCRIPTION_LENGTH, "too_long").default(""),
    descriptionEn: z.string().trim().max(MAX_PRODUCT_DESCRIPTION_LENGTH, "too_long").default(""),
    /** False = kept in the dashboard but not shown in the shop (out of season, not ready yet). */
    isVisible: z.boolean().default(true),
    categoryId: z.string().min(1, "required"),
    brandId: z.string().min(1).optional(),
    uomId: z.string().min(1).optional(),
    discountPercent: z
      .number({ invalid_type_error: "discount_range" })
      .int("discount_range")
      .min(0, "discount_range")
      .max(MAX_DISCOUNT_PERCENT, "discount_range")
      .optional(),
    ...priceFields,
    /** The one currency of the product's costs, for all its options (docs/blueprint.md "Cost price"); needed once any cost is given. */
    costCurrency: currencySchema.optional(),
    /** When present, prices live on each option and the product-level prices are ignored. */
    options: z.array(productOptionInputSchema).max(MAX_PRODUCT_OPTIONS, "too_long").optional(),
    /** Size, Colour…: each option is one value of each (Features › options). */
    variantGroups: z.array(variantGroupInputSchema).max(MAX_VARIANT_GROUPS, "too_long").default([]),
    /** Sugar, Add-ons…: picked when ordering (Features › choices). */
    choiceGroups: z.array(choiceGroupInputSchema).max(MAX_CHOICE_GROUPS, "too_long").default([]),
    /** The shop's own product fields (Features › customFields), field id → value; checked against them by the API. */
    customValues: rawCustomValuesSchema,
    /** A service has no stock and nothing to deliver (Features › services). */
    kind: productKindSchema.default("item"),
  })
  .superRefine((product, ctx) => {
    const costGiven = product.options?.length ? product.options.some((option) => option.costMinor !== undefined) : product.costMinor !== undefined;
    if (costGiven && !product.costCurrency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["costCurrency"] });
    if (!product.options?.length) {
      checkPrices(product, ctx, []);
      if (product.variantGroups.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["options"] });
      return;
    }
    const seenSkus = new Set<string>();
    const seenCombinations = new Set<string>();
    product.options.forEach((option, index) => {
      if (product.variantGroups.length) {
        // One value from each group, each combination once.
        const valueIds = option.valueIds ?? [];
        const fits = valueIds.length === product.variantGroups.length && product.variantGroups.every((group, at) => group.values.some((value) => value.id === valueIds[at]));
        if (!fits) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_values_invalid", path: ["options", index, "valueIds"] });
        const combination = valueIds.join("|");
        if (fits && seenCombinations.has(combination)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_duplicate", path: ["options", index, "valueIds"] });
        seenCombinations.add(combination);
      } else if (!option.labelKm && !option.labelEn) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_label_required", path: ["options", index, "label"] });
      }
      checkPrices(option, ctx, ["options", index]);
      const sku = option.sku.toUpperCase();
      if (sku && seenSkus.has(sku)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "sku_duplicate", path: ["options", index, "sku"] });
      }
      if (sku) seenSkus.add(sku);
    });
  });

export type ProductInput = z.infer<typeof productInputSchema>;

/** Photos per product (design/screens.md S7). */
export const MAX_PRODUCT_PHOTOS = 6;

/**
 * What the product form sends to the API: the product, plus its photos as
 * keys returned by the upload, in display order (the first one is the cover).
 */
export const productSaveSchema = z.object({
  product: productInputSchema,
  photoKeys: z.array(z.string().min(1).max(200)).max(MAX_PRODUCT_PHOTOS, "too_long"),
});
export type ProductSave = z.infer<typeof productSaveSchema>;
export type ProductSaveInput = z.input<typeof productSaveSchema>;

/** A category, brand or unit the seller adds from the product form. */
export const catalogNameSchema = z.object({
  nameKm: z.string().trim().min(1, "required").max(40, "too_long"),
  nameEn: z.string().trim().min(1, "required").max(40, "too_long"),
});
export type CatalogName = z.infer<typeof catalogNameSchema>;
/** What a form hands to the schema: description and visibility may be left out. */
export type ProductFormInput = z.input<typeof productInputSchema>;
export type ProductOptionInput = z.infer<typeof productOptionInputSchema>;

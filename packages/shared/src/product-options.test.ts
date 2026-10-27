import { describe, expect, it } from "vitest";
import { computeOrderTotal } from "./order-total";
import { productInputSchema } from "./product";
import { cartLineKey, combinations, parseCartLineKey, pickChoices, variantLabel, type ChoiceGroupFacts } from "./product-options";

const size = { id: "size", nameKm: "ទំហំ", nameEn: "Size", values: [{ id: "s", labelKm: "តូច", labelEn: "S" }, { id: "m", labelKm: "មធ្យម", labelEn: "M" }] };
const colour = { id: "colour", nameKm: "ពណ៌", nameEn: "Colour", values: [{ id: "red", labelKm: "ក្រហម", labelEn: "Red" }, { id: "blue", labelKm: "", labelEn: "Blue" }] };

describe("variant groups", () => {
  it("make every combination of one value per group", () => {
    expect(combinations([size, colour])).toEqual([["s", "red"], ["s", "blue"], ["m", "red"], ["m", "blue"]]);
    expect(combinations([])).toEqual([]);
  });

  it("name a variant from its values, in either language", () => {
    expect(variantLabel([size, colour], ["m", "blue"], "en")).toBe("M · Blue");
    // Blue has no Khmer name: the English one stands in.
    expect(variantLabel([size, colour], ["m", "blue"], "km")).toBe("មធ្យម · Blue");
  });

  const product = (options: { valueIds: string[] }[]) => ({
    titleKm: "អាវ",
    titleEn: "Shirt",
    categoryId: "cat",
    variantGroups: [size, colour],
    options: options.map((option, index) => ({ id: `o${index}`, sku: "", labelKm: "", labelEn: "", retailPriceUsdCents: 800, ...option })),
  });

  it("let a product save its combinations without typing a name for each", () => {
    expect(productInputSchema.safeParse(product([{ valueIds: ["s", "red"] }, { valueIds: ["m", "blue"] }])).success).toBe(true);
  });

  it("refuse an option missing a group's value, or the same combination twice", () => {
    const missing = productInputSchema.safeParse(product([{ valueIds: ["s"] }]));
    expect(missing.success ? null : missing.error.issues[0]?.message).toBe("option_values_invalid");
    const twice = productInputSchema.safeParse(product([{ valueIds: ["s", "red"] }, { valueIds: ["s", "red"] }]));
    expect(twice.success ? null : twice.error.issues[0]?.message).toBe("option_duplicate");
  });
});

describe("choice groups", () => {
  const sugar: ChoiceGroupFacts = {
    id: "sugar",
    nameKm: "ស្ករ",
    nameEn: "Sugar",
    pick: "one",
    required: true,
    values: [
      { id: "less", labelKm: "តិច", labelEn: "Less", extraUsdCents: null, extraKhr: null },
      { id: "normal", labelKm: "ធម្មតា", labelEn: "Normal", extraUsdCents: null, extraKhr: null },
    ],
  };
  const addOns: ChoiceGroupFacts = {
    id: "add",
    nameKm: "បន្ថែម",
    nameEn: "Add-ons",
    pick: "many",
    required: false,
    values: [
      { id: "shot", labelKm: "កាហ្វេបន្ថែម", labelEn: "+1 shot", extraUsdCents: 50, extraKhr: null },
      { id: "pearl", labelKm: "គុជ", labelEn: "Pearls", extraUsdCents: null, extraKhr: 1000 },
    ],
  };

  it("take one from a 'pick one' group, any number from a 'pick any' group", () => {
    const picks = pickChoices([sugar, addOns], ["pearl", "less", "shot"]);
    expect(picks.ok && picks.picked.map((pick) => pick.value.id)).toEqual(["less", "shot", "pearl"]);
    expect(pickChoices([sugar], ["less", "normal"])).toEqual({ ok: false, problem: "choice_invalid" });
  });

  it("need a required group, and refuse a value that isn't this product's", () => {
    expect(pickChoices([sugar, addOns], ["shot"])).toEqual({ ok: false, problem: "choice_required" });
    expect(pickChoices([sugar], ["less", "someone-else"])).toEqual({ ok: false, problem: "choice_invalid" });
  });

  it("add each extra to the unit, converted and rounded on its own, before the discount", () => {
    // $2.00 coffee + $0.50 shot + 1,000៛ pearls, paid in USD at 4,100: 1,000៛ → 24¢.
    const total = computeOrderTotal({
      lines: [{ key: "coffee", quantity: 2, priceUsdCents: 200, priceKhr: null, discountPercent: 10, extras: [{ priceUsdCents: 50, priceKhr: null }, { priceUsdCents: null, priceKhr: 1000 }] }],
      currency: "USD",
      usdToKhrRate: 4100,
      vatPercent: 0,
      deliveryFee: null,
    });
    expect(total.lines[0]).toMatchObject({ baseUnitPrice: 274, unitPrice: 247, lineTotal: 494 });
  });
});

describe("cart line keys", () => {
  it("keep the same item with different choices apart, whatever order they were picked in", () => {
    expect(cartLineKey("v1")).toBe("v1");
    expect(cartLineKey("v1", ["b", "a"])).toBe(cartLineKey("v1", ["a", "b"]));
    expect(parseCartLineKey(cartLineKey("v1", ["b", "a"]))).toEqual({ variantId: "v1", choiceIds: ["a", "b"] });
    expect(parseCartLineKey("v1")).toEqual({ variantId: "v1", choiceIds: [] });
  });
});

import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES } from "./business";
import { CUSTOM_FIELD_PRESETS, customFieldDefinitionSchema, customFieldsSaveSchema, customValuesSchema, customValueText, MAX_CUSTOM_FIELDS } from "./custom-fields";

const field = (overrides: Record<string, unknown>) => ({ id: "f", target: "product", type: "text", labelKm: "", labelEn: "Field", options: [], required: false, public: true, ...overrides });

describe("a shop's own fields", () => {
  it("need a name, and a pick-list needs choices", () => {
    expect(customFieldDefinitionSchema.safeParse(field({ labelEn: "" })).success).toBe(false);
    expect(customFieldDefinitionSchema.safeParse(field({ type: "pick" })).success).toBe(false);
    expect(customFieldDefinitionSchema.safeParse(field({ type: "pick", options: [{ id: "a", labelKm: "", labelEn: "Cotton" }] })).success).toBe(true);
  });

  it(`stop at ${MAX_CUSTOM_FIELDS} per place`, () => {
    const many = Array.from({ length: MAX_CUSTOM_FIELDS + 1 }, (_, index) => field({ id: `f${index}` }));
    expect(customFieldsSaveSchema.safeParse({ fields: many }).success).toBe(false);
    expect(customFieldsSaveSchema.safeParse({ fields: many.slice(1) }).success).toBe(true);
  });

  it("come with a usual set for every kind of business, each one valid", () => {
    for (const type of BUSINESS_TYPES) {
      for (const [index, preset] of CUSTOM_FIELD_PRESETS[type].entries()) expect(customFieldDefinitionSchema.safeParse({ ...preset, id: `p${index}` }).success).toBe(true);
    }
  });
});

describe("the values of a shop's own fields", () => {
  const fields = [
    { id: "warranty", type: "number" as const, options: [], required: true },
    { id: "material", type: "pick" as const, options: [{ id: "cotton", labelKm: "កប្បាស", labelEn: "Cotton" }], required: false },
    { id: "expiry", type: "date" as const, options: [], required: false },
    { id: "boxed", type: "yesNo" as const, options: [], required: false },
    { id: "note", type: "text" as const, options: [], required: false },
  ];
  const schema = customValuesSchema(fields);

  it("take each field's own kind of value, and drop fields that no longer exist", () => {
    expect(schema.parse({ warranty: 12, material: "cotton", expiry: "2027-01-31", boxed: true, gone: "x" })).toEqual({ warranty: 12, material: "cotton", expiry: "2027-01-31", boxed: true });
  });

  it("need the required ones, and treat a blank text as not filled in", () => {
    expect(schema.safeParse({ note: "x" }).success).toBe(false);
    expect(schema.parse({ warranty: 6, note: "  " })).toEqual({ warranty: 6 });
  });

  it("refuse a wrong kind of value", () => {
    expect(schema.safeParse({ warranty: "twelve" }).success).toBe(false);
    expect(schema.safeParse({ warranty: 1, material: "silk" }).success).toBe(false);
    expect(schema.safeParse({ warranty: 1, expiry: "31/01/2027" }).success).toBe(false);
  });

  it("read out in words", () => {
    const words = { yes: "Yes", no: "No", language: "en" as const };
    expect(customValueText(fields[1]!, "cotton", words)).toBe("Cotton");
    expect(customValueText(fields[3]!, false, words)).toBe("No");
    expect(customValueText(fields[0]!, 12, words)).toBe("12");
  });
});

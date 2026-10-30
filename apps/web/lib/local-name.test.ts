import { describe, expect, it } from "vitest";
import { categoryNameLookup, localName } from "./local-name";

describe("names in the page's language", () => {
  it("takes the page's language, or the other one when it's empty", () => {
    expect(localName("km", { nameKm: "កង់", nameEn: "Tyres" })).toBe("កង់");
    expect(localName("en", { nameKm: "កង់", nameEn: "" })).toBe("កង់");
  });

  it("looks a category up, and gives nothing for one that isn't there", () => {
    const name = categoryNameLookup([{ id: "c1", nameKm: "ប្រេង", nameEn: "Oil" }], "en");
    expect([name("c1"), name("c2")]).toEqual(["Oil", ""]);
    expect(categoryNameLookup(undefined, "en")("c1")).toBe("");
  });
});

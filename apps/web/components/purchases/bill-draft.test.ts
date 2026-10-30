import { describe, expect, it } from "vitest";
import { billDraftSchema, draftHasWork, dueOnOf, emptyDraft } from "./bill-draft";

describe("a bill being typed", () => {
  const draft = { ...emptyDraft("USD", 4_100), purchasedOn: "2026-10-28" };

  it("is due on the day its choice says", () => {
    expect(dueOnOf({ ...draft, dueChoice: "none" })).toBe("");
    expect(dueOnOf({ ...draft, dueChoice: 30 })).toBe("2026-11-27");
    expect(dueOnOf({ ...draft, dueChoice: "other", dueOn: "2026-12-01" })).toBe("2026-12-01");
  });

  it("is worth keeping once something is typed", () => {
    expect(draftHasWork(draft)).toBe(false);
    expect(draftHasWork({ ...draft, billRef: "CAP-1" })).toBe(true);
    expect(draftHasWork({ ...draft, lines: [{ variantId: "v1", quantity: "1", cost: "2.50" }] })).toBe(true);
  });

  it("is read back only when it's a draft", () => {
    expect(billDraftSchema.safeParse(JSON.parse(JSON.stringify({ ...draft, dueChoice: 15 }))).success).toBe(true);
    expect(billDraftSchema.safeParse({ ...draft, dueChoice: 9 }).success).toBe(false);
    expect(billDraftSchema.safeParse({ lines: "nope" }).success).toBe(false);
  });
});

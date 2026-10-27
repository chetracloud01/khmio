import { describe, expect, it } from "vitest";
import { canMoveJobCard, isJobCardOpen, jobCardInputSchema, vehicleInputSchema, type JobCardStatus } from "./job-cards";

describe("vehicles", () => {
  it("keep a plate trimmed and upper-case, and need one", () => {
    expect(vehicleInputSchema.parse({ plate: "  pp 2a-1234 ", ownerPhone: "" }).plate).toBe("PP 2A-1234");
    expect(vehicleInputSchema.safeParse({ plate: " ", ownerPhone: "" }).success).toBe(false);
  });

  it("save the owner's phone as 855…", () => {
    expect(vehicleInputSchema.parse({ plate: "A1", ownerPhone: "012 345 678" }).ownerPhone).toBe("85512345678");
  });
});

describe("job cards", () => {
  it("take parts and labour as products with a quantity", () => {
    const card = jobCardInputSchema.safeParse({ vehicleId: "0b5e5f3e-8f6c-4c2a-9d7e-1a2b3c4d5e6f", lines: [{ variantId: "0b5e5f3e-8f6c-4c2a-9d7e-1a2b3c4d5e6f", quantity: 0 }] });
    expect(card.success).toBe(false);
  });

  it("move open → in progress → ready, back a step, or cancelled — never handed over by hand", () => {
    expect(canMoveJobCard("open", "in_progress")).toBe(true);
    expect(canMoveJobCard("in_progress", "ready")).toBe(true);
    expect(canMoveJobCard("ready", "in_progress")).toBe(true);
    expect(canMoveJobCard("ready", "handed_over")).toBe(false);
    expect(canMoveJobCard("handed_over", "open")).toBe(false);
    expect(canMoveJobCard("cancelled", "open")).toBe(false);
  });

  it("stay changeable and billable only while the car is at the garage", () => {
    const atGarage: JobCardStatus[] = ["open", "in_progress", "ready"];
    expect(atGarage.every(isJobCardOpen)).toBe(true);
    expect(isJobCardOpen("handed_over") || isJobCardOpen("cancelled")).toBe(false);
  });
});

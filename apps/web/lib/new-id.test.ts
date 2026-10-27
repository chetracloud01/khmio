import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./new-id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("makes a version-4 UUID even where crypto.randomUUID is missing (plain http, old Android)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: (array: Uint8Array) => real.getRandomValues(array) });
    const ids = new Set(Array.from({ length: 50 }, newId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it("uses crypto.randomUUID when it exists", () => {
    expect(newId()).toMatch(UUID_V4);
  });
});

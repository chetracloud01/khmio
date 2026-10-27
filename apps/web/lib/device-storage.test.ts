import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readStored, writeStored } from "./device-storage";

/** A device's storage, as a plain map. */
function stubStorage(kept: Record<string, string> = {}) {
  const items = new Map(Object.entries(kept));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
  });
  return items;
}

const prefs = z.object({ view: z.enum(["grid", "list"]) });

describe("device storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads back what was kept", () => {
    const items = stubStorage();
    writeStored("prefs", { view: "list" });
    expect(items.get("prefs")).toBe('{"view":"list"}');
    expect(readStored("prefs", prefs)).toEqual({ view: "list" });
  });

  it("is null when nothing was kept, or what was kept no longer fits", () => {
    stubStorage({ old: '{"view":"cards"}', broken: "{not json" });
    expect(readStored("missing", prefs)).toBeNull();
    expect(readStored("old", prefs)).toBeNull();
    expect(readStored("broken", prefs)).toBeNull();
  });

  it("forgets on null", () => {
    const items = stubStorage({ prefs: '{"view":"grid"}' });
    writeStored("prefs", null);
    expect(items.has("prefs")).toBe(false);
  });

  it("never throws when the browser refuses storage (private window)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
        removeItem: () => undefined,
      },
    });
    expect(readStored("prefs", prefs)).toBeNull();
    expect(() => writeStored("prefs", { view: "grid" })).not.toThrow();
  });
});

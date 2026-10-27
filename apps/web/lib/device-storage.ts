import type { z } from "zod";

// What this device keeps for its viewer (cart, drafts, list settings, recent
// searches): a convenience only. Storage can be missing or refuse (private
// window, full), and what was kept may be from an older version of the app,
// so everything read back is checked with a schema and nothing ever breaks.

/** What was kept under `key`, or null when nothing was, storage is blocked, or it no longer fits `schema`. */
export function readStored<Kept extends z.ZodTypeAny>(key: string, schema: Kept): z.output<Kept> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Keeps `value` under `key`; null forgets it. When storage refuses, it just isn't kept. */
export function writeStored(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: nothing kept, nothing breaks.
  }
}

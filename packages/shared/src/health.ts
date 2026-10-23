// Platform health on the admin overview (design/screens.md A1): what the
// worker, backups, Telegram and payments are doing, as states a person can act on.

import { z } from "zod";

/** The worker checks in every 5 minutes; after this long without a word it counts as down. */
export const WORKER_DOWN_AFTER_MINUTES = 15;

/** ok = working; warning = needs a look; off = not switched on yet (not a fault). */
export type HealthState = "ok" | "warning" | "off";

export function workerState(seenAt: Date | null, now = new Date()): HealthState {
  return seenAt !== null && now.getTime() - seenAt.getTime() <= WORKER_DOWN_AFTER_MINUTES * 60 * 1000 ? "ok" : "warning";
}

/** GET /admin/overview's health part. */
export const platformHealthSchema = z.object({
  workerSeenAt: z.string().nullable(),
  latestBackupAt: z.string().nullable(),
  backupsStale: z.boolean(),
  /** "dry_run" = no bot token yet: messages are only written to the log. */
  telegram: z.enum(["on", "dry_run"]),
  /** KHQR (roadmap step 5) isn't connected until the Bakong token arrives. */
  khqr: z.literal("not_connected"),
  /** Release 1: every shop is free; billing starts at Release 2. */
  betaAllBasic: z.boolean(),
});
export type PlatformHealth = z.infer<typeof platformHealthSchema>;

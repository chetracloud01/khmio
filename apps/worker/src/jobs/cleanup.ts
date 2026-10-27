import type { SystemDb } from "@khmio/db";
import type PgBoss from "pg-boss";
import type { Logger } from "pino";

export const CLEANUP_QUEUE = "cleanup";

/** Rate-limit counters older than this are no use to any window (the longest is a day). */
const KEEP_RATE_LIMIT_HOURS = 48;

/** Deletes what nobody needs any more. Returns how many rows went. */
export async function cleanUpOnce(db: SystemDb): Promise<number> {
  return db.$executeRaw`DELETE FROM rate_limit_hits WHERE window_start < now() - make_interval(hours => ${KEEP_RATE_LIMIT_HOURS}::int)`;
}

/** Every hour, at minute 17 (away from the heartbeat's round minutes). */
export async function registerCleanup(boss: PgBoss, db: SystemDb, logger: Logger): Promise<void> {
  await boss.createQueue(CLEANUP_QUEUE);
  await boss.schedule(CLEANUP_QUEUE, "17 * * * *");
  await boss.work(CLEANUP_QUEUE, async () => {
    const removed = await cleanUpOnce(db);
    if (removed > 0) logger.info({ removed }, "old rate-limit counters removed");
  });
}

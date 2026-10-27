import type { SystemDb } from "@khmio/db";
import type PgBoss from "pg-boss";
import type { Logger } from "pino";

export const HEARTBEAT_QUEUE = "heartbeat";

/** Records "the worker is alive now" where the admin overview reads it (platform_settings.worker_seen_at). */
export async function beat(db: SystemDb): Promise<void> {
  await db.platformSettings.update({ where: { id: 1 }, data: { workerSeenAt: new Date() } });
}

/**
 * Every 5 minutes, through the job queue — proof the worker and the queue
 * work end to end. Each beat is written to the database, so the admin
 * overview shows the worker down when the beats stop (packages/shared
 * health.ts). One beat at start-up, so a fresh deploy shows up at once.
 */
export async function registerHeartbeat(boss: PgBoss, db: SystemDb, logger: Logger): Promise<void> {
  await boss.createQueue(HEARTBEAT_QUEUE);
  await boss.schedule(HEARTBEAT_QUEUE, "*/5 * * * *");
  await boss.work(HEARTBEAT_QUEUE, async () => {
    await beat(db);
    logger.info("worker heartbeat");
  });
  await beat(db).catch((error: unknown) => logger.warn({ detail: error instanceof Error ? error.message.slice(0, 200) : "unknown" }, "first heartbeat not saved"));
}

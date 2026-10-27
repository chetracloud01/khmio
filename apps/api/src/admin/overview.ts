import type { SystemDb } from "@khmio/db";
import { backupIsStale, DAY_MS, type PlatformHealth, startOfPhnomPenhDay } from "@khmio/shared";
import { MAX_ATTEMPTS_FOR_ADMIN } from "./outbox-limits";

// The admin's front page (design/screens.md A1) and the menu's red counts:
// what needs a person's look today, across every shop.

/** A trial "ends soon" in this many days: the overview's card and the menu badge count the same shops. */
export const TRIAL_ENDING_SOON_DAYS = 3;
/** "New this week" on the overview. */
const NEW_SHOP_DAYS = 7;

const trialEndingSoon = (now: Date) => ({ status: "trialing" as const, trialEndsAt: { gte: now, lte: new Date(now.getTime() + TRIAL_ENDING_SOON_DAYS * DAY_MS) } });
const latestGoodBackup = (db: SystemDb) => db.backupRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } });

export async function readOverview(db: SystemDb, telegramOn: boolean, now = new Date()) {
  const [shops, newThisWeek, paused, trialsEndingSoon, ordersToday, waitingOrders, messagesGaveUp, settings, latestBackup] = await Promise.all([
    db.store.count(),
    db.store.count({ where: { createdAt: { gte: new Date(now.getTime() - NEW_SHOP_DAYS * DAY_MS) } } }),
    db.subscription.count({ where: { status: "paused" } }),
    db.subscription.count({ where: trialEndingSoon(now) }),
    // Today is Phnom Penh's day, not the server's (midnight UTC is 7 am in Cambodia).
    db.order.count({ where: { createdAt: { gte: startOfPhnomPenhDay(now) } } }),
    db.order.count({ where: { status: { in: ["cod_pending", "paid"] } } }),
    db.outboxEvent.count({ where: { sentAt: null, attempts: { gte: MAX_ATTEMPTS_FOR_ADMIN }, kind: { not: "admin_alert" } } }),
    db.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { workerSeenAt: true, betaAllBasic: true } }),
    latestGoodBackup(db),
  ]);
  const health = toPlatformHealth({ workerSeenAt: settings.workerSeenAt, latestBackupAt: latestBackup?.finishedAt ?? null, betaAllBasic: settings.betaAllBasic, telegramOn }, now);
  return { shops, newThisWeek, paused, trialsEndingSoon, ordersToday, waitingOrders, messagesGaveUp, health };
}

/** The worker, backups, Telegram and payments as states a person can act on. */
export function toPlatformHealth(facts: { workerSeenAt: Date | null; latestBackupAt: Date | null; betaAllBasic: boolean; telegramOn: boolean }, now: Date): PlatformHealth {
  return {
    workerSeenAt: facts.workerSeenAt?.toISOString() ?? null,
    latestBackupAt: facts.latestBackupAt?.toISOString() ?? null,
    backupsStale: backupIsStale(facts.latestBackupAt, now),
    telegram: facts.telegramOn ? "on" : "dry_run",
    khqr: "not_connected",
    betaAllBasic: facts.betaAllBasic,
  };
}

/** The menu's red counts: cheap enough to ask on every page change. */
export async function readBadges(db: SystemDb, now = new Date()) {
  const [trialsEnding, latestDone] = await Promise.all([db.subscription.count({ where: trialEndingSoon(now) }), latestGoodBackup(db)]);
  return { trialsEnding, backupsStale: backupIsStale(latestDone?.finishedAt ?? null, now) ? 1 : 0 };
}

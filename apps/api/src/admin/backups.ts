import { Prisma, writeAudit, type BackupRun, type SystemDb } from "@khmio/db";
import { backupFailureSchema, backupKindSchema, backupStatusSchema, type BackupRunView } from "@khmio/shared";

// Database backups as the admin sees them (design/screens.md A13): the runs,
// newest first, the newest good one, the monthly restore test, and "Backup
// now" (the worker picks it up within seconds).

export async function readBackups(db: SystemDb, query: { before?: string; limit: number }) {
  const [rows, latestDone, settings] = await Promise.all([
    db.backupRun.findMany({ where: query.before ? { createdAt: { lt: new Date(query.before) } } : {}, orderBy: { createdAt: "desc" }, take: query.limit }),
    db.backupRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } }),
    db.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { restoreTestPassedAt: true } }),
  ]);
  const adminIds = [...rows, ...(latestDone ? [latestDone] : [])].flatMap((row) => (row.startedById ? [row.startedById] : []));
  const admins = await db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } });
  const names = new Map(admins.map((admin) => [admin.id, admin.name]));
  return {
    runs: rows.map((row) => toBackupRunView(row, names)),
    latestDone: latestDone ? toBackupRunView(latestDone, names) : null,
    restoreTestPassedAt: settings.restoreTestPassedAt?.toISOString() ?? null,
    more: rows.length === query.limit,
  };
}

/** One run as the admin sees it. The table's CHECK rules allow only these names; they're read, not assumed. */
export function toBackupRunView(row: BackupRun, adminNames: Map<string, string>): BackupRunView {
  return {
    id: row.id,
    kind: backupKindSchema.parse(row.kind),
    status: backupStatusSchema.parse(row.status),
    startedByName: row.startedById ? (adminNames.get(row.startedById) ?? null) : null,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    failure: backupFailureSchema.nullable().parse(row.failure),
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    fileDeletedAt: row.fileDeletedAt?.toISOString() ?? null,
  };
}

/** "Backup now". Null when one is already waiting or running: the database allows only one at a time. */
export async function startBackup(db: SystemDb, adminId: string): Promise<{ id: string } | null> {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.backupRun.create({ data: { kind: "manual", status: "queued", startedById: adminId }, select: { id: true } });
      await writeAudit(tx, { actorType: "admin", actorId: adminId }, { action: "backup.started", entity: "backup_run", entityId: created.id });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

/** The monthly full-restore test passed (blueprint "The routine"). */
export async function recordRestoreTest(db: SystemDb, adminId: string, at = new Date()): Promise<Date> {
  await db.$transaction([
    db.platformSettings.update({ where: { id: 1 }, data: { restoreTestPassedAt: at } }),
    writeAudit(db, { actorType: "admin", actorId: adminId }, { action: "backup.restore_test_passed", entity: "platform_settings", entityId: "1", after: { at: at.toISOString() } }),
  ]);
  return at;
}

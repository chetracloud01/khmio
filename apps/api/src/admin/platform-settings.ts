import { writeAudit, type SystemDb } from "@khmio/db";
import type { PlatformSettingsSave } from "@khmio/shared";

// The platform-wide settings the owner edits (admin Settings): the name,
// support contact, the USD to KHR band, the alert chat and the beta switch.

const settingsSelect = { platformName: true, supportTelegram: true, usdToKhrMin: true, usdToKhrMax: true, alertChatId: true, betaAllBasic: true } as const;

export function readPlatformSettings(db: SystemDb) {
  return db.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: settingsSelect });
}

/** Saves them, with what they were before in the audit log. */
export async function savePlatformSettings(db: SystemDb, adminId: string, input: PlatformSettingsSave) {
  const before = await readPlatformSettings(db);
  await db.$transaction([
    db.platformSettings.update({ where: { id: 1 }, data: input }),
    writeAudit(db, { actorType: "admin", actorId: adminId }, { action: "platform.settings_saved", entity: "platform_settings", entityId: "1", before, after: input }),
  ]);
  return readPlatformSettings(db);
}

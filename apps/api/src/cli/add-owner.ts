import { createSystemDb, writeAudit } from "@khmio/db";
import { parseArgs } from "node:util";

// pnpm admin:add-owner -- --telegram-id <id> --name "<name>" [--username <telegram username>]
//
// Makes (or re-makes) a platform owner — the only way to create one; the
// website never makes anyone an admin. Running it again for the same person
// re-enables them and clears their two-step login, so they set it up again
// at the next sign-in (for a lost phone or a lost ADMIN_SECRETS_KEY), and
// signs them out everywhere. If no alert chat is set yet, platform alerts go
// to this owner's private chat with the bot.

async function main() {
  // `pnpm admin:add-owner -- …` passes the "--" through: skip it.
  const args = process.argv.slice(2);
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: { "telegram-id": { type: "string" }, name: { type: "string" }, username: { type: "string" } },
  });
  const telegramId = values["telegram-id"]?.trim() ?? "";
  const name = values.name?.trim() ?? "";
  const username = (values.username ?? "").trim().replace(/^@/, "");
  if (!/^\d{5,20}$/.test(telegramId) || name.length < 2) {
    process.stderr.write('Usage: pnpm admin:add-owner -- --telegram-id <digits> --name "<name>" [--username <name>]\n');
    process.exit(1);
  }
  const ownerUrl = process.env.DATABASE_OWNER_URL;
  if (!ownerUrl) {
    process.stderr.write("DATABASE_OWNER_URL is not set (see .env.example)\n");
    process.exit(1);
  }

  const db = createSystemDb(ownerUrl);
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.adminUser.findUnique({ where: { telegramId } });
      const admin = existing
        ? await tx.adminUser.update({
            where: { id: existing.id },
            data: { name, role: "owner", disabledAt: null, totpSecretEnc: null, totpPendingEnc: null, totpLastStep: 0, failedCodes: 0, lockedUntil: null, ...(username ? { telegramUsername: username } : {}) },
          })
        : await tx.adminUser.create({ data: { name, telegramId, telegramUsername: username, role: "owner" } });
      await tx.adminBackupCode.deleteMany({ where: { adminUserId: admin.id } });
      await tx.adminSession.updateMany({ where: { adminUserId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
      const settings = await tx.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { alertChatId: true } });
      const alertsHere = settings.alertChatId === "";
      if (alertsHere) await tx.platformSettings.update({ where: { id: 1 }, data: { alertChatId: telegramId } });
      await writeAudit(tx, { actorType: "system" }, { action: existing ? "admin.owner_reset" : "admin.owner_added", entity: "admin_user", entityId: admin.id, after: { name, role: "owner" } });
      return { created: !existing, alertsHere };
    });
    // The Telegram id is shown only by its last digits.
    process.stdout.write(
      `${result.created ? "Owner added" : "Owner reset"}: ${name} (Telegram …${telegramId.slice(-3)}). Two-step login will be set up at the next sign-in.` +
        (result.alertsHere ? " Platform alerts will go to this owner's chat with the bot." : "") +
        "\n",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`add-owner failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exit(1);
});

import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { EnvError, loadEnv, workerEnvSchema } from "@khmio/shared";
import { listBackups, pgDumpCommand, pruneBackups, runBackup } from "../backup/backup";
import { backupTarget } from "../jobs/backup";

// pnpm db:backup            — back up the database now (makes S3_BACKUP_BUCKET if it's missing)
// pnpm db:backup -- --list  — the backups in the bucket, oldest first
//
// The same settings as the worker (.env locally, the host's variables in
// production), with BACKUPS=on. Prints names, sizes and times — never a secret.
// A backup made here isn't listed on the admin's Backups page (only the
// worker's runs are); use "Backup now" there to have it recorded.

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const env = loadEnv(workerEnvSchema, process.env);
  if (env.BACKUPS !== "on") {
    process.stderr.write("Set BACKUPS=on and the S3_* / S3_BACKUP_BUCKET settings first (see .env.example).\n");
    process.exit(2);
  }
  const { client, bucket } = backupTarget(env);
  if (process.argv.includes("--list")) {
    const backups = await listBackups(client, bucket);
    for (const backup of backups) console.log(`${backup.Key}  ${mb(backup.Size ?? 0)}  ${backup.LastModified?.toISOString() ?? ""}`);
    console.log(`${backups.length} backup(s) in "${bucket}".`);
    return;
  }
  if (!(await client.send(new HeadBucketCommand({ Bucket: bucket })).then(() => true, () => false))) {
    // Local SeaweedFS: made here. Cloudflare R2: make it in the dashboard (private, no public access).
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" created (private).`);
  }
  const { key, bytes } = await runBackup(client, bucket, pgDumpCommand(env.PG_DUMP_PATH, env.DATABASE_OWNER_URL));
  const removed = await pruneBackups(client, bucket, env.BACKUP_KEEP_DAYS);
  console.log(`Backed up to ${key} (${mb(bytes)}). Removed ${removed.length} backup(s) older than ${env.BACKUP_KEEP_DAYS} days.`);
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof EnvError ? `${error.message}\n` : `db:backup: ${error instanceof Error ? error.message : "failed"}\n`);
  process.exit(1);
});

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createSystemDb } from "@khmio/db";
import { EnvError, loadEnv, workerEnvSchema } from "@khmio/shared";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { listBackups, pgEnvironment } from "../backup/backup";
import { backupTarget } from "../jobs/backup";

// pnpm db:restore -- --from latest            (or --from daily/2026-10-02T20-00-00Z.dump)
//
// Brings a backup back into a NEW, empty database — RESTORE_DATABASE_URL,
// as its owner user — never the one in use: after checking it, point the API
// and worker at it (docs/blueprint.md "When something breaks"). The database
// server must already have the app user (khmer_micro_store_app): the backup's
// row-level-security grants name it.

const APP_USER = "khmer_micro_store_app";

/** Same server and database name = the same database, whatever the user or password. */
function sameDatabase(a: string, b: string): boolean {
  const [x, y] = [new URL(a), new URL(b)];
  return x.hostname === y.hostname && (x.port || "5432") === (y.port || "5432") && x.pathname === y.pathname;
}

function run(command: string, args: string[], env: Record<string, string>): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
    child.on("error", () => resolve({ code: -1, stderr: `couldn't start ${command}: check PG_RESTORE_PATH` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

async function main() {
  const env = loadEnv(workerEnvSchema, process.env);
  const fromIndex = process.argv.indexOf("--from");
  const from = fromIndex > 0 ? process.argv[fromIndex + 1] : undefined;
  const target = process.env.RESTORE_DATABASE_URL;
  if (!from || !target) {
    process.stderr.write("Usage: set RESTORE_DATABASE_URL (a new, empty database), then: pnpm db:restore -- --from latest\n");
    process.exit(2);
  }
  if (sameDatabase(target, env.DATABASE_OWNER_URL)) {
    process.stderr.write("RESTORE_DATABASE_URL is the database in use. Restore into a new one, check it, then switch to it.\n");
    process.exit(2);
  }

  const targetDb = createSystemDb(target);
  try {
    const [empty] = await targetDb.$queryRaw<{ tables: bigint }[]>`SELECT count(*) AS tables FROM pg_tables WHERE schemaname = 'public'`;
    if (Number(empty?.tables ?? 0) > 0) throw new Error("the target database isn't empty: make a new one");
    const [role] = await targetDb.$queryRaw<{ appUser: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${APP_USER}) AS "appUser"`;
    if (!role?.appUser) throw new Error(`the database server has no ${APP_USER} user yet: create it first (infra/setup-local-db.sql or docs/go-live.md)`);

    const { client, bucket } = backupTarget(env);
    const backups = await listBackups(client, bucket);
    const key = from === "latest" ? backups.at(-1)?.Key : backups.find((backup) => backup.Key === from)?.Key;
    if (!key) throw new Error(from === "latest" ? "no backups in the bucket" : "no backup with that name (pnpm db:backup -- --list)");

    const dir = await mkdtemp(join(tmpdir(), "khmio-restore-"));
    const file = join(dir, "backup.dump");
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!(object.Body instanceof Readable)) throw new Error(`backup ${key} came back without a file body`);
      await pipeline(object.Body, createWriteStream(file));
      console.log(`Downloaded ${key}. Restoring...`);
      const pg = pgEnvironment(target);
      const { code, stderr } = await run(env.PG_RESTORE_PATH, ["--no-owner", "--exit-on-error", `--dbname=${pg.PGDATABASE}`, file], pg);
      if (code !== 0) throw new Error(`pg_restore failed: ${stderr.trim().split("\n").slice(-2).join(" ")}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // What came back, to compare with the live database before switching.
    const counts = await targetDb.$queryRaw<{ name: string; rows: bigint }[]>`
      SELECT 'stores' AS name, count(*) AS rows FROM stores UNION ALL
      SELECT 'products', count(*) FROM products UNION ALL
      SELECT 'orders', count(*) FROM orders UNION ALL
      SELECT 'merchants', count(*) FROM merchants`;
    const [migration] = await targetDb.$queryRaw<{ name: string }[]>`SELECT migration_name AS name FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 1`;
    console.log(`Restored ${key}: ${counts.map((count) => `${count.rows} ${count.name}`).join(", ")}; last migration ${migration?.name ?? "none"}.`);
  } finally {
    await targetDb.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof EnvError ? `${error.message}\n` : `db:restore: ${error instanceof Error ? error.message : "failed"}\n`);
  process.exit(1);
});

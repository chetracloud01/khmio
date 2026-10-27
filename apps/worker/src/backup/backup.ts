import { DeleteObjectsCommand, ListObjectsV2Command, S3Client, type _Object } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";

// The daily database backup: pg_dump (custom format, for pg_restore) streamed
// straight into a private bucket — R2 in production, the local SeaweedFS in
// development — then backups older than BACKUP_KEEP_DAYS are removed, but
// never the newest few. pnpm db:restore brings one back into a new database.

export const BACKUP_PREFIX = "daily/";
/** However old, the newest ones stay: if backups stopped for a while, the last good ones must not vanish too. */
export const ALWAYS_KEEP = 3;

export interface S3Settings {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The same client setup as the API's photos (apps/api files/storage.ts): path-style, checksums only when required. */
export function s3Client(settings: S3Settings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
}

/**
 * libpq's own variables for a connection URL, so pg_dump and pg_restore
 * never get the password on their command line (other users of the machine
 * can read command lines).
 */
export function pgEnvironment(url: string): Record<string, string> {
  const parsed = new URL(url);
  const env: Record<string, string> = {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
  };
  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

/** e.g. daily/2026-10-02T20-00-00Z.dump — sorts by time, no characters a bucket or a shell would mind. */
export function backupKey(now: Date): string {
  return `${BACKUP_PREFIX}${now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-")}.dump`;
}

export interface DumpCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** The real dump: everything but pg-boss's own job tables (it rebuilds them when the worker starts). */
export function pgDumpCommand(pgDumpPath: string, databaseUrl: string): DumpCommand {
  return { command: pgDumpPath, args: ["--format=custom", "--no-owner", "--exclude-schema=pgboss"], env: pgEnvironment(databaseUrl) };
}

export interface BackupResult {
  key: string;
  bytes: number;
}

/**
 * Runs the dump and streams it into the bucket. If pg_dump fails part way,
 * the half-written object is removed, so a backup in the bucket is always whole.
 */
export async function runBackup(client: S3Client, bucket: string, dump: DumpCommand, now = new Date()): Promise<BackupResult> {
  const key = backupKey(now);
  const child = spawn(dump.command, dump.args, { env: { ...process.env, ...dump.env }, stdio: ["ignore", "pipe", "pipe"] });
  let bytes = 0;
  let stderr = "";
  const body = new PassThrough();
  child.stdout.on("data", (chunk: Buffer) => (bytes += chunk.length));
  child.stdout.pipe(body);
  child.stderr.on("data", (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-500)));
  let couldNotStart = false;
  const exited = new Promise<number>((resolve) => {
    // pg_dump missing (PG_DUMP_PATH): end the upload's input so it finishes, then report it.
    child.on("error", () => {
      couldNotStart = true;
      body.end();
      resolve(-1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
  const upload = new Upload({ client, params: { Bucket: bucket, Key: key, Body: body, ContentType: "application/octet-stream" } });
  const [code] = await Promise.all([exited, upload.done()]);
  if (couldNotStart) {
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }] } })).catch(() => undefined);
    throw new Error("pg_dump couldn't start: check PG_DUMP_PATH");
  }
  if (code !== 0 || bytes === 0) {
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }] } })).catch(() => undefined);
    // pg_dump's message names the problem (connection refused, version mismatch) without any password.
    throw new Error(`pg_dump failed (exit ${code}): ${stderr.trim().split("\n").pop() ?? ""}`.slice(0, 300));
  }
  return { key, bytes };
}

/** Which backups to remove: older than keepDays, except the newest ALWAYS_KEEP. */
export function backupsToDelete(objects: Pick<_Object, "Key" | "LastModified">[], now: Date, keepDays: number): string[] {
  const newestFirst = objects
    .filter((object): object is { Key: string; LastModified: Date } => Boolean(object.Key?.startsWith(BACKUP_PREFIX) && object.LastModified))
    .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());
  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  return newestFirst
    .slice(ALWAYS_KEEP)
    .filter((object) => object.LastModified.getTime() < cutoff)
    .map((object) => object.Key);
}

export async function listBackups(client: S3Client, bucket: string): Promise<_Object[]> {
  const all: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX, ContinuationToken: token }));
    all.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return all.sort((a, b) => (a.Key ?? "").localeCompare(b.Key ?? ""));
}

/** Removes old backups (after a good one has just been made). Returns the keys removed. */
export async function pruneBackups(client: S3Client, bucket: string, keepDays: number, now = new Date()): Promise<string[]> {
  const old = backupsToDelete(await listBackups(client, bucket), now, keepDays);
  for (let i = 0; i < old.length; i += 1000) {
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: old.slice(i, i + 1000).map((Key) => ({ Key })) } }));
  }
  return old;
}

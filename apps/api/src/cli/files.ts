import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand, PutBucketPolicyCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { getEnv } from "../config";
import { contentTypeOfKey, isPhotoKey } from "../files/photos";
import { PHOTO_CACHE_CONTROL, s3Client, s3SettingsOf } from "../files/storage";

// pnpm files:setup        — make the S3_BUCKET if it's missing, and let anyone read its photos where the storage takes bucket policies
// pnpm files:check        — write a test file, read it back from FILES_PUBLIC_URL, delete it
// pnpm files:copy-to-s3   — copy the photos in FILES_DIR into the bucket (skips ones already there)
//
// Reads the same settings as the API (.env locally, the host's variables in
// production). Prints names and counts, never keys or secrets.

const PROBE_KEY = "health/probe.txt";

async function setup(client: S3Client, bucket: string) {
  const exists = await client.send(new HeadBucketCommand({ Bucket: bucket })).then(() => true, () => false);
  if (!exists) {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" created.`);
  } else {
    console.log(`Bucket "${bucket}" is there.`);
  }
  // Anyone may read photos (they're on public shop pages); nobody may list or write without the keys.
  const policy = {
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${bucket}/stores/*`] }],
  };
  try {
    await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
    console.log("Photos under stores/ can be read by anyone (listing and writing still need the keys).");
  } catch {
    // Cloudflare R2 has no bucket policies: public reads are switched on in its dashboard.
    console.log("This storage doesn't take bucket policies (Cloudflare R2): connect the bucket to a custom domain in the Cloudflare dashboard so photos can be read (docs/go-live.md).");
  }
}

async function check(client: S3Client, bucket: string, publicUrl: string) {
  const body = `probe ${new Date().toISOString()}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: PROBE_KEY, Body: body, ContentType: "text/plain" }));
  console.log("Write: OK");
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: PROBE_KEY })).then(() => true, () => false);
  console.log(`Read back with the keys: ${head ? "OK" : "FAILED"}`);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: PROBE_KEY }));
  console.log("Delete: OK");
  const response = await fetch(`${publicUrl}/stores/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000.jpg`).catch(() => null);
  // A public bucket answers a missing photo with 404; a private one with 403.
  console.log(
    response === null
      ? `Public address: can't reach FILES_PUBLIC_URL`
      : response.status === 404
        ? "Public address: answers, and photos are public (a missing photo gives 404)"
        : `Public address: answered ${response.status} — photos may not be public yet`,
  );
  if (!head || response?.status !== 404) process.exitCode = 1;
}

async function* filesUnder(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* filesUnder(full);
    else yield full;
  }
}

async function copyToS3(client: S3Client, bucket: string, dir: string) {
  const root = resolve(dir);
  let copied = 0;
  let skipped = 0;
  let ignored = 0;
  for await (const file of filesUnder(root)) {
    const key = relative(root, file).split(sep).join("/");
    const type = contentTypeOfKey(key);
    if (!isPhotoKey(key) || !type) {
      ignored += 1;
      continue;
    }
    const there = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(() => true, () => false);
    if (there) {
      skipped += 1;
      continue;
    }
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(file), ContentType: type, CacheControl: PHOTO_CACHE_CONTROL }));
    copied += 1;
  }
  console.log(`Copied ${copied} photo(s); ${skipped} already in the bucket; ${ignored} other file(s) ignored.`);
}

async function main() {
  const command = process.argv.slice(2).filter((arg) => arg !== "--")[0];
  const env = getEnv();
  if (!["setup", "check", "copy-to-s3"].includes(command ?? "")) {
    process.stderr.write("Usage: pnpm files:setup | pnpm files:check | pnpm files:copy-to-s3\n");
    process.exit(2);
  }
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    process.stderr.write("Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY first (see .env.example).\n");
    process.exit(2);
  }
  const settings = s3SettingsOf(env);
  const client = s3Client(settings);
  if (command === "setup") await setup(client, settings.bucket);
  if (command === "check") {
    if (!env.FILES_PUBLIC_URL) {
      process.stderr.write("Set FILES_PUBLIC_URL (the bucket's public address) first.\n");
      process.exit(2);
    }
    await check(client, settings.bucket, env.FILES_PUBLIC_URL.replace(/\/$/, ""));
  }
  if (command === "copy-to-s3") await copyToS3(client, settings.bucket, env.FILES_DIR);
}

main().catch((error: unknown) => {
  // The S3 error's name says what's wrong (NoSuchBucket, InvalidAccessKeyId…) without any secret.
  process.stderr.write(`files: ${error instanceof Error ? error.name : "failed"}\n`);
  process.exit(1);
});

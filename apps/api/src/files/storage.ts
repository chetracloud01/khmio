import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isLocalNetworkOrigin, type ApiEnv } from "@khmio/shared";
import type { Provider } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { getEnv } from "../config";
import { isPhotoKey } from "./photos";

/**
 * Where photos live. The database keeps only each photo's key
 * (`stores/<store id>/<file>`); this decides where the bytes go.
 * - LocalFileStorage: a folder on this machine, served by the API's /files
 *   (FILE_STORAGE=local, the simplest way to develop).
 * - S3FileStorage: an S3-compatible bucket — Cloudflare R2 in production,
 *   SeaweedFS locally (FILE_STORAGE=s3, pnpm s3:up) — served from the bucket's public address.
 * Switching between them needs no database change, only the files copied
 * (pnpm files:copy-to-s3).
 */
export interface FileStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  publicUrl(key: string): string;
}

export const FILE_STORAGE = Symbol("FILE_STORAGE");

/** Keys are made by the API (newPhotoKey); anything else is refused, wherever it's stored. */
export function assertSafeKey(key: string): void {
  if (!isPhotoKey(key)) throw new Error("bad file key");
}

/** Photo keys are random and never reused, so browsers and Cloudflare may keep them for a year. */
export const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(
    dir: string,
    private readonly baseUrl: string,
  ) {
    this.root = resolve(dir);
  }

  /** The file's path, refusing any key that would step outside the folder. */
  private path(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error("file key outside storage");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    assertSafeKey(key);
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async read(key: string): Promise<Buffer | null> {
    return readFile(this.path(key)).catch(() => null);
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** One client setup for photos (API) and backups (worker): path-style addresses work on R2 and on the local SeaweedFS. */
export function s3Client(settings: S3Settings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: true,
    // Newer SDKs add checksums to every upload by default; R2 and other S3 servers don't all accept them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
}

export class S3FileStorage implements FileStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly baseUrl: string,
  ) {}

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, CacheControl: PHOTO_CACHE_CONTROL }));
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

/** The S3 settings from the environment (the schema has already checked they're all there for FILE_STORAGE=s3). */
export function s3SettingsOf(env: Pick<ApiEnv, "S3_ENDPOINT" | "S3_REGION" | "S3_BUCKET" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY">): S3Settings {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("S3 settings missing");
  return { endpoint: S3_ENDPOINT, region: env.S3_REGION, bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY };
}

export function createFileStorage(env: ApiEnv): FileStorage {
  if (env.FILE_STORAGE === "s3") {
    const settings = s3SettingsOf(env);
    return new S3FileStorage(s3Client(settings), settings.bucket, env.FILES_PUBLIC_URL!.replace(/\/$/, ""));
  }
  return new LocalFileStorage(env.FILES_DIR, localFilesBaseUrl(env));
}

/**
 * Where photos on this machine's disk are served from. Development, unless
 * FILES_PUBLIC_URL names a real domain (a tunnel): same-site links (/files/…)
 * that the web app passes through to this API (apps/web next.config.mjs), so
 * photos show at whatever address the site was opened with. Otherwise the
 * full address.
 */
export function localFilesBaseUrl(env: Pick<ApiEnv, "NODE_ENV" | "FILES_PUBLIC_URL" | "PORT">): string {
  const saved = env.FILES_PUBLIC_URL?.replace(/\/$/, "");
  if (env.NODE_ENV === "development" && (!saved || isLocalNetworkOrigin(saved))) return "/files";
  return saved ?? `http://localhost:${env.PORT}/files`;
}

export const fileStorageProvider: Provider = {
  provide: FILE_STORAGE,
  useFactory: (): FileStorage => createFileStorage(getEnv()),
};

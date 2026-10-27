import { describe, expect, it } from "vitest";
import { apiEnvSchema, EnvError, loadEnv, workerEnvSchema } from "./env";

const DATABASE_URL = "postgresql://app:s3cret-password@localhost:5432/app";
const DATABASE_OWNER_URL = "postgresql://owner:s3cret-password@localhost:5432/app";

describe("server settings", () => {
  it("fills in defaults for local development", () => {
    const env = loadEnv(apiEnvSchema, { DATABASE_URL, DATABASE_OWNER_URL });
    expect(env).toMatchObject({ NODE_ENV: "development", PORT: 4000, WEB_ORIGIN: ["http://localhost:3000"], LOG_LEVEL: "info" });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("treats an empty value as not set", () => {
    expect(loadEnv(workerEnvSchema, { DATABASE_OWNER_URL, SENTRY_DSN: "" }).SENTRY_DSN).toBeUndefined();
  });

  it("lists every problem by name", () => {
    try {
      loadEnv(apiEnvSchema, { PORT: "abc", WEB_ORIGIN: "not a url" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const { problems } = error as EnvError;
      expect(problems.map((problem) => problem.split(":")[0]).sort()).toEqual(["DATABASE_OWNER_URL", "DATABASE_URL", "PORT", "WEB_ORIGIN.0"]);
    }
  });

  it("accepts several web addresses, separated by commas", () => {
    const env = loadEnv(apiEnvSchema, { DATABASE_OWNER_URL, DATABASE_URL: DATABASE_OWNER_URL, WEB_ORIGIN: "http://localhost:3000, http://192.168.40.39:3000" });
    expect(env.WEB_ORIGIN).toEqual(["http://localhost:3000", "http://192.168.40.39:3000"]);
  });

  it("never repeats a value in its message — it may be a secret", () => {
    try {
      loadEnv(apiEnvSchema, { DATABASE_OWNER_URL, DATABASE_URL: "mysql://user:s3cret-password@host/db" });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("s3cret");
    }
  });

  it("refuses to start production without https and its required settings", () => {
    try {
      loadEnv(apiEnvSchema, { NODE_ENV: "production", DATABASE_OWNER_URL, DATABASE_URL, WEB_ORIGIN: "http://shop.example.com", FILES_PUBLIC_URL: "http://files.example.com" });
      expect.unreachable();
    } catch (error) {
      const { problems } = error as EnvError;
      expect(problems.map((problem) => problem.split(":")[0]).sort()).toEqual(["ADMIN_SECRETS_KEY", "FILES_PUBLIC_URL", "FILE_STORAGE", "TELEGRAM_BOT_TOKEN", "TURNSTILE_SECRET_KEY", "WEB_ORIGIN.0"]);
    }
    const productionSource = {
      NODE_ENV: "production",
      DATABASE_OWNER_URL,
      DATABASE_URL,
      WEB_ORIGIN: "https://shop.example.com",
      TELEGRAM_BOT_TOKEN: "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh",
      ADMIN_SECRETS_KEY: "A".repeat(43) + "=",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      TRUST_PROXY_HOPS: "1",
      FILE_STORAGE: "s3",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_BUCKET: "khmio-photos",
      S3_ACCESS_KEY_ID: "key-id",
      S3_SECRET_ACCESS_KEY: "s3cret",
      FILES_PUBLIC_URL: "https://files.example.com",
    };
    const ready = loadEnv(apiEnvSchema, productionSource);
    expect(ready.TRUST_PROXY_HOPS).toBe(1);
    expect(ready.RATE_LIMITS).toBe("on");
    expect(() => loadEnv(apiEnvSchema, { ...productionSource, RATE_LIMITS: "off" })).toThrow(EnvError);
    expect(ready.KHQR_PROVIDER).toBe("off");
    expect(() => loadEnv(apiEnvSchema, { ...productionSource, KHQR_PROVIDER: "fake" })).toThrow(EnvError);
  });

  it("the worker needs the bot and backups in production", () => {
    try {
      loadEnv(workerEnvSchema, { NODE_ENV: "production", DATABASE_OWNER_URL, WEB_ORIGIN: "https://shop.example.com" });
      expect.unreachable();
    } catch (error) {
      expect((error as EnvError).problems.map((problem) => problem.split(":")[0]).sort()).toEqual(["BACKUPS", "TELEGRAM_BOT_TOKEN"]);
    }
  });

  it("backups need their own private bucket", () => {
    const s3 = { S3_ENDPOINT: "http://localhost:9000", S3_ACCESS_KEY_ID: "localdev", S3_SECRET_ACCESS_KEY: "localdev-secret" };
    expect(() => loadEnv(workerEnvSchema, { DATABASE_OWNER_URL, BACKUPS: "on", ...s3 })).toThrow(EnvError);
    expect(() => loadEnv(workerEnvSchema, { DATABASE_OWNER_URL, BACKUPS: "on", ...s3, S3_BUCKET: "khmio-photos", S3_BACKUP_BUCKET: "khmio-photos" })).toThrow(EnvError);
    const env = loadEnv(workerEnvSchema, { DATABASE_OWNER_URL, BACKUPS: "on", ...s3, S3_BUCKET: "khmio-photos", S3_BACKUP_BUCKET: "khmio-backups" });
    expect(env).toMatchObject({ BACKUP_KEEP_DAYS: 14, PG_DUMP_PATH: "pg_dump" });
  });

  it("S3 storage needs all its settings", () => {
    try {
      loadEnv(apiEnvSchema, { DATABASE_OWNER_URL, DATABASE_URL, FILE_STORAGE: "s3", S3_BUCKET: "khmio-photos" });
      expect.unreachable();
    } catch (error) {
      const { problems } = error as EnvError;
      expect(problems.map((problem) => problem.split(":")[0]).sort()).toEqual(["FILES_PUBLIC_URL", "S3_ACCESS_KEY_ID", "S3_ENDPOINT", "S3_SECRET_ACCESS_KEY"]);
    }
    const env = loadEnv(apiEnvSchema, {
      DATABASE_OWNER_URL,
      DATABASE_URL,
      FILE_STORAGE: "s3",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "khmio-photos",
      S3_ACCESS_KEY_ID: "localdev",
      S3_SECRET_ACCESS_KEY: "localdev-secret",
      FILES_PUBLIC_URL: "http://localhost:9000/khmio-photos",
    });
    expect(env.S3_REGION).toBe("auto");
  });
});

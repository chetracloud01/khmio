import { loadEnv, apiEnvSchema } from "@khmio/shared";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isPhotoKey, isStorePhotoKey, thumbKeyOf } from "./photos";
import { assertSafeKey, createFileStorage, LocalFileStorage, S3FileStorage } from "./storage";

const base = { DATABASE_URL: "postgresql://a:b@localhost/x", DATABASE_OWNER_URL: "postgresql://a:b@localhost/x" };
const key = () => `stores/${randomUUID()}/${randomUUID()}.jpg`;
// A tiny real JPEG header is enough: storage doesn't look inside.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("photo storage", () => {
  it("only stores keys the API makes", () => {
    expect(() => assertSafeKey(key())).not.toThrow();
    for (const bad of ["../../etc/passwd", "stores/../x.jpg", `stores/${randomUUID()}/x.svg`, "health/probe.txt", `stores/${randomUUID()}/${randomUUID()}.html`]) {
      expect(() => assertSafeKey(bad)).toThrow();
    }
  });

  it("picks the folder or the bucket from FILE_STORAGE", () => {
    expect(createFileStorage(loadEnv(apiEnvSchema, base))).toBeInstanceOf(LocalFileStorage);
    const s3 = createFileStorage(
      loadEnv(apiEnvSchema, {
        ...base,
        FILE_STORAGE: "s3",
        S3_ENDPOINT: "http://localhost:9000",
        S3_BUCKET: "khmio-photos",
        S3_ACCESS_KEY_ID: "id",
        S3_SECRET_ACCESS_KEY: "secret",
        FILES_PUBLIC_URL: "https://files.example.com/",
      }),
    );
    expect(s3).toBeInstanceOf(S3FileStorage);
    expect(s3.publicUrl("stores/a/b.jpg")).toBe("https://files.example.com/stores/a/b.jpg");
  });
});

// Against a real S3 server (the local SeaweedFS from pnpm s3:up) when S3_ENDPOINT is set.
const s3Env = process.env.FILE_STORAGE === "s3" && process.env.S3_ENDPOINT ? loadEnv(apiEnvSchema, { ...base, ...process.env }) : null;

describe.skipIf(!s3Env)("photo storage in a real S3 bucket", () => {
  it("writes a photo, reads it back, and serves it publicly with its type and a long cache", async () => {
    const storage = createFileStorage(s3Env!);
    const photo = key();
    await storage.put(photo, JPEG, "image/jpeg");
    expect(await storage.read(photo)).toEqual(JPEG);
    const response = await fetch(storage.publicUrl(photo));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("answers null for a photo that isn't there", async () => {
    expect(await createFileStorage(s3Env!).read(key())).toBeNull();
  });
});

describe("photo thumbnails", () => {
  it("keeps the small copy next to the photo, always as a JPEG", () => {
    const store = randomUUID();
    const name = randomUUID();
    expect(thumbKeyOf(`stores/${store}/${name}.png`)).toBe(`stores/${store}/${name}-t.jpg`);
    expect(isPhotoKey(thumbKeyOf(`stores/${store}/${name}.webp`))).toBe(true);
  });

  it("never lets a product point at a thumbnail, or at another shop's photo", () => {
    const store = randomUUID();
    const photo = `stores/${store}/${randomUUID()}.jpg`;
    expect(isStorePhotoKey(store, photo)).toBe(true);
    expect(isStorePhotoKey(store, thumbKeyOf(photo))).toBe(false);
    expect(isStorePhotoKey(randomUUID(), photo)).toBe(false);
  });
});

import { randomUUID } from "node:crypto";

/** After the browser has compressed it (design: photos are resized before upload), a photo is well under this. */
export const MAX_PHOTO_BYTES = 2_000_000;
/** The small copy for lists (about 400 px), made by the browser next to the photo. */
export const MAX_THUMB_BYTES = 200_000;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";
const EXTENSION: Record<PhotoType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * What a file really is, from its first bytes — never from its name or the
 * type the browser claims. Anything that isn't a JPEG, PNG or WebP is refused.
 */
export function detectPhotoType(data: Buffer): PhotoType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** A new photo's key: inside its store's folder, with a random name. */
export function newPhotoKey(storeId: string, type: PhotoType): string {
  return `stores/${storeId}/${randomUUID()}.${EXTENSION[type]}`;
}

const KEY = /^stores\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const THUMB_KEY = /^stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}-t\.jpg$/;

/** A key the API could have made (newPhotoKey or thumbKeyOf), in any store's folder. */
export function isPhotoKey(key: string): boolean {
  return KEY.test(key) || THUMB_KEY.test(key);
}

/**
 * Where a photo's small copy lives: next to it, always a JPEG
 * (stores/<store>/<name>-t.jpg). Photos uploaded before thumbnails existed
 * have none; the screens then fall back to the full photo.
 */
export function thumbKeyOf(key: string): string {
  return key.replace(/\.(jpg|png|webp)$/, "-t.jpg");
}

/** True only for a photo key in this store's own folder — a product can't point at another shop's photos. */
export function isStorePhotoKey(storeId: string, key: string): boolean {
  return KEY.exec(key)?.[1] === storeId;
}

export function contentTypeOfKey(key: string): PhotoType | null {
  const extension = key.split(".").pop();
  return extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : null;
}

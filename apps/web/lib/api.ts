import { FORM_ERROR_CODES, followLocalAddress, isLocalNetworkHost, type FormErrorCode } from "@khmio/shared";
import { z } from "zod";
import { meSchema, uploadedPhotoSchema, type Me, type UploadedPhoto } from "./api-answers";

export * from "./api-answers";

// The browser's way to the API (apps/api). The session lives in an HttpOnly
// cookie the API sets, so every call sends cookies; page scripts never see it.

const SAVED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Where the API is. Production: exactly NEXT_PUBLIC_API_URL. Development, when
 * that is a local address (localhost, 192.168.x …): in the browser, the same
 * address the page was opened with — so a PC that joins another Wi-Fi needs no
 * settings change, and the admin cookie stays same-site — and on the server,
 * the API on this machine.
 */
export function apiBaseUrl(): string {
  if (process.env.NODE_ENV === "production") return SAVED_API_URL;
  if (typeof window !== "undefined") return followLocalAddress(SAVED_API_URL, window.location);
  try {
    const url = new URL(SAVED_API_URL);
    return isLocalNetworkHost(url.hostname) ? `http://localhost:${url.port || "80"}` : SAVED_API_URL;
  } catch {
    return SAVED_API_URL;
  }
}

/** The API's one error shape (apps/api errors.ts). `status` 0 = the API couldn't be reached at all. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, FormErrorCode> = {},
  ) {
    super(code);
    this.name = "ApiError";
  }
}

const errorBodySchema = z.object({ error: z.string(), fields: z.record(z.enum(FORM_ERROR_CODES)).optional() });

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
}

/** Sends one request and returns the answer's JSON (null when it has none); a refusal becomes an ApiError. */
async function request(path: string, options: RequestOptions): Promise<{ status: number; data: unknown }> {
  let response: Response;
  const json = options.body !== undefined;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      // A FormData body sets its own Content-Type (with the multipart boundary).
      headers: json ? { "Content-Type": "application/json" } : undefined,
      body: options.form ?? (json ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "unreachable");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = errorBodySchema.safeParse(data);
    throw new ApiError(response.status, body.success ? body.data.error : "internal", body.success ? (body.data.fields ?? {}) : {});
  }
  return { status: response.status, data };
}

/**
 * Calls the API and reads its answer with `answer` (lib/api-answers/). An
 * answer of another shape is refused as ApiError "bad_answer", so a screen
 * shows its error state instead of breaking on a missing field.
 */
export async function api<Answer extends z.ZodTypeAny>(path: string, answer: Answer, options: RequestOptions = {}): Promise<z.output<Answer>> {
  const { status, data } = await request(path, options);
  const parsed = answer.safeParse(data);
  if (parsed.success) return parsed.data;
  // Only where the shape differs, never the values: an answer can hold a buyer's phone.
  if (process.env.NODE_ENV !== "production") console.error(`API answer for ${path} has another shape:`, parsed.error.issues.map((issue) => issue.path.join(".")));
  throw new ApiError(status, "bad_answer");
}

/** Calls the API for what it does, not for an answer (save, delete, sign out). */
export async function apiSend(path: string, options: RequestOptions = {}): Promise<void> {
  await request(path, options);
}

/** null when nobody is signed in. */
export async function getMe(): Promise<Me | null> {
  try {
    return await api("/auth/me", meSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Sends one photo (already shrunk in the browser), and optionally its small copy for lists (about 400 px); returns the keys to save with the product or logo. */
export function uploadPhoto(photo: Blob, thumb?: Blob): Promise<UploadedPhoto> {
  const form = new FormData();
  form.append("file", photo, "photo.jpg");
  if (thumb) form.append("thumb", thumb, "thumb.jpg");
  return api("/uploads/photo", uploadedPhotoSchema, { method: "POST", form });
}

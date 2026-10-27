import { telegramLoginPayloadSchema, type TelegramLoginPayload } from "@khmio/shared";

const FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"] as const;

/**
 * The signed login Telegram sends back in the address after "Log in with
 * Telegram" (the button's redirect mode), or null if there isn't one. The
 * API still checks Telegram's signature; this only reads the fields.
 */
export function telegramLoginFromQuery(params: URLSearchParams): TelegramLoginPayload | null {
  if (!params.has("hash") || !params.has("id")) return null;
  const raw: Record<string, string | number> = {};
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value !== null) raw[field] = field === "id" || field === "auth_date" ? Number(value) : value;
  }
  const parsed = telegramLoginPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The same address without Telegram's login fields, so they don't stay in the history or get shared. */
export function withoutTelegramLogin(url: URL): string {
  const clean = new URL(url);
  for (const field of FIELDS) clean.searchParams.delete(field);
  return `${clean.pathname}${clean.search}${clean.hash}`;
}

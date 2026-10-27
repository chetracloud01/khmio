import { isLocalNetworkOrigin, type ApiEnv } from "@khmio/shared";

type OriginCheck = (origin: string | undefined, done: (error: Error | null, allow?: boolean) => void) => void;

/**
 * Which web pages may call the API from a browser. Production: exactly the
 * WEB_ORIGIN addresses (https only — the start-up checks refuse anything else).
 * Development: those, plus any page on this PC or its local network
 * (localhost, 192.168.x …), so a PC that joins another Wi-Fi keeps working
 * without a settings change (packages/shared local-network.ts).
 */
export function corsOrigin(env: Pick<ApiEnv, "NODE_ENV" | "WEB_ORIGIN">): string[] | OriginCheck {
  if (env.NODE_ENV === "production") return env.WEB_ORIGIN;
  return (origin, done) => done(null, origin === undefined || env.WEB_ORIGIN.includes(origin) || isLocalNetworkOrigin(origin));
}

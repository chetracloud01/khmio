import { apiEnvSchema, loadEnv, type ApiEnv } from "@khmio/shared";

let cached: ApiEnv | undefined;

/**
 * The API's settings, checked against packages/shared env.ts. main.ts calls
 * this first, so a bad .env stops start-up before anything else runs.
 */
export function getEnv(): ApiEnv {
  cached ??= loadEnv(apiEnvSchema, process.env);
  return cached;
}

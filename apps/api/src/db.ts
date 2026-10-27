import { createAppDb, createSystemDb, type AppDb, type SystemDb } from "@khmio/db";
import { Inject, Injectable, type OnApplicationShutdown, type Provider } from "@nestjs/common";
import { getEnv } from "./config";

/**
 * The two database clients (packages/db): APP_DB for all shop data, under
 * row-level security; SYSTEM_DB only for login, sessions, creating a store
 * and checking a link is free.
 *
 * Injection uses explicit tokens (`@Inject(APP_DB)`), never constructor
 * types: the dev runner and the bundler (esbuild) don't emit decorator type
 * metadata, so type-based injection would silently get `undefined`.
 */
export const APP_DB = Symbol("APP_DB");
export const SYSTEM_DB = Symbol("SYSTEM_DB");

export const dbProviders: Provider[] = [
  { provide: APP_DB, useFactory: (): AppDb => createAppDb(getEnv().DATABASE_URL) },
  { provide: SYSTEM_DB, useFactory: (): SystemDb => createSystemDb(getEnv().DATABASE_OWNER_URL) },
];

@Injectable()
export class DbShutdown implements OnApplicationShutdown {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(SYSTEM_DB) private readonly system: SystemDb,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.app.$disconnect(), this.system.$disconnect()]);
  }
}

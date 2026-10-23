import { PrismaClient, type Prisma } from "@prisma/client";

export * from "@prisma/client";
export * from "./alerts";
export * from "./audit";

// Two ways into the database (docs/blueprint.md "Multi-tenant safety"):
//
// - AppDb, the API's everyday user (khmer_micro_store_app). Row-level security
//   applies: inside withContext() it sees only the signed-in merchant and the
//   store they act for, and outside it sees nothing. All shop data goes
//   through this one.
// - SystemDb, the owner (khmer_micro_store). Not limited: only for the few
//   things that must look across shops — login, sessions, creating a store,
//   checking a link is free, the worker and (later) the admin area.
//
// The two are different types, so one can't be passed where the other is meant.

declare const kind: unique symbol;
export type AppDb = PrismaClient & { readonly [kind]: "app" };
export type SystemDb = PrismaClient & { readonly [kind]: "system" };
export type Tx = Prisma.TransactionClient;

export function createAppDb(url: string): AppDb {
  return new PrismaClient({ datasources: { db: { url } } }) as AppDb;
}

export function createSystemDb(url: string): SystemDb {
  return new PrismaClient({ datasources: { db: { url } } }) as SystemDb;
}

export interface RequestContext {
  merchantId: string;
  /** The store the request acts for. The database ignores it unless the merchant is a member. */
  storeId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `work` in one transaction that tells the database who it is for. The
 * setting is local to the transaction, so it can never leak into another
 * request sharing the same connection.
 */
export async function withContext<T>(db: AppDb, context: RequestContext, work: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(context.merchantId) || (context.storeId !== undefined && !UUID.test(context.storeId))) {
    throw new Error("withContext: merchantId and storeId must be UUIDs");
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.merchant_id', ${context.merchantId}, true), set_config('app.store_id', ${context.storeId ?? ""}, true)`;
    return work(tx);
  });
}

/**
 * Runs `work` as a buyer looking at one shop (no signed-in merchant): the
 * database shows only that store's name, categories and visible products.
 * Returns null when no store has this link.
 */
export async function withPublicStore<T>(db: AppDb, slug: string, work: (tx: Tx, storeId: string) => Promise<T>): Promise<T | null> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string | null }[]>`SELECT app_store_id_by_slug(${slug}) AS id`;
    const storeId = row?.id;
    if (!storeId) return null;
    await tx.$executeRaw`SELECT set_config('app.public_store_id', ${storeId}, true)`;
    return work(tx, storeId);
  });
}

/**
 * Inside withPublicStore: lets this buyer add one order — the one carrying
 * `token` — with its lines and first status, and read it back. Nothing else
 * becomes visible (step 4 migration, "The buyer").
 */
export async function asOrderBuyer(tx: Tx, token: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.order_token', ${token}, true)`;
}

/**
 * Runs `work` as the buyer holding an order link: the database shows that one
 * order, its lines and its history, plus its store's public face. Returns null
 * when no order has this token.
 */
export async function withPublicOrder<T>(db: AppDb, token: string, work: (tx: Tx, storeId: string) => Promise<T>): Promise<T | null> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string | null }[]>`SELECT app_store_id_by_order_token(${token}) AS id`;
    const storeId = row?.id;
    if (!storeId) return null;
    await tx.$executeRaw`SELECT set_config('app.public_store_id', ${storeId}, true)`;
    await asOrderBuyer(tx, token);
    return work(tx, storeId);
  });
}

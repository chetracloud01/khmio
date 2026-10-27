import type { AuditLog, SystemDb } from "@khmio/db";
import type { PlatformProductId } from "@khmio/shared";

// The admin's Activity page (every audit row, newest first, with who and
// which shop) and the website waitlist. Both page backwards: "older" passes
// the last row's time as `before`.

export interface ActivityQuery {
  storeId?: string;
  /** The start of an action name: "store." shows every shop change. */
  action?: string;
  before?: string;
  limit: number;
}

export async function readActivity(db: SystemDb, query: ActivityQuery) {
  const rows = await db.auditLog.findMany({
    where: {
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.before ? { at: { lt: new Date(query.before) } } : {}),
    },
    orderBy: { at: "desc" },
    take: query.limit,
  });
  // Names for the people and shops on this page, read once.
  const idsOf = (type: AuditLog["actorType"]) => rows.flatMap((row) => (row.actorType === type && row.actorId ? [row.actorId] : []));
  const [admins, merchants, stores] = await Promise.all([
    db.adminUser.findMany({ where: { id: { in: idsOf("admin") } }, select: { id: true, name: true } }),
    db.merchant.findMany({ where: { id: { in: idsOf("merchant") } }, select: { id: true, firstName: true } }),
    db.store.findMany({ where: { id: { in: rows.flatMap((row) => (row.storeId ? [row.storeId] : [])) } }, select: { id: true, name: true } }),
  ]);
  const people = new Map<string, string>([...admins.map((admin) => [admin.id, admin.name] as const), ...merchants.map((merchant) => [merchant.id, merchant.firstName] as const)]);
  const shops = new Map(stores.map((store) => [store.id, store.name]));
  return { entries: toActivityEntries(rows, people, shops), more: rows.length === query.limit };
}

/** Each row with the name of who did it and of the shop, when they're known. */
export function toActivityEntries(rows: AuditLog[], people: Map<string, string>, shops: Map<string, string>) {
  return rows.map((row) => ({
    id: row.id,
    at: row.at,
    actorType: row.actorType,
    actorName: row.actorId ? (people.get(row.actorId) ?? null) : null,
    storeId: row.storeId,
    storeName: row.storeId ? (shops.get(row.storeId) ?? null) : null,
    action: row.action,
    entity: row.entity,
    before: row.before,
    after: row.after,
  }));
}

export async function readWaitlist(db: SystemDb, query: { product?: PlatformProductId; before?: string; limit: number }) {
  const [counts, signups] = await Promise.all([
    db.waitlistSignup.groupBy({ by: ["product"], _count: { _all: true } }),
    db.waitlistSignup.findMany({
      where: { ...(query.product ? { product: query.product } : {}), ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: { id: true, product: true, name: true, phone: true, businessType: true, createdAt: true },
    }),
  ]);
  return { counts: Object.fromEntries(counts.map((row) => [row.product, row._count._all])), signups, more: signups.length === query.limit };
}

import type { Prisma, SystemDb } from "@khmio/db";
import { periodEnd } from "./subscription-override";

// The admin's shop list and one shop's page (design/screens.md A2, A3),
// read across every shop as the owner user.

/** Most shops the list returns; the admin table searches and filters them in the browser. */
const MERCHANT_LIST_LIMIT = 500;
/** The last changes shown on a shop's page. */
const SHOP_AUDIT_ROWS = 30;

const subscriptionSelect = { plan: true, status: true, trialEndsAt: true, currentPeriodStart: true, currentPeriodEnd: true } satisfies Prisma.SubscriptionSelect;
const personSelect = { firstName: true, lastName: true, identities: { select: { telegramUsername: true } } } satisfies Prisma.MerchantSelect;
type Person = Prisma.MerchantGetPayload<{ select: typeof personSelect }>;

const fullName = (person: Person) => [person.firstName, person.lastName].filter(Boolean).join(" ");
const telegramUsername = (person: Person) => person.identities.find((identity) => identity.telegramUsername)?.telegramUsername ?? null;

/** A shop by its name, its link, or its owner's Telegram username (with or without @). */
export function merchantSearch(q: string | undefined): Prisma.StoreWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { members: { some: { merchant: { identities: { some: { telegramUsername: { contains: q.replace(/^@/, ""), mode: "insensitive" } } } } } } },
    ],
  };
}

const merchantRowSelect = {
  id: true,
  slug: true,
  name: true,
  businessType: true,
  createdAt: true,
  subscription: { select: subscriptionSelect },
  members: { where: { role: "owner" }, take: 1, select: { merchant: { select: personSelect } } },
  _count: { select: { products: { where: { deletedAt: null } }, orders: true } },
} satisfies Prisma.StoreSelect;
type MerchantRow = Prisma.StoreGetPayload<{ select: typeof merchantRowSelect }>;

export async function readMerchants(db: SystemDb, q: string | undefined) {
  const stores = await db.store.findMany({ where: merchantSearch(q), orderBy: { createdAt: "desc" }, take: MERCHANT_LIST_LIMIT, select: merchantRowSelect });
  return stores.map(toMerchantRow);
}

export function toMerchantRow(store: MerchantRow) {
  const owner = store.members[0]?.merchant;
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    businessType: store.businessType,
    createdAt: store.createdAt,
    owner: owner ? { name: fullName(owner), telegramUsername: telegramUsername(owner) } : null,
    plan: store.subscription?.plan ?? null,
    status: store.subscription?.status ?? null,
    endsAt: store.subscription ? periodEnd(store.subscription) : null,
    products: store._count.products,
    orders: store._count.orders,
  };
}

const merchantDetailSelect = {
  id: true,
  slug: true,
  name: true,
  businessType: true,
  phone: true,
  area: true,
  createdAt: true,
  deliveryConfiguredAt: true,
  subscription: { select: subscriptionSelect },
  members: { select: { role: true, merchant: { select: personSelect } } },
  _count: { select: { products: { where: { deletedAt: null } }, orders: true } },
} satisfies Prisma.StoreSelect;
type MerchantDetailRow = Prisma.StoreGetPayload<{ select: typeof merchantDetailSelect }>;
const shopAuditSelect = { id: true, at: true, actorType: true, action: true, after: true } satisfies Prisma.AuditLogSelect;
type ShopAuditRow = Prisma.AuditLogGetPayload<{ select: typeof shopAuditSelect }>;

/** One shop's page, or null when there's no such shop. */
export async function readMerchantDetail(db: SystemDb, storeId: string) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: merchantDetailSelect });
  if (!store) return null;
  const [lastOrder, audit] = await Promise.all([
    db.order.findFirst({ where: { storeId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.auditLog.findMany({ where: { storeId }, orderBy: { at: "desc" }, take: SHOP_AUDIT_ROWS, select: shopAuditSelect }),
  ]);
  return toMerchantDetail(store, lastOrder?.createdAt ?? null, audit);
}

export function toMerchantDetail(store: MerchantDetailRow, lastOrderAt: Date | null, audit: ShopAuditRow[]) {
  const { members, _count, subscription, ...rest } = store;
  return {
    ...rest,
    subscription: subscription ? { ...subscription, endsAt: periodEnd(subscription) } : null,
    members: members.map((member) => ({ role: member.role, name: fullName(member.merchant), telegramUsername: telegramUsername(member.merchant) })),
    products: _count.products,
    orders: _count.orders,
    lastOrderAt,
    audit,
  };
}

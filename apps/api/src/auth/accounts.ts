import { type AppDb, type SystemDb, withContext, writeAudit } from "@khmio/db";

export interface TelegramIdentity {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
}

/**
 * Sign-up and log-in are one flow (docs/blueprint.md "Merchant sign-up and
 * login"): the first verified Telegram login creates the merchant, later ones
 * find them and refresh their name and username.
 */
export async function findOrCreateTelegramMerchant(db: SystemDb, identity: TelegramIdentity): Promise<string> {
  return db.$transaction(async (tx) => {
    const existing = await tx.merchantIdentity.findUnique({
      where: { method_providerUserId: { method: "telegram", providerUserId: identity.telegramId } },
    });
    if (existing) {
      await tx.merchantIdentity.update({ where: { id: existing.id }, data: { telegramUsername: identity.username ?? null } });
      return existing.merchantId;
    }
    const merchant = await tx.merchant.create({
      data: {
        firstName: identity.firstName,
        lastName: identity.lastName ?? "",
        identities: { create: { method: "telegram", providerUserId: identity.telegramId, telegramUsername: identity.username ?? null } },
      },
    });
    await writeAudit(tx, { actorType: "merchant", actorId: merchant.id }, { action: "merchant.signed_up", entity: "merchant", entityId: merchant.id });
    return merchant.id;
  });
}

/** Who is signed in, and their store if they have one (Release 1: the first), read as them under row-level security. */
export async function readMe(app: AppDb, merchantId: string) {
  const { merchant, storeIds } = await withContext(app, { merchantId }, async (tx) => ({
    merchant: await tx.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { firstName: true, lastName: true, identities: { select: { method: true, telegramUsername: true } } },
    }),
    storeIds: (await tx.storeMember.findMany({ where: { merchantId }, select: { storeId: true }, orderBy: { createdAt: "asc" } })).map((member) => member.storeId),
  }));
  const storeId = storeIds[0];
  const store = storeId
    ? await withContext(app, { merchantId, storeId }, (tx) =>
        tx.store.findUnique({
          where: { id: storeId },
          select: { id: true, slug: true, name: true, businessType: true, phone: true, subscription: { select: { plan: true, status: true, trialEndsAt: true } } },
        }),
      )
    : null;
  return { merchant: toMeMerchant(merchant), store };
}

/** The merchant's name, and their Telegram username when they signed in with Telegram (new-order alerts reach that chat). */
export function toMeMerchant(merchant: { firstName: string; lastName: string; identities: { method: string; telegramUsername: string | null }[] }) {
  const telegram = merchant.identities.find((identity) => identity.method === "telegram");
  return { firstName: merchant.firstName, lastName: merchant.lastName, telegramUsername: telegram?.telegramUsername ?? null, signedInWithTelegram: telegram !== undefined };
}

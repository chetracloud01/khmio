import type { Tx } from "@khmio/db";
import { khqrProviderFor, type PaymentProvider } from "@khmio/payments";
import { KHQR_CODE_MINUTES, type Currency } from "@khmio/shared";
import { getEnv } from "../config";

// Paying by KHQR (roadmap step 5, docs/blueprint.md "Flow A: Bakong KHQR"),
// on the API's side: whether a shop page offers it, and the order's first
// payment attempt. Whether it was paid is only ever decided by the worker,
// asking the provider's own status API.

/** The KHQR provider the settings choose (KHQR_PROVIDER); null = KHQR is off. */
export const KHQR = Symbol("KHQR");
export const khqrProvider = {
  provide: KHQR,
  // The API only makes codes; asking the bank is the worker's job, so it needs no bank address.
  useFactory: (): PaymentProvider | null => khqrProviderFor({ KHQR_PROVIDER: getEnv().KHQR_PROVIDER, fakeBankUrl: "" }),
};

/** Inside withPublicStore: the shop's Bakong account when KHQR is on and the shop set one; null = no KHQR on this shop. */
export async function publicKhqrAccount(tx: Tx, provider: PaymentProvider | null): Promise<string | null> {
  if (!provider) return null;
  const [row] = await tx.$queryRaw<{ account: string | null }[]>`SELECT app_public_store_khqr_account() AS account`;
  return row?.account ?? null;
}

/** The order's first KHQR code: made by the provider, saved as a pending attempt that runs out after KHQR_CODE_MINUTES. */
export async function startKhqrPayment(
  tx: Tx,
  provider: PaymentProvider,
  order: { storeId: string; orderId: string; amountMinor: number; currency: Currency; bakongAccountId: string },
  now = new Date(),
): Promise<void> {
  const expiresAt = new Date(now.getTime() + KHQR_CODE_MINUTES * 60_000);
  const created = await provider.createPayment({
    orderId: order.orderId,
    amountMinor: order.amountMinor,
    currency: order.currency,
    expiresAt,
    store: { storeId: order.storeId, bakongAccountId: order.bakongAccountId },
  });
  await tx.paymentAttempt.create({
    data: {
      storeId: order.storeId,
      orderId: order.orderId,
      provider: provider.code,
      providerRef: created.providerRef,
      qrPayload: created.qrPayload ?? "",
      amountMinor: order.amountMinor,
      currency: order.currency,
      expiresAt,
    },
  });
}

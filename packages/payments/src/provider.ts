import type { Currency, PaymentAmount, PaymentProvider as ProviderCode } from "@khmio/shared";

// One interface for every way a buyer pays online (docs/blueprint.md
// "Payments"): the orders code and the worker only call this, never a bank
// directly, so adding a provider is one new file.

export interface StorePaymentConfig {
  storeId: string;
  bakongAccountId?: string;
  paywayMerchantId?: string;
  paywayApiKey?: string;
}

export interface CreatedPayment {
  /** KHQR: the code's MD5; PayWay: the tran_id. What the status check asks about. */
  providerRef: string;
  /** KHQR: what the buyer scans. */
  qrPayload?: string;
  redirectUrl?: string;
}

/**
 * What the provider's own status API says about one payment:
 * the amount and currency it saw paid, null = nothing paid yet,
 * "unreachable" = it didn't answer. `raw` is kept for an admin looking into
 * an issue; it never holds a secret.
 */
export interface PaymentStatusReport {
  reported: PaymentAmount | null | "unreachable";
  raw: Record<string, string | number | boolean | null>;
}

export interface PaymentProvider {
  code: ProviderCode;
  createPayment(input: { orderId: string; amountMinor: number; currency: Currency; expiresAt: Date; store: StorePaymentConfig }): Promise<CreatedPayment>;
  /** Asks the provider; never throws for a network problem (that is "unreachable"). */
  checkPayment(providerRef: string, store: StorePaymentConfig): Promise<PaymentStatusReport>;
  /** PayWay only: verify the callback signature before trusting it. */
  verifyCallback?(headers: Record<string, string>, body: unknown, store: StorePaymentConfig): boolean;
}

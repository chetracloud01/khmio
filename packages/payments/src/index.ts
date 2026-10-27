import { createFakeKhqrProvider } from "./fake-khqr";
import type { PaymentProvider } from "./provider";

export * from "./fake-khqr";
export * from "./provider";

/** The KHQR provider these settings choose (packages/shared env.ts KHQR_PROVIDER); null = KHQR is off. */
export function khqrProviderFor(settings: { KHQR_PROVIDER: "off" | "fake"; fakeBankUrl: string }): PaymentProvider | null {
  return settings.KHQR_PROVIDER === "fake" ? createFakeKhqrProvider(settings.fakeBankUrl) : null;
}

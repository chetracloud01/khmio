import { createHash, randomUUID } from "node:crypto";
import { currencySchema } from "@khmio/shared";
import { z } from "zod";
import type { PaymentProvider, PaymentStatusReport } from "./provider";

// A stand-in for Bakong KHQR (KHQR_PROVIDER=fake), for local work and the
// end-to-end checks until the Bakong token arrives. It behaves like the real
// one where it matters: the code is made here, its MD5 is the reference, and
// the payment is learnt only by asking a bank over HTTP — the API's
// /dev/fake-bank, which a "pay (test)" button fills. Production refuses it
// (packages/shared env.ts).

/** What the stand-in bank answers for one reference. */
export const fakeBankAnswerSchema = z.discriminatedUnion("paid", [
  z.object({ paid: z.literal(false) }),
  z.object({ paid: z.literal(true), currency: currencySchema, amountMinor: z.number().int() }),
]);
export type FakeBankAnswer = z.infer<typeof fakeBankAnswerSchema>;

/** A test payment into the stand-in bank: any amount, so a wrong one can be tried too. */
export const fakeBankPaymentSchema = z.object({ currency: currencySchema, amountMinor: z.number().int().positive() });

/** A KHQR reference: the code's MD5. */
export const KHQR_REF_PATTERN = /^[0-9a-f]{32}$/;

/** How long one status question may take before the bank counts as unreachable. */
const CHECK_TIMEOUT_MS = 5_000;

export function createFakeKhqrProvider(bankUrl: string, fetchImpl: typeof fetch = fetch): PaymentProvider {
  return {
    code: "bakong_khqr",
    async createPayment({ orderId, amountMinor, currency, store }) {
      // Clearly not a real KHQR: no bank app can pay it.
      const qrPayload = ["FAKE-KHQR", store.bakongAccountId ?? "", currency, String(amountMinor), orderId, randomUUID()].join("|");
      return { providerRef: createHash("md5").update(qrPayload).digest("hex"), qrPayload };
    },
    async checkPayment(providerRef): Promise<PaymentStatusReport> {
      try {
        const response = await fetchImpl(`${bankUrl}/${encodeURIComponent(providerRef)}`, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
        if (!response.ok) return { reported: "unreachable", raw: { status: response.status } };
        const answer = fakeBankAnswerSchema.parse(await response.json());
        return answer.paid
          ? { reported: { currency: answer.currency, amountMinor: answer.amountMinor }, raw: { ...answer } }
          : { reported: null, raw: { paid: false } };
      } catch (error) {
        return { reported: "unreachable", raw: { error: error instanceof Error ? error.name : "unknown" } };
      }
    },
  };
}

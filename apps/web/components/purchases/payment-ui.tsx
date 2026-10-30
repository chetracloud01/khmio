"use client";

import { PURCHASE_PAYMENT_METHODS, type PurchasePaymentState } from "@khmio/shared";
import { StatusPill, type Tone } from "@khmio/ui";
import { useTranslations } from "next-intl";

/** Each standing's tone: what needs paying stands out, overdue most. */
export const PAYMENT_STATE_TONES: Record<PurchasePaymentState, Tone> = { unpaid: "warning", part: "info", paid: "success", overdue: "danger" };

/** "Paid", "Part paid", "Unpaid", "Overdue" as a pill. */
export function PaymentStatePill({ state }: { state: PurchasePaymentState }) {
  const t = useTranslations("Purchases");
  return <StatusPill tone={PAYMENT_STATE_TONES[state]}>{t(`payment_${state}`)}</StatusPill>;
}

/** The ways a supplier is paid, as a picker's options. */
export function usePaymentMethodOptions() {
  const t = useTranslations("Purchases");
  return PURCHASE_PAYMENT_METHODS.map((method) => ({ value: method, label: t(`method_${method}`) }));
}

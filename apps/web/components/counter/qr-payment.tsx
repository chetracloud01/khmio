"use client";

import { Checkbox, Notice } from "@khmio/ui";
import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Paying by the shop's own QR at the counter (design/screens.md P2): the
 * picture the seller uploaded, the exact amount to pay, and a tick the seller
 * gives only after seeing the money arrive in their bank app — Khmio can't
 * check a payment it never sees. Without a QR yet: where to add one.
 */
export function QrPayment({
  qrUrl,
  amount,
  setupHref,
  confirmed,
  onConfirmed,
}: {
  qrUrl: string | null;
  /** As shown: "$12.50". */
  amount: string;
  /** Shop details › Getting paid, where the QR is uploaded. */
  setupHref: string;
  confirmed: boolean;
  onConfirmed: (confirmed: boolean) => void;
}) {
  const t = useTranslations("Counter");

  if (!qrUrl) {
    return (
      <Notice tone="info" icon={QrCode} action={<Link href={setupHref} className="font-semibold text-brand">{t("qrSetup")}</Link>}>
        {t("qrMissing")}
      </Notice>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted">{t("qrAsk")}</p>
      <p className="text-3xl font-bold tabular-nums">{amount}</p>
      <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-paper p-3 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own uploaded QR picture */}
        <img src={qrUrl} alt={t("qrAlt")} className="mx-auto h-auto w-full object-contain" />
      </div>
      <div className="w-full rounded-2xl border border-border p-3 text-left">
        <Checkbox checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} label={t("qrConfirm", { amount })} description={t("qrConfirmHint")} />
      </div>
    </div>
  );
}

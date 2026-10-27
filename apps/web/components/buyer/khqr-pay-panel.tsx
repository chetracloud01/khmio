"use client";

import { KHQR_CODE_MINUTES, type Currency } from "@khmio/shared";
import { Button, Mio } from "@khmio/ui";
import { Download, FlaskConical, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { KhqrCard } from "./khqr-card";

/** How long the "Paid!" moment shows before the order page. */
export const KHQR_PAID_PAUSE_MS = 1500;
const CODE_SECONDS = KHQR_CODE_MINUTES * 60;

export type KhqrPayStatus = "pending" | "paid" | "expired";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Paying one order by KHQR (design/screens.md B5): the official KHQR card,
 * the countdown and its time bar, save the QR, three "how to pay" steps; the
 * "Paid!" moment with Mio; and the expired state. The page around it decides
 * the status (the mockup by itself; the live page from the API, which only
 * the worker's bank check moves).
 */
export function KhqrPayPanel({
  storeName,
  amountMinor,
  currency,
  qrText,
  secondsLeft,
  status,
  saveName,
  expired,
  onOpenBankApp,
  testPay,
}: {
  storeName: string;
  amountMinor: number;
  currency: Currency;
  /** What the QR holds: the KHQR payload. */
  qrText: string;
  secondsLeft: number;
  status: KhqrPayStatus;
  /** The saved picture's file name. */
  saveName: string;
  /** What the buyer reads and can do once the code ran out. */
  expired: { body: string; actionLabel: string; onAction: () => void };
  /** Opens the buyer's bank app; left out until the provider gives a link for it. */
  onOpenBankApp?: () => void;
  /** Only without a real bank (mockup, KHQR_PROVIDER=fake): pays the code for testing. */
  testPay?: { label: string; note: string; onPay: () => void; busy: boolean };
}) {
  const t = useTranslations("Khqr");
  const tMascot = useTranslations("Mascot");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // High error correction: the currency mark in the middle covers part of the code.
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrText, { width: 480, margin: 0, errorCorrectionLevel: "H" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrText]);

  function saveQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = saveName;
    link.click();
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" role="status">
        {/* Small on purpose: on the buyer's side the seller's shop comes first. */}
        <Mio pose="coin" size={112} label={tMascot("label")} className="animate-hop motion-reduce:animate-none" />
        <p className="text-2xl font-bold text-success">{t("paidTitle")}</p>
        <p className="max-w-[300px] text-sm text-muted">{t("paidBody", { shop: storeName })}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-4 pb-8">
      <KhqrCard
        merchantName={storeName}
        amountMinor={amountMinor}
        currency={currency}
        qrDataUrl={qrDataUrl}
        qrAlt={t("qrAlt", { amount: formatMoney(amountMinor, currency), shop: storeName })}
        dimmed={status === "expired"}
      />

      {status === "expired" ? (
        <div className="flex w-full max-w-[300px] flex-col items-center gap-3 text-center" role="status">
          <p className="font-semibold text-danger">{t("expiredTitle")}</p>
          <p className="text-sm text-muted">{expired.body}</p>
          <Button variant="primary" onClick={expired.onAction} className="w-full">
            {expired.actionLabel}
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-[300px] flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" aria-hidden="true" />
                {t("waiting")}
              </span>
              <span className="font-semibold tabular-nums" role="timer" aria-label={t("expiresIn")}>
                {formatCountdown(secondsLeft)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{ width: `${(secondsLeft / CODE_SECONDS) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted">{t("payWithin", { minutes: KHQR_CODE_MINUTES })}</p>
          </div>

          {/* On the phone that shows the QR you can't scan it: save it, then upload it in the bank app. */}
          <div className="grid gap-3">
            {onOpenBankApp && (
              <Button variant="primary" className="w-full" onClick={onOpenBankApp}>
                <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("openBankApp")}
              </Button>
            )}
            <Button variant={onOpenBankApp ? "secondary" : "primary"} className="w-full" onClick={saveQr} disabled={!qrDataUrl}>
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("saveQr")}
            </Button>
          </div>

          <ol className="flex flex-col gap-2 rounded-2xl border border-border p-4 text-sm">
            <li className="font-semibold">{t("howTitle")}</li>
            {[t("how1"), t("how2"), t("how3")].map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-muted">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          {testPay && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs text-muted">{testPay.note}</p>
              <Button variant="secondary" className="w-full border-dashed text-xs text-muted" loading={testPay.busy} onClick={testPay.onPay}>
                <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
                {testPay.label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import type { Currency } from "@khmio/shared";
import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/components/order-ui";
import type { PayablesReport } from "@/lib/api";
import { ChartCard, KpiTile } from "./chart-parts";
import { PayablesRing } from "./payables-ring";

// The home's bills card (design/screens.md S3; plans with stock): what the
// shop owes its suppliers as of today, whatever period the page shows — a
// ring of paid · not due yet · overdue with what's owed in the middle, each
// part named with its amount beside it; then what falls due in 7 days and
// the bills whose goods haven't arrived. The main currency leads; the other
// is a line under it, never added in.

export function PayablesCard({ report, mainCurrency, href }: { report: PayablesReport; mainCurrency: Currency; href: string }) {
  const t = useTranslations("SellerApp");
  const tPayables = useTranslations("Payables");
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  // The shop's currency, unless all its bills are in the other one.
  const currency = report.currencies[mainCurrency].figures.billCount > 0 || report.currencies[other].figures.billCount === 0 ? mainCurrency : other;
  const otherCurrency: Currency = currency === "USD" ? "KHR" : "USD";
  const { figures } = report.currencies[currency];
  const otherOwed = report.currencies[otherCurrency].figures.owed;
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <ChartCard icon={ReceiptText} title={t("payablesTitle")} subtitle={t("asOfToday")} link={{ href, label: t("payablesReportLink") }}>
      {figures.billCount === 0 ? (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{tPayables("empty")}</p>
      ) : (
        <>
          <PayablesRing figures={figures} money={money} note={otherOwed > 0 ? t("plusOtherOwed", { amount: formatMoney(otherOwed, otherCurrency) }) : undefined} />
          <div className="grid grid-cols-2 gap-2">
            <KpiTile label={tPayables("dueSoonLabel")} value={money(figures.dueSoon)} />
            <KpiTile
              label={tPayables("notReceivedLabel")}
              value={tPayables("billCount", {
                count: figures.notReceived.count,
              })}
              sub={figures.notReceived.count > 0 ? money(figures.notReceived.bought) : undefined}
              tone={figures.notReceived.count > 0 ? "warning" : undefined}
            />
          </div>
        </>
      )}
    </ChartCard>
  );
}

"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CHART_COLOR } from "./chart-parts";
import { RingChart } from "./ring-chart";

/**
 * What a shop owes its suppliers as a ring (the home's bills card and the
 * Bills & payables report): paid · not due yet · overdue, with what's owed in
 * the middle.
 */
export function PayablesRing({ figures, money, note }: { figures: { paid: number; owed: number; overdue: number }; money: (amount: number) => string; /** A line under the parts (what's owed in the other currency). */ note?: ReactNode }) {
  const t = useTranslations("SellerApp");
  const tPayables = useTranslations("Payables");
  const notDue = figures.owed - figures.overdue;
  return (
    <RingChart
      label={t("payablesChartLabel", { owed: money(figures.owed), overdue: money(figures.overdue), paid: money(figures.paid) })}
      center={{ label: tPayables("owedLabel"), value: money(figures.owed) }}
      parts={[
        { key: "paid", label: tPayables("colPaid"), amount: figures.paid, color: CHART_COLOR.neutral, text: money(figures.paid) },
        { key: "not_due", label: tPayables("age_not_due"), amount: notDue, color: CHART_COLOR.main, text: money(notDue) },
        { key: "overdue", label: tPayables("overdueLabel"), amount: figures.overdue, color: CHART_COLOR.danger, text: money(figures.overdue), alert: true },
      ]}
      note={note}
    />
  );
}

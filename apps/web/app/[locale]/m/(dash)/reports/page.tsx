"use client";

import { useLocale, useTranslations } from "next-intl";
import { ReportLinks } from "@/components/reports/report-links";
import { SubPage } from "@/components/seller-frame/sub-page";
import { useMerchant } from "../merchant-context";

// The shop's reports (design/screens.md S17): a card for each — what it
// shows, and the plan it comes with when this shop's plan doesn't have it.
export default function ReportsPage() {
  const t = useTranslations("Reports");
  const locale = useLocale();
  const { store } = useMerchant();
  const base = `/${locale}/m`;

  return (
    <SubPage width="page" back={{ href: base, label: t("backToHome") }} title={t("title")} description={t("description")}>
      <ReportLinks base={base} plan={store.plan} />
    </SubPage>
  );
}

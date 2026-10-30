"use client";

import type { PlanFeature } from "@khmio/shared";
import { useTranslations } from "next-intl";

/** Each plan feature's name, for plan tables and lists (in packages/shared PLAN_FEATURES order). */
export function usePlanFeatureLabels(): Record<PlanFeature, string> {
  const t = useTranslations("Billing");
  return {
    counterSales: t("featureCounterSales"),
    stock: t("featureStock"),
    wholesalePrice: t("featureWholesale"),
    profitReport: t("featureProfitReport"),
    warehouses: t("featureWarehouses"),
  };
}

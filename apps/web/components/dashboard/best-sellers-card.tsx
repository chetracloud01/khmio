"use client";

import type { Currency } from "@khmio/shared";
import { ProgressBar } from "@khmio/ui";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChartCard } from "@/components/home/chart-parts";
import { chartAmount, moneyLines } from "@/components/reports/report-money";
import type { Dashboard } from "@/lib/api";
import { localName } from "@/lib/local-name";

/** The period's best sellers (design/screens.md S3): the top five by money, each opening the product. */
export function BestSellersCard({ products, mainCurrency, rate, href, productHref }: { products: Dashboard["sales"]["products"]; mainCurrency: Currency; rate: number; href: string; productHref: (productId: string) => string }) {
  const t = useTranslations("HomeDashboard");
  const locale = useLocale();
  const inMain = (money: Record<Currency, number>) => chartAmount(money, mainCurrency, mainCurrency, rate);
  const most = Math.max(1, ...products.map((product) => inMain(product.money)));

  return (
    <ChartCard icon={Trophy} title={t("bestTitle")} subtitle={t("bestHint")} link={{ href, label: t("viewReport") }}>
      {products.length === 0 ? (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
      ) : (
        <ol className="flex flex-col">
          {products.map((product, index) => (
            <li key={product.productId}>
              <Link href={productHref(product.productId)} className="flex min-h-touch flex-col justify-center gap-1 rounded-lg py-1.5 hover:bg-border/20">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-xs font-semibold text-muted tabular-nums">{index + 1}</span>
                    <span className="truncate font-medium">{localName(locale, product)}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="text-xs text-muted tabular-nums">{t("sold", { count: product.quantity })}</span>
                    <span className="font-semibold tabular-nums">{moneyLines(product.money, mainCurrency, null, rate).main}</span>
                  </span>
                </span>
                <ProgressBar value={inMain(product.money)} max={most} size="sm" label={localName(locale, product)} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}

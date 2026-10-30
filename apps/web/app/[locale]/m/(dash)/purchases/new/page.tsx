"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { SubPage } from "@/components/seller-frame/sub-page";
import { itemName } from "@/components/stock/item-name";
import { billLinesFromAddress, billSupplierFromAddress } from "@/components/stock/new-bill-link";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type StockPage, stockPageSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// A new supplier bill (design/screens.md S13 "New bill"): the items come from
// GET /stock, the suppliers from GET /suppliers; "Create bill" on the Stock
// list fills it from the address (?lines=…&supplier=…). Saved, it opens the bill.
export default function NewPurchasePage() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const router = useRouter();
  const { store } = useMerchant();
  const [data, setData] = useState<{ stock: StockPage; suppliers: Supplier[]; start: { lines: { variantId: string; quantity: number }[]; supplierId: string | null } } | null>(null);
  const [failed, setFailed] = useState(false);
  const list = `/${locale}/m/purchases`;

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api("/stock", stockPageSchema), api("/suppliers", suppliersSchema)]).then(
      ([stock, answer]) => {
        // Read once, in the browser: "Create bill" on the Stock list put what to order in the address.
        const address = new URLSearchParams(window.location.search);
        setData({
          stock,
          suppliers: answer.suppliers.filter((supplier) => !supplier.archived),
          start: { lines: billLinesFromAddress(address.get("lines")), supplierId: billSupplierFromAddress(address.get("supplier")) },
        });
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  if (!planHasFeature(store.plan, "stock")) return <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />;
  if (failed) return <PageOffline onRetry={load} />;
  if (!data) return <PageLoading />;
  return (
    <SubPage back={{ href: list, label: t("title") }} title={t("newBill")} description={t("newBillDescription")} width="page">
      <PurchaseForm
        items={data.stock.items}
        suppliers={data.suppliers}
        shopCurrency={store.defaultCurrency}
        shopRate={store.usdToKhrRate}
        rateBand={store.rateBand}
        nameOf={(item) => itemName(locale, item)}
        draftKey={`khmio:new-bill:${store.slug}`}
        start={data.start}
        onSaved={(purchase) => router.push(`${list}/${purchase.id}`)}
        onCancel={() => router.push(list)}
      />
    </SubPage>
  );
}

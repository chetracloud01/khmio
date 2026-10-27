"use client";

import { useLocale, useTranslations } from "next-intl";
import { BuyerShell } from "@/components/buyer-shell";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { useInvoiceData } from "@/components/invoice/use-invoice-data";
import type { OrderInvoice } from "@/lib/api";

export function BuyerInvoice({ invoice, token }: { invoice: OrderInvoice | null; token: string }) {
  const t = useTranslations("Orders");
  if (!invoice) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <p className="text-sm text-muted">{t("notFoundBody")}</p>
      </BuyerShell>
    );
  }
  return <Invoice invoice={invoice} token={token} />;
}

function Invoice({ invoice, token }: { invoice: OrderInvoice; token: string }) {
  const t = useTranslations("Invoice");
  const locale = useLocale();
  const data = useInvoiceData(invoice);
  return <InvoiceScreen data={data} backHref={`/${locale}/o/${encodeURIComponent(token)}`} backLabel={t("backToOrder")} />;
}

"use client";

import { Button } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { useInvoiceData } from "@/components/invoice/use-invoice-data";
import { api, ApiError, type OrderInvoice, orderInvoiceSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../../../page-states";

// The seller's copy of an order's invoice / receipt (design/screens.md B7):
// the same document the buyer sees, with the buyer's phone in full.
export default function SellerInvoicePage() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");

  const load = useCallback(() => {
    setState("loading");
    api(`/orders/${id}/invoice`, orderInvoiceSchema)
      .then((loaded) => {
        setInvoice(loaded);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  }, [id]);
  useEffect(load, [load]);

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found") {
    return (
      <div className="flex flex-col items-center gap-3 p-4 pt-16 text-center">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <Link href={`/${locale}/m/orders`} className="block">
          <Button variant="secondary">{t("backToOrders")}</Button>
        </Link>
      </div>
    );
  }
  if (!invoice) return <PageLoading />;
  return <SellerInvoice invoice={invoice} id={id} />;
}

function SellerInvoice({ invoice, id }: { invoice: OrderInvoice; id: string }) {
  const t = useTranslations("Invoice");
  const tCounter = useTranslations("Counter");
  const locale = useLocale();
  const data = useInvoiceData(invoice);
  // A sale at the counter prints on the 80 mm roll, and goes back to today's sales.
  if (invoice.order.channel === "in_store") {
    return <InvoiceScreen data={data} initialSize="receipt" backHref={`/${locale}/m/sell/today`} backLabel={tCounter("todayTitle")} />;
  }
  return <InvoiceScreen data={data} backHref={`/${locale}/m/orders/${id}`} backLabel={t("backToOrder")} />;
}

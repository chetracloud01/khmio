"use client";

import { EmptyState } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerScreen } from "@/components/customers/customer-screen";
import { CustomersLink } from "@/components/customers/customers-link";
import { api, ApiError, type CustomerDetail, customerDetailSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// One customer (design/screens.md S14): the same screen as the mockup, from
// GET /customers/:id. Another shop's customer, or a mistyped address, is
// "not found".
export default function CustomerPage() {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { store } = useMerchant();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");

  const load = useCallback(() => {
    setState("loading");
    api(`/customers/${id}`, customerDetailSchema)
      .then((answer) => {
        setCustomer(answer);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  }, [id]);
  useEffect(load, [load]);

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found") return <EmptyState title={t("notFound")} action={<CustomersLink href={`/${locale}/m/customers`} />} />;
  if (!customer) return <PageLoading />;
  return (
    <CustomerScreen
      customer={customer}
      mainCurrency={store.defaultCurrency}
      orderHref={(order) => `/${locale}/m/orders/${order.id}`}
      back={{ href: `/${locale}/m/customers`, label: t("title") }}
    />
  );
}

"use client";

import { listQueryToSearchParams, type ListQuery } from "@khmio/shared";
import { useLocale } from "next-intl";
import { useCallback } from "react";
import { CustomersScreen } from "@/components/customers/customers-screen";
import { api, customerRowSchema, listPageSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";

// The shop's customers (design/screens.md S14; every plan), read page by page
// from GET /customers/page.
export default function CustomersPage() {
  const locale = useLocale();
  const { store } = useMerchant();
  const load = useCallback((query: ListQuery) => api(`/customers/page?${listQueryToSearchParams(query)}`, listPageSchema(customerRowSchema)), []);
  return <CustomersScreen server={{ load }} hrefFor={(customer) => `/${locale}/m/customers/${customer.id}`} mainCurrency={store.defaultCurrency} />;
}

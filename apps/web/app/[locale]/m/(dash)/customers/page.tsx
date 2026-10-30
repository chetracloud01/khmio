"use client";

import { listQueryToSearchParams, type ListQuery } from "@khmio/shared";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { CustomersScreen } from "@/components/customers/customers-screen";
import { api, customerRowSchema, type CustomerTiles, customerTilesSchema, listPageSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";

// The shop's customers (design/screens.md S14; every plan), read page by page
// from GET /customers/page, with the status tiles from GET /customers/status.
export default function CustomersPage() {
  const locale = useLocale();
  const { store } = useMerchant();
  const [tiles, setTiles] = useState<CustomerTiles | null>(null);
  // The tiles only: without them the list still works.
  useEffect(() => {
    api("/customers/status", customerTilesSchema).then(setTiles, () => setTiles(null));
  }, []);
  const load = useCallback((query: ListQuery) => api(`/customers/page?${listQueryToSearchParams(query)}`, listPageSchema(customerRowSchema)), []);
  return (
    <CustomersScreen
      server={{ load }}
      hrefFor={(customer) => `/${locale}/m/customers/${customer.id}`}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      tiles={tiles}
      reportHref={`/${locale}/m/reports/sales`}
    />
  );
}

"use client";

import { useLocale } from "next-intl";
import { CustomersScreen } from "@/components/customers/customers-screen";
import { mockCustomerRows } from "@/mock/mock-customers";
import { useStoreSettings } from "../../store-settings-context";

// Customers (design/screens.md S14) with sample rows: the same screen the
// live page shows (docs/engineering-standard.md "One screen, two data sources").
export default function MockCustomersPage() {
  const locale = useLocale();
  const { settings } = useStoreSettings();
  return (
    <CustomersScreen
      source={{ rows: mockCustomerRows }}
      hrefFor={(customer) => `/${locale}/mockup/dashboard/customers/${customer.id}`}
      mainCurrency={settings.defaultCurrency}
    />
  );
}

"use client";

import { EmptyState } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { CustomerScreen } from "@/components/customers/customer-screen";
import { CustomersLink } from "@/components/customers/customers-link";
import { mockCustomerDetails } from "@/mock/mock-customers";
import { useStoreSettings } from "../../../store-settings-context";

// One customer (design/screens.md S14) with sample data: the same screen the
// live page shows. Sample orders open the mockup's order list (their numbers
// aren't among its sample orders).
export default function MockCustomerPage() {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { settings } = useStoreSettings();
  const listHref = `/${locale}/mockup/dashboard/customers`;
  const customer = mockCustomerDetails.find((entry) => entry.id === params.id);
  if (!customer) return <EmptyState title={t("notFound")} action={<CustomersLink href={listHref} />} />;
  return (
    <CustomerScreen
      customer={customer}
      mainCurrency={settings.defaultCurrency}
      orderHref={() => `/${locale}/mockup/dashboard/orders`}
      back={{ href: listHref, label: t("title") }}
    />
  );
}

"use client";

import { SubPage } from "@/components/seller-frame/sub-page";
import { useMerchant } from "../merchant-context";
import { InvoiceDetailsCard } from "../settings/invoice-details";

// "On your invoices" (design/screens.md S10), reached from the My shop menu.
export default function InvoiceSettingsPage() {
  const { store, refreshStore } = useMerchant();
  return (
    <SubPage>
      <InvoiceDetailsCard store={store} onSaved={refreshStore} />
    </SubPage>
  );
}

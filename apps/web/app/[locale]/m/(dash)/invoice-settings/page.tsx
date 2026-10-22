"use client";

import { SELLER_FORM } from "@/components/seller-frame/seller-frame";
import { BackToMyShop } from "@/components/seller-frame/back-to-my-shop";
import { useMerchant } from "../merchant-context";
import { InvoiceDetailsCard } from "../settings/invoice-details";

// "On your invoices" (design/screens.md S10), reached from the My shop menu.
export default function InvoiceSettingsPage() {
  const { store, refreshStore } = useMerchant();
  return (
    <div className={`${SELLER_FORM} gap-4`}>
      <BackToMyShop />
      <InvoiceDetailsCard store={store} onSaved={refreshStore} />
    </div>
  );
}

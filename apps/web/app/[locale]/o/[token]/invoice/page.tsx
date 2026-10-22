import type { Metadata } from "next";
import { apiBaseUrl, type OrderInvoice } from "@/lib/api";
import { BuyerInvoice } from "./buyer-invoice";

// The buyer's invoice / receipt (design/screens.md B7), from their order link.
// Never cached: it turns into a receipt once the order is paid.
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function loadInvoice(token: string): Promise<OrderInvoice | null> {
  const response = await fetch(`${apiBaseUrl()}/public/orders/${encodeURIComponent(token)}/invoice`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`invoice: API answered ${response.status}`);
  return (await response.json()) as OrderInvoice;
}

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BuyerInvoice invoice={await loadInvoice(token)} token={token} />;
}

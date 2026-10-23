import { redirect } from "next/navigation";

// "On your invoices" is now a group on Shop details (design/screens.md S10).
// This address stays for one release so links sellers saved still land there.
export default function InvoiceSettingsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/m/shop-details#invoices`);
}

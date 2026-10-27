import { redirect } from "next/navigation";

// Store settings are now the "Getting paid" and "Prices & tax" groups of Shop
// details (design/screens.md S10). This address stays for one release so
// links sellers saved still land there.
export default function StoreSettingsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/m/shop-details#prices`);
}

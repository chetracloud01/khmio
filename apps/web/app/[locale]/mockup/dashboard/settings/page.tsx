import { redirect } from "next/navigation";

// Store settings are now the "Prices & tax" and "Getting paid" groups of Shop
// details (design/screens.md S10); old links land there.
export default function DashboardSettingsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/mockup/dashboard/profile#prices`);
}

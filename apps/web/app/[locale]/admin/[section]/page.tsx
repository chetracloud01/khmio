"use client";

import { AdminSectionPage } from "@/components/admin-frame/admin-section-page";

// Menu entries not built in the live admin yet land here, with a link to
// their design in the mockup (components/admin-frame/admin-nav.ts).
export default function LiveAdminSectionPage() {
  return <AdminSectionPage area="live" />;
}

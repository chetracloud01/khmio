// The admin menu now lives in components/admin-frame/admin-nav.ts, shared by
// the live admin and this mockup. Mockup pages keep their old helpers here.
import { adminBase, adminPath } from "@/components/admin-frame/admin-nav";

export { ADMIN_NAV, ADMIN_NAV_ITEMS, type AdminBadge, type AdminNavGroup, type AdminNavItem } from "@/components/admin-frame/admin-nav";

export function adminHref(locale: string, segment: string): string {
  return adminPath(adminBase(locale, "mockup"), segment);
}

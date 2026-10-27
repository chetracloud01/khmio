import {
  AlertTriangle,
  CreditCard,
  DatabaseBackup,
  Globe,
  Images,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  Megaphone,
  ReceiptText,
  Repeat,
  ScrollText,
  Settings,
  Store,
  UserCog,
  type LucideIcon,
} from "lucide-react";

// The one place the admin menu is defined, for the live admin (/admin) and
// its mockup (/mockup/admin) alike. Adding an admin page = one entry here
// (plus the page itself, and its "AdminNav" label and description in
// messages/*.json). An entry not built yet in one of the two shows the
// standard "coming soon" page there.

export type AdminBadge = "kycPending" | "invoicesOverdue" | "failedChecks" | "trialsEnding" | "backupsStale";

export interface AdminNavItem {
  /** Also the message key under "AdminNav" for its label and description. */
  key: string;
  /** URL segment under the admin's base — "" is the overview. */
  segment: string;
  icon: LucideIcon;
  badge?: AdminBadge;
  /** Built in the live admin; otherwise it shows "Soon" there. */
  live: boolean;
  /** Built in the mockup (default true). */
  mockup?: boolean;
}

export interface AdminNavGroup {
  /** Message key under "AdminNav" for the group heading. */
  key: string;
  items: AdminNavItem[];
}

export type AdminArea = "live" | "mockup";

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: "groupMain", items: [{ key: "overview", segment: "", icon: LayoutDashboard, live: true }] },
  {
    key: "groupMerchants",
    items: [
      { key: "merchants", segment: "merchants", icon: Store, badge: "trialsEnding", live: true },
      { key: "kyc", segment: "kyc", icon: KeyRound, badge: "kycPending", live: false },
    ],
  },
  {
    key: "groupRevenue",
    items: [
      { key: "subscriptions", segment: "subscriptions", icon: Repeat, live: false },
      { key: "invoices", segment: "invoices", icon: ReceiptText, badge: "invoicesOverdue", live: false },
      { key: "plans", segment: "plans", icon: Layers, live: true },
    ],
  },
  {
    key: "groupPayments",
    items: [
      { key: "payments", segment: "payments", icon: CreditCard, live: false },
      { key: "failedChecks", segment: "failed-checks", icon: AlertTriangle, badge: "failedChecks", live: false },
    ],
  },
  {
    key: "groupWebsite",
    items: [
      { key: "website", segment: "website", icon: Globe, live: false },
      { key: "promotions", segment: "promotions", icon: Megaphone, live: false },
      { key: "pictures", segment: "pictures", icon: Images, live: false },
      { key: "waitlist", segment: "waitlist", icon: ListChecks, live: true, mockup: false },
    ],
  },
  {
    key: "groupSystem",
    items: [
      { key: "auditLog", segment: "audit-log", icon: ScrollText, live: true },
      { key: "backups", segment: "backups", icon: DatabaseBackup, badge: "backupsStale", live: true },
      { key: "admins", segment: "admins", icon: UserCog, live: false },
      { key: "settings", segment: "settings", icon: Settings, live: true },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

/** Not built yet in this admin: the menu marks it "Soon" and its page says so. */
export function isComingSoon(item: AdminNavItem, area: AdminArea): boolean {
  return area === "live" ? !item.live : item.mockup === false;
}

/** "/km/admin" or "/km/mockup/admin". */
export function adminBase(locale: string, area: AdminArea): string {
  return area === "live" ? `/${locale}/admin` : `/${locale}/mockup/admin`;
}

export function adminPath(base: string, segment: string): string {
  return segment ? `${base}/${segment}` : base;
}

/** The menu item (and its group) for the current URL, matched on the first segment after the base. */
export function findActiveNav(pathname: string, base: string): { group: AdminNavGroup; item: AdminNavItem } | null {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : "";
  const segment = rest.split("/")[0] ?? "";
  for (const group of ADMIN_NAV) {
    const item = group.items.find((candidate) => candidate.segment === segment);
    if (item) return { group, item };
  }
  return null;
}

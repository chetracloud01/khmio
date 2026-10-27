import { z } from "zod";

// Who may do what in the admin area. The single source of truth: the admin
// screens read it to explain the roles, and the API enforces it on every
// admin request (the UI alone is never the guard).

export const adminRoleSchema = z.enum(["owner", "support", "finance"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const ADMIN_PERMISSIONS = [
  "merchants_manage",
  "kyc_review",
  "billing_view",
  "billing_manage",
  "payments_view",
  "payments_manage",
  "audit_view",
  "settings_manage",
  "admins_manage",
  "backups_view",
  "backups_run",
  "shop_restore",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/**
 * - owner: everything, including who else is an admin.
 * - support: helps merchants (plans, periods, KYC); sees money, can't change it; can start a backup.
 * - finance: invoices and payment checks; sees merchants, can't change them or review KYC; sees backups.
 * Restoring a shop's catalog from a backup (shop_restore) is the owner's alone.
 */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  support: ["merchants_manage", "kyc_review", "billing_view", "payments_view", "audit_view", "backups_view", "backups_run"],
  finance: ["billing_view", "billing_manage", "payments_view", "payments_manage", "audit_view", "backups_view"],
};

export function adminCan(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

/** Telegram usernames: 5–32 letters, digits or underscores. A leading @ is dropped. */
export const telegramUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/, "telegram_invalid"));

export const adminInviteSchema = z.object({
  name: z.string().trim().min(2, "too_short").max(60, "too_long"),
  telegramUsername: telegramUsernameSchema,
  role: adminRoleSchema,
});
export type AdminInvite = z.infer<typeof adminInviteSchema>;

export interface AdminAccount {
  id: string;
  role: AdminRole;
  /** A disabled admin can't log in; their past actions stay in the audit log. */
  disabled: boolean;
}

/**
 * The admin area must never be left with nobody who can manage admins:
 * the last active owner can't be disabled or given another role.
 */
export function canChangeAdmin(admins: AdminAccount[], targetId: string, change: { role?: AdminRole; disabled?: boolean }): boolean {
  const target = admins.find((admin) => admin.id === targetId);
  if (!target) return false;
  const next = { ...target, ...change };
  const wasActiveOwner = target.role === "owner" && !target.disabled;
  const staysActiveOwner = next.role === "owner" && !next.disabled;
  if (!wasActiveOwner || staysActiveOwner) return true;
  return admins.some((admin) => admin.id !== targetId && admin.role === "owner" && !admin.disabled);
}

import type { OrderAction } from "./orders";

// The audit log (admin "Activity", design/screens.md A8): every change a
// person or the system makes, as one of these names. The API and the worker
// write only these (packages/db writeAudit), and the admin screen has a
// sentence for each (messages AdminApp.audit_*), so the two can't drift apart.

export const AUDIT_ACTIONS = [
  "merchant.signed_up",
  "store.created",
  "store.details_saved",
  "store.settings_saved",
  "store.invoice_details_saved",
  "store.delivery_saved",
  "store.telegram_group_linked",
  "store.telegram_group_unlinked",
  "subscription.extended",
  "subscription.plan_changed",
  "platform.settings_saved",
  "backup.started",
  "backup.restore_test_passed",
  "admin.login",
  "admin.login_backup_code",
  "admin.two_step_set_up",
  "admin.code_wrong",
  "admin.login_locked",
  "admin.owner_added",
  "admin.owner_reset",
] as const;

/** A step on an order is logged as "order.<step>" (order.confirm, order.dispatch…). */
export type AuditAction = (typeof AUDIT_ACTIONS)[number] | `order.${OrderAction}`;

const namedActions: readonly string[] = AUDIT_ACTIONS;
export const isNamedAuditAction = (action: string): action is (typeof AUDIT_ACTIONS)[number] => namedActions.includes(action);

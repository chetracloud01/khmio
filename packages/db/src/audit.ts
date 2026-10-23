import type { AuditAction } from "@khmio/shared";
import type { Prisma } from "@prisma/client";

// One way to write the audit log (admin "Activity"), for the API, the worker
// and the command-line tools alike. Write it with the same client as the
// change itself (inside the transaction), so a change is never kept without
// its record.

/** Who made the change. A merchant acting in a shop names it; an admin or the system may act on one. */
export type AuditActor = { actorType: "merchant"; actorId: string; storeId?: string } | { actorType: "admin"; actorId: string; storeId?: string } | { actorType: "system"; storeId?: string };

export interface AuditChange {
  /** One of packages/shared AUDIT_ACTIONS, or "order.<step>". */
  action: AuditAction;
  entity: "merchant" | "store" | "order" | "subscription" | "platform_settings" | "backup_run" | "admin_user";
  entityId: string;
  /** What the record was and became, when that's worth showing (a plan change, a status). */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/** A merchant acting in their own shop (a dashboard request, a Telegram button). */
export const merchantActor = (context: { merchantId: string; storeId: string }): AuditActor => ({ actorType: "merchant", actorId: context.merchantId, storeId: context.storeId });

export function writeAudit(db: Pick<Prisma.TransactionClient, "auditLog">, actor: AuditActor, change: AuditChange) {
  return db.auditLog.create({ data: { ...actor, ...change } });
}

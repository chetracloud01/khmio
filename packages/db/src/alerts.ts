import type { AdminAlert } from "@khmio/shared";
import type { Prisma } from "@prisma/client";

/**
 * Something only a person can fix, for the platform's alert chat: queued in
 * the outbox, sent by the worker (apps/worker outbox.ts reads it back with
 * adminAlertSchema). Typed here, so the two always agree on its shape.
 */
export function queueAdminAlert(db: Pick<Prisma.TransactionClient, "outboxEvent">, alert: AdminAlert) {
  return db.outboxEvent.create({ data: { kind: "admin_alert", payload: alert } });
}

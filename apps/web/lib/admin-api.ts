import {
  adminRoleSchema,
  backupRunViewSchema,
  businessTypeSchema,
  deliveryAreaSchema,
  planIdSchema,
  platformHealthSchema,
  platformProductIdSchema,
  subscriptionStatusSchema,
  WAITLIST_BUSINESS_TYPES,
} from "@khmio/shared";
import { z } from "zod";

// What the admin API (apps/api admin/*) answers, read by lib/api.ts api()
// with these schemas (shape only, like lib/api-answers.ts). The admin cookie
// is set by the API for its /admin routes only.

/** GET /admin/auth/me. */
export const adminMeSchema = z.discriminatedUnion("stage", [
  z.object({ stage: z.literal("active"), name: z.string(), role: adminRoleSchema }),
  z.object({ stage: z.literal("pending_2fa"), name: z.string(), enrolled: z.boolean() }),
]);
export type AdminMe = z.infer<typeof adminMeSchema>;

/** POST /admin/auth/start and /admin/auth/telegram: what the login asks for next. */
export const adminLoginNextSchema = z.object({ next: z.enum(["enrol", "code"]) });

/** POST /admin/auth/enrol: the authenticator app's QR link and its typed-in secret. */
export const adminEnrolSchema = z.object({ otpauthUri: z.string(), secret: z.string() });

/** POST /admin/auth/verify: signed in; the one-time backup codes come once, on enrolment. */
export const adminVerifiedSchema = z.object({ ok: z.literal(true), backupCodes: z.array(z.string()).optional() });

export const adminOverviewSchema = z.object({
  shops: z.number(),
  newThisWeek: z.number(),
  paused: z.number(),
  trialsEndingSoon: z.number(),
  ordersToday: z.number(),
  waitingOrders: z.number(),
  messagesGaveUp: z.number(),
  health: platformHealthSchema,
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminMerchantRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  businessType: businessTypeSchema,
  createdAt: z.string(),
  owner: z.object({ name: z.string(), telegramUsername: z.string().nullable() }).nullable(),
  plan: planIdSchema.nullable(),
  status: subscriptionStatusSchema.nullable(),
  endsAt: z.string().nullable(),
  products: z.number(),
  orders: z.number(),
});
export type AdminMerchantRow = z.infer<typeof adminMerchantRowSchema>;

const auditChangeSchema = z.record(z.unknown()).nullable();

export const adminAuditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actorType: z.enum(["admin", "merchant", "system"]),
  actorName: z.string().nullable(),
  storeId: z.string().nullable(),
  storeName: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  before: auditChangeSchema,
  after: auditChangeSchema,
});
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

/** GET /admin/audit-log: one page, newest first. */
export const adminAuditPageSchema = z.object({ entries: z.array(adminAuditEntrySchema), more: z.boolean() });

export const adminMerchantDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  businessType: businessTypeSchema,
  phone: z.string(),
  area: deliveryAreaSchema,
  createdAt: z.string(),
  deliveryConfiguredAt: z.string().nullable(),
  subscription: z
    .object({
      plan: planIdSchema,
      status: subscriptionStatusSchema,
      trialEndsAt: z.string().nullable(),
      currentPeriodStart: z.string(),
      currentPeriodEnd: z.string().nullable(),
      endsAt: z.string().nullable(),
    })
    .nullable(),
  members: z.array(z.object({ role: z.enum(["owner", "staff"]), name: z.string(), telegramUsername: z.string().nullable() })),
  products: z.number(),
  orders: z.number(),
  lastOrderAt: z.string().nullable(),
  audit: z.array(adminAuditEntrySchema.pick({ id: true, at: true, actorType: true, action: true, after: true })),
});
export type AdminMerchantDetail = z.infer<typeof adminMerchantDetailSchema>;

/** GET/PUT /admin/settings (the save is checked with platformSettingsSaveSchema). */
export const adminSettingsSchema = z.object({
  platformName: z.string(),
  supportTelegram: z.string(),
  usdToKhrMin: z.number(),
  usdToKhrMax: z.number(),
  alertChatId: z.string(),
  betaAllBasic: z.boolean(),
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;

/** GET /admin/badges: the menu's red counts. */
export const adminBadgesSchema = z.object({ trialsEnding: z.number(), backupsStale: z.number() });
export type AdminBadges = z.infer<typeof adminBadgesSchema>;

/** GET /admin/backups (A13): one page of runs, newest first, the newest good one, and the last restore test. */
export const adminBackupsSchema = z.object({
  runs: z.array(backupRunViewSchema),
  latestDone: backupRunViewSchema.nullable(),
  restoreTestPassedAt: z.string().nullable(),
  more: z.boolean(),
});
export type AdminBackups = z.infer<typeof adminBackupsSchema>;

/** POST /admin/backups/restore-test. */
export const restoreTestSchema = z.object({ restoreTestPassedAt: z.string() });

/** GET /admin/waitlist: sign-ups per product, and one page of sign-ups, newest first. */
export const adminWaitlistSchema = z.object({
  counts: z.record(platformProductIdSchema, z.number()),
  signups: z.array(
    z.object({
      id: z.string(),
      product: platformProductIdSchema,
      name: z.string(),
      phone: z.string(),
      businessType: z.enum(WAITLIST_BUSINESS_TYPES),
      createdAt: z.string(),
    }),
  ),
  more: z.boolean(),
});
export type AdminWaitlist = z.infer<typeof adminWaitlistSchema>;

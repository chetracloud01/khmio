import type { SystemDb } from "@khmio/db";
import { adminExtendSchema, adminPlanChangeSchema, platformProductIdSchema, platformSettingsSaveSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { getEnv } from "../config";
import { SYSTEM_DB } from "../db";
import { AppException } from "../errors";
import { readActivity, readWaitlist } from "./activity";
import type { AdminIdentity } from "./admin-auth";
import { AdminGuard, AdminPermissionNeeded, CurrentAdmin } from "./admin.guard";
import { readBackups, recordRestoreTest, startBackup } from "./backups";
import { readMerchantDetail, readMerchants } from "./merchants";
import { readBadges, readOverview } from "./overview";
import { readPlatformSettings, savePlatformSettings } from "./platform-settings";
import { changeSubscription, type SubscriptionChange } from "./subscriptions";

/** How many rows a list page asks for: PAGE by default, at most 500 (the admin tables load a big page and filter it in the browser). */
const PAGE = 100;
const limitSchema = z.coerce.number().int().min(1).max(500).default(PAGE);
const auditQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  action: z.string().max(60).optional(),
  before: z.string().datetime().optional(),
  limit: limitSchema,
});
const waitlistQuerySchema = z.object({ product: platformProductIdSchema.optional(), before: z.string().datetime().optional(), limit: limitSchema });
const merchantsQuerySchema = z.object({ q: z.string().trim().max(60).optional() });
const backupsQuerySchema = z.object({ before: z.string().datetime().optional(), limit: limitSchema });

/** The answer to a subscription change: the plan now, or why it didn't happen. */
function changed(result: SubscriptionChange) {
  if (result.done) return { plan: result.plan, status: result.status, endsAt: result.endsAt };
  if (result.reason === "missing") throw new NotFoundException();
  throw new AppException(409, "action_not_allowed");
}

/**
 * The admin area's data (roadmap step 7). The admin sees every shop, so these
 * read and write as the owner database user (CLAUDE.md: SystemDb for admin);
 * AdminGuard checks the admin's role on every request instead, and every
 * change goes to the audit log with what it was before and after.
 */
@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(SYSTEM_DB) private readonly db: SystemDb) {}

  @Get("overview")
  @AdminPermissionNeeded("audit_view")
  async overview() {
    return readOverview(this.db, Boolean(getEnv().TELEGRAM_BOT_TOKEN));
  }

  /** The menu's red counts (admin frame): what needs a look, cheap enough to ask on every page change. */
  @Get("badges")
  @AdminPermissionNeeded("audit_view")
  async badges() {
    return readBadges(this.db);
  }

  @Get("merchants")
  @AdminPermissionNeeded("audit_view")
  async merchants(@Query() query: unknown) {
    const { q } = merchantsQuerySchema.parse(query);
    return readMerchants(this.db, q);
  }

  @Get("merchants/:storeId")
  @AdminPermissionNeeded("audit_view")
  async merchant(@Param("storeId", ParseUUIDPipe) storeId: string) {
    const found = await readMerchantDetail(this.db, storeId);
    if (!found) throw new NotFoundException();
    return found;
  }

  /** "Unblock": adds days to the trial or period; a paused or overdue shop reopens for exactly those days. */
  @Post("merchants/:storeId/extend")
  @HttpCode(200)
  @AdminPermissionNeeded("merchants_manage")
  async extend(@CurrentAdmin() admin: AdminIdentity, @Param("storeId", ParseUUIDPipe) storeId: string, @Body() body: unknown) {
    const { days, note } = adminExtendSchema.parse(body);
    return changed(await changeSubscription(this.db, { adminId: admin.adminId, storeId, override: { kind: "extend", days }, action: "subscription.extended", note }));
  }

  @Post("merchants/:storeId/plan")
  @HttpCode(200)
  @AdminPermissionNeeded("merchants_manage")
  async plan(@CurrentAdmin() admin: AdminIdentity, @Param("storeId", ParseUUIDPipe) storeId: string, @Body() body: unknown) {
    const { plan, note } = adminPlanChangeSchema.parse(body);
    return changed(await changeSubscription(this.db, { adminId: admin.adminId, storeId, override: { kind: "setPlan", plan }, action: "subscription.plan_changed", note }));
  }

  @Get("audit-log")
  @AdminPermissionNeeded("audit_view")
  async auditLog(@Query() query: unknown) {
    return readActivity(this.db, auditQuerySchema.parse(query));
  }

  /** The website waitlist (docs/platform-launch-plan.md Stage 3): how many per product, and the sign-ups, newest first. */
  @Get("waitlist")
  @AdminPermissionNeeded("merchants_manage")
  async waitlist(@Query() query: unknown) {
    return readWaitlist(this.db, waitlistQuerySchema.parse(query));
  }

  /** Admin A13: the backup runs, newest first, the newest good one, and when the full-restore test last passed. */
  @Get("backups")
  @AdminPermissionNeeded("backups_view")
  async backups(@Query() query: unknown) {
    return readBackups(this.db, backupsQuerySchema.parse(query));
  }

  /** "Backup now": the worker picks it up within seconds. One at a time — the database refuses a second. */
  @Post("backups")
  @HttpCode(200)
  @AdminPermissionNeeded("backups_run")
  async backupNow(@CurrentAdmin() admin: AdminIdentity) {
    const run = await startBackup(this.db, admin.adminId);
    if (!run) throw new AppException(409, "backup_running");
    return run;
  }

  /** The monthly full-restore test passed (blueprint "The routine"): the owner records it here. */
  @Post("backups/restore-test")
  @HttpCode(200)
  @AdminPermissionNeeded("settings_manage")
  async restoreTestPassed(@CurrentAdmin() admin: AdminIdentity) {
    const at = await recordRestoreTest(this.db, admin.adminId);
    return { restoreTestPassedAt: at.toISOString() };
  }

  @Get("settings")
  @AdminPermissionNeeded("audit_view")
  async settings() {
    return readPlatformSettings(this.db);
  }

  @Put("settings")
  @AdminPermissionNeeded("settings_manage")
  async saveSettings(@CurrentAdmin() admin: AdminIdentity, @Body() body: unknown) {
    return savePlatformSettings(this.db, admin.adminId, platformSettingsSaveSchema.parse(body));
  }
}

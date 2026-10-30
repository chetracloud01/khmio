import { withContext, type AppDb } from "@khmio/db";
import { dashboardQuerySchema } from "@khmio/shared";
import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { storePlan } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readDashboard } from "./dashboard";

/** The seller's dashboard (design/screens.md S3): a summary of the business for today, 7 or 30 days, beside the period before. What a plan doesn't have is left out. */
@Controller("dashboard")
@UseGuards(MerchantStoreGuard)
export class DashboardController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async dashboard(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const { period } = dashboardQuerySchema.parse(params);
    return withContext(this.app, context, async (tx) => readDashboard(tx, context.storeId, (await storePlan(tx, context.storeId)).plan, period));
  }
}

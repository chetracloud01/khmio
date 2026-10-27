import { withContext, type AppDb } from "@khmio/db";
import { stockChangeInputSchema, stockTrackInputSchema } from "@khmio/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertPlanFeature, assertStoreWritable, storePlan } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readStockPage, recordStockChange, trackVariant, untrackVariant } from "./stock";

/** The Stock page (design/screens.md S13): counts at the main branch, track or stop tracking an option, stock in and corrections. Pro and Advance write; lower plans see their counts, locked. */
@Controller("stock")
@UseGuards(MerchantStoreGuard)
export class StockController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async page(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => readStockPage(tx, context.storeId, (await storePlan(tx, context.storeId)).plan));
  }

  @Post("track")
  @HttpCode(200)
  async track(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = stockTrackInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      assertPlanFeature(plan, "stock");
      await trackVariant(tx, context, input);
      return readStockPage(tx, context.storeId, plan);
    });
  }

  @Delete("track/:variantId")
  @HttpCode(200)
  async untrack(@CurrentStore() context: MerchantStore, @Param("variantId", ParseUUIDPipe) variantId: string) {
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      assertPlanFeature(plan, "stock");
      await untrackVariant(tx, context.storeId, variantId);
      return readStockPage(tx, context.storeId, plan);
    });
  }

  @Post("changes")
  @HttpCode(200)
  async change(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = stockChangeInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      assertPlanFeature(plan, "stock");
      await recordStockChange(tx, context, input);
      return readStockPage(tx, context.storeId, plan);
    });
  }
}

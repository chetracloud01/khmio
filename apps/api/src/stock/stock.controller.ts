import { withContext, type AppDb } from "@khmio/db";
import { reorderLevelsInputSchema, reportQuerySchema, stockChangeInputSchema, stockCountLinesInputSchema, stockCountStartInputSchema, stockTrackInputSchema, stockTrackManyInputSchema } from "@khmio/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertPlanFeature, assertStoreWritable, storePlan } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readStockItem } from "./stock-item";
import { readCountReport } from "./count-report";
import { readStockReport } from "./stock-report";
import { readStockSummary } from "./stock-summary";
import { applyStockCount, cancelStockCount, readStockCount, readStockCounts, saveStockCountLines, startStockCount } from "./counts";
import { readStockPage, recordStockChange, setReorderLevels, trackVariant, trackVariants, untrackVariant } from "./stock";

/** The Stock page (design/screens.md S13): counts at the main branch, track or stop tracking an option, stock in and corrections. Pro and Advance write; lower plans see their counts, locked. */
@Controller("stock")
@UseGuards(MerchantStoreGuard)
export class StockController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async page(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => readStockPage(tx, context.storeId, (await storePlan(tx, context.storeId)).plan));
  }

  /** The stock report (design/screens.md S17 "Stock"): each item's opening, in, out and closing for a period, and what the shelf is worth. */
  @Get("report")
  async report(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = reportQuerySchema.parse(params);
    return withContext(this.app, context, async (tx) => readStockReport(tx, context.storeId, (await storePlan(tx, context.storeId)).plan, query));
  }

  /** What needs attention in each part of the Stock area (the tab row's badges). Before "items/:variantId". */
  @Get("summary")
  async summary(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readStockSummary(tx, context.storeId));
  }

  /** One item's page: its count, cost, reorder levels, history and the bills that bought it. Another shop's item is not found. */
  @Get("items/:variantId")
  async item(@CurrentStore() context: MerchantStore, @Param("variantId", ParseUUIDPipe) variantId: string) {
    const item = await withContext(this.app, context, async (tx) => readStockItem(tx, context.storeId, variantId, (await storePlan(tx, context.storeId)).plan));
    if (!item) throw new NotFoundException();
    return item;
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

  /** Start tracking many options at once (the Stock list's selection), each from its own count. */
  @Post("track-many")
  @HttpCode(200)
  async trackMany(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = stockTrackManyInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      assertPlanFeature(plan, "stock");
      await trackVariants(tx, context, input);
      return readStockPage(tx, context.storeId, plan);
    });
  }

  // ── Stock counts (CNT-…): a draft continued on any device, applied once ──

  /** The shop's counts, newest first (the open draft leads). */
  @Get("counts")
  async counts(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readStockCounts(tx, context.storeId));
  }

  /** Starts a count of every item or chosen categories — or answers with the open draft. */
  @Post("counts")
  @HttpCode(200)
  async startCount(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = stockCountStartInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      assertPlanFeature(await assertStoreWritable(tx, context.storeId), "stock");
      return readStockCount(tx, context.storeId, await startStockCount(tx, context, input));
    });
  }

  /** The stock counts report (design/screens.md S17 "Stock counts"): what the counts applied in a period found missing or over, and how accurate the shelf was. Before "counts/:id". */
  @Get("counts/report")
  async countReport(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = reportQuerySchema.parse(params);
    return withContext(this.app, context, async (tx) => readCountReport(tx, context.storeId, (await storePlan(tx, context.storeId)).plan, query));
  }

  /** One count with its lines and value; another shop's is not found. */
  @Get("counts/:id")
  async count(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const count = await withContext(this.app, context, (tx) => readStockCount(tx, context.storeId, id));
    if (!count) throw new NotFoundException();
    return count;
  }

  /** Counts as they're typed (a blank takes a line away). Answers with the count. */
  @Put("counts/:id/lines")
  async saveCountLines(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = stockCountLinesInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      assertPlanFeature(await assertStoreWritable(tx, context.storeId), "stock");
      await saveStockCountLines(tx, context, id, input);
      return readStockCount(tx, context.storeId, id);
    });
  }

  /** Applies a draft, once: every correction onto today's stock. Answers with the count. */
  @Post("counts/:id/apply")
  @HttpCode(200)
  async applyCount(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      assertPlanFeature(await assertStoreWritable(tx, context.storeId), "stock");
      await applyStockCount(tx, context, id);
      return readStockCount(tx, context.storeId, id);
    });
  }

  /** Cancels a draft: nothing moves. Answers with the count. */
  @Post("counts/:id/cancel")
  @HttpCode(200)
  async cancelCount(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      assertPlanFeature(await assertStoreWritable(tx, context.storeId), "stock");
      await cancelStockCount(tx, context, id);
      return readStockCount(tx, context.storeId, id);
    });
  }

  /** Reorder levels for one item, or many from the list's selection. */
  @Post("reorder")
  @HttpCode(200)
  async reorder(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = reorderLevelsInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      assertPlanFeature(plan, "stock");
      await setReorderLevels(tx, context.storeId, input);
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

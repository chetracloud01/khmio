import { Prisma, withContext, type AppDb } from "@khmio/db";
import { counterSaleInputSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertPlanFeature, assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readCounterDay, recordCounterSale, voidCounterSale } from "./counter-sale";

/** Selling in the shop (design/screens.md P1–P4): ring up a sale, today's sales, void. Basic plan and up. */
@Controller("counter")
@UseGuards(MerchantStoreGuard)
export class CounterController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Post("sales")
  @HttpCode(200)
  async sell(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = counterSaleInputSchema.parse(body);
    const run = () =>
      withContext(this.app, context, async (tx) => {
        const plan = await assertStoreWritable(tx, context.storeId);
        assertPlanFeature(plan, "counterSales");
        return recordCounterSale(tx, context, input, plan);
      });
    try {
      return await run();
    } catch (error) {
      // Two copies of the same sale arrived together and the other one won: answer with its sale.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return run();
      throw error;
    }
  }

  @Get("sales/today")
  async today(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readCounterDay(tx, context.storeId));
  }

  @Post("sales/:id/void")
  @HttpCode(200)
  async void(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await voidCounterSale(tx, context, id);
      return { voided: true };
    });
  }
}

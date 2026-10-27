import { withContext, type AppDb } from "@khmio/db";
import { dineTablesSaveSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { assertModule } from "../modules/modules";
import { markKitchenDone, readKitchen, readTables, saveTables } from "./tables";

/** Tables and kitchen (Features › tables): the shop's tables, and the Kitchen screen. */
@Controller()
@UseGuards(MerchantStoreGuard)
export class TablesController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get("tables")
  async tables(@CurrentStore() context: MerchantStore) {
    return { tables: await withContext(this.app, context, (tx) => readTables(tx)) };
  }

  @Put("tables")
  async saveTables(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = dineTablesSaveSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await assertModule(tx, context.storeId, "tables");
      return { tables: await saveTables(tx, context.storeId, input) };
    });
  }

  @Get("kitchen")
  async kitchen(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => {
      await assertModule(tx, context.storeId, "tables");
      return { orders: await readKitchen(tx) };
    });
  }

  @Post("kitchen/:orderId/done")
  @HttpCode(200)
  async done(@CurrentStore() context: MerchantStore, @Param("orderId", ParseUUIDPipe) orderId: string) {
    return withContext(this.app, context, async (tx) => {
      await assertModule(tx, context.storeId, "tables");
      if (!(await markKitchenDone(tx, orderId))) throw new NotFoundException();
      return { orders: await readKitchen(tx) };
    });
  }
}

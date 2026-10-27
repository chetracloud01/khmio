import { withContext, type AppDb } from "@khmio/db";
import { storeModulesInputSchema } from "@khmio/shared";
import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readStoreModules, saveStoreModules } from "./modules";

/** "Features for my business": the shop's modules (packages/shared business-modules.ts). */
@Controller("store/modules")
@UseGuards(MerchantStoreGuard)
export class ModulesController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async read(@CurrentStore() context: MerchantStore) {
    return { modules: await withContext(this.app, context, (tx) => readStoreModules(tx, context.storeId)) };
  }

  @Put()
  async save(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = storeModulesInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      return { modules: await saveStoreModules(tx, context, input) };
    });
  }
}

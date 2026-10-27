import { withContext, type AppDb } from "@khmio/db";
import { customFieldsSaveSchema } from "@khmio/shared";
import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { assertModule } from "../modules/modules";
import { readCustomFields, saveCustomFields } from "./custom-fields";

/** "My own fields" (Features › customFields): the shop's fields on products and on each item sold. */
@Controller("custom-fields")
@UseGuards(MerchantStoreGuard)
export class CustomFieldsController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async read(@CurrentStore() context: MerchantStore) {
    return { fields: await withContext(this.app, context, (tx) => readCustomFields(tx)) };
  }

  @Put()
  async save(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = customFieldsSaveSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await assertModule(tx, context.storeId, "customFields");
      return { fields: await saveCustomFields(tx, context, input) };
    });
  }
}

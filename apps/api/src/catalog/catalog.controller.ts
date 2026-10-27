import { withContext, type AppDb } from "@khmio/db";
import { catalogNameSchema } from "@khmio/shared";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { addCatalogName, readCatalog } from "./catalog";

const kindSchema = z.enum(["categories", "brands", "units"]);

/** The lists the product form picks from: categories, brands and units — each store's own. */
@Controller("catalog")
@UseGuards(MerchantStoreGuard)
export class CatalogController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async list(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readCatalog(tx, context.storeId));
  }

  /** "+ Add new category / brand / unit" in the product form. */
  @Post(":kind")
  async add(@CurrentStore() context: MerchantStore, @Param("kind") kind: string, @Body() body: unknown) {
    const which = kindSchema.parse(kind);
    const input = catalogNameSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      return addCatalogName(tx, context.storeId, which, input);
    });
  }
}

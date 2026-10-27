import { withContext, type AppDb } from "@khmio/db";
import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { APP_DB } from "../db";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { deleteProduct, parseProductSave, productExists, readProduct, readProducts, saveProduct, setProductVisibility } from "./products";

const visibilitySchema = z.object({ isVisible: z.boolean() });

/** The seller's products (roadmap step 3) — always their own store's, under row-level security. */
@Controller("products")
@UseGuards(MerchantStoreGuard)
export class ProductsController {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  private url = (key: string) => this.storage.publicUrl(key);

  @Get()
  async list(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readProducts(tx, context.storeId, this.url));
  }

  @Get(":id")
  async get(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const product = await withContext(this.app, context, (tx) => readProduct(tx, context.storeId, id, this.url));
    if (!product) throw new NotFoundException();
    return product;
  }

  @Post()
  async create(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = parseProductSave(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      return { id: await saveProduct(tx, context.storeId, plan, input) };
    });
  }

  @Put(":id")
  async update(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseProductSave(body);
    return withContext(this.app, context, async (tx) => {
      const plan = await assertStoreWritable(tx, context.storeId);
      if (!(await productExists(tx, id))) throw new NotFoundException();
      return { id: await saveProduct(tx, context.storeId, plan, input, id) };
    });
  }

  /** The "Show in shop" switch, without opening the form. */
  @Patch(":id/visibility")
  async setVisibility(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { isVisible } = visibilitySchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      if (!(await setProductVisibility(tx, id, isVisible))) throw new NotFoundException();
      return { id, isVisible };
    });
  }

  /** Soft delete: the product leaves the dashboard and the shop; old orders keep pointing at it. */
  @Delete(":id")
  @HttpCode(200)
  async remove(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      if (!(await deleteProduct(tx, id))) throw new NotFoundException();
      return { id, deleted: true };
    });
  }
}

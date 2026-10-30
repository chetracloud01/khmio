import { withContext, type AppDb, type Tx } from "@khmio/db";
import { reportQuerySchema, purchaseInputSchema, purchasePaymentInputSchema, purchaseReturnInputSchema, supplierArchiveInputSchema, supplierInputSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertPlanFeature, assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readPayablesReport } from "./payables";
import { recordPurchasePayment, voidPurchasePayment } from "./payments";
import { parsePurchaseListQuery, readPurchaseListPage } from "./purchase-list";
import { createPurchase, createPurchaseReturn, readPurchase } from "./purchases";
import { receivePurchase } from "./receive";
import { archiveSupplier, createSupplier, readSupplier, readSuppliers, updateSupplier } from "./suppliers";

/** Writes need a plan that follows stock (Pro, Advance); on a lower plan the bills stay readable, locked. */
async function assertCanBuy(tx: Tx, storeId: string): Promise<void> {
  assertPlanFeature(await assertStoreWritable(tx, storeId), "stock");
}

/** Supplier bills and returns (design/screens.md S13 "Purchases"). */
@Controller("purchases")
@UseGuards(MerchantStoreGuard)
export class PurchasesController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  /** One page of the list (packages/shared PURCHASE_LIST_SPEC). Before ":id". */
  @Get("page")
  async page(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = parsePurchaseListQuery(params);
    return withContext(this.app, context, (tx) => readPurchaseListPage(tx, context.storeId, query));
  }

  /** The payables report (design/screens.md S17): bought, paid and owed, by standing, age and supplier. Before ":id". */
  @Get("report")
  async report(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = reportQuerySchema.parse(params);
    return withContext(this.app, context, (tx) => readPayablesReport(tx, context.storeId, query));
  }

  @Get(":id")
  async get(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const purchase = await withContext(this.app, context, (tx) => readPurchase(tx, context.storeId, id));
    if (!purchase) throw new NotFoundException();
    return purchase;
  }

  /** Receive a bill: stock in and average cost for every line, all or nothing. Answers with the saved bill. */
  @Post()
  @HttpCode(200)
  async create(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = purchaseInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return readPurchase(tx, context.storeId, await createPurchase(tx, context, input));
    });
  }

  /** Pay the supplier against this bill (never more than it owes). Answers with the bill, the payment included. */
  @Post(":id/payments")
  @HttpCode(200)
  async pay(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = purchasePaymentInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return readPurchase(tx, context.storeId, await recordPurchasePayment(tx, context, id, input));
    });
  }

  /** Void a payment made by mistake. Answers with its bill. */
  @Post("payments/:paymentId/void")
  @HttpCode(200)
  async voidPayment(@CurrentStore() context: MerchantStore, @Param("paymentId", ParseUUIDPipe) paymentId: string) {
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return readPurchase(tx, context.storeId, await voidPurchasePayment(tx, context, paymentId));
    });
  }

  /** The goods of a bill saved before they arrived are here: they go into stock now. Answers with the bill. */
  @Post(":id/receive")
  @HttpCode(200)
  async receive(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return readPurchase(tx, context.storeId, await receivePurchase(tx, context, id));
    });
  }

  /** Send goods from this bill back to the supplier. Answers with the bill, its returns now included. */
  @Post(":id/returns")
  @HttpCode(200)
  async sendBack(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = purchaseReturnInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      await createPurchaseReturn(tx, context, id, input);
      return readPurchase(tx, context.storeId, id);
    });
  }
}

/** The shop's suppliers: kept, renamed, archived, never deleted. */
@Controller("suppliers")
@UseGuards(MerchantStoreGuard)
export class SuppliersController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async list(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readSuppliers(tx, context.storeId));
  }

  /** One supplier's page; another shop's supplier is not found. */
  /** The payables report (design/screens.md S17): bought, paid and owed, by standing, age and supplier. Before ":id". */
  @Get("report")
  async report(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = reportQuerySchema.parse(params);
    return withContext(this.app, context, (tx) => readPayablesReport(tx, context.storeId, query));
  }

  @Get(":id")
  async get(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const supplier = await withContext(this.app, context, (tx) => readSupplier(tx, context.storeId, id));
    if (!supplier) throw new NotFoundException();
    return supplier;
  }

  @Post()
  @HttpCode(200)
  async create(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = supplierInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return createSupplier(tx, context.storeId, input);
    });
  }

  @Patch(":id")
  async update(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = supplierInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return updateSupplier(tx, context.storeId, id, input);
    });
  }

  @Patch(":id/archive")
  async archive(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { archived } = supplierArchiveInputSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertCanBuy(tx, context.storeId);
      return archiveSupplier(tx, context.storeId, id, archived);
    });
  }
}

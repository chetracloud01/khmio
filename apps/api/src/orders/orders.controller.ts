import { withContext, type AppDb } from "@khmio/db";
import { orderActionRequestSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readSellerInvoice } from "./invoice";
import { readOrderDetail, runSellerAction } from "./order-actions";
import { parseOrderListQuery, readOrderList, readOrderListPage, readStoreSlug } from "./order-list";
import { sellerSummary } from "./summary";

/** The seller's orders (roadmap steps 4 and 6): the list, one order in full, and moving it on. */
@Controller("orders")
@UseGuards(MerchantStoreGuard)
export class OrdersController {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  @Get()
  async list(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readOrderList(tx, context.storeId));
  }

  /**
   * One page of the orders for the Orders list (the data grid's server mode):
   * search, tab, filters, sort and page in the address (packages/shared
   * ORDER_LIST_SPEC; anything else is refused). Before ":id".
   */
  @Get("page")
  async page(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = parseOrderListQuery(params);
    return withContext(this.app, context, async (tx) => readOrderListPage(tx, context.storeId, await readStoreSlug(tx, context.storeId), query));
  }

  /** The home page's numbers: waiting orders, today's sales, cash to collect, 30 days of totals, best sellers. Before ":id", so "summary" isn't read as an order id. */
  @Get("summary")
  async summary(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => sellerSummary(tx, context.storeId));
  }

  @Get(":id")
  async get(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, (tx) => readOrderDetail(tx, id));
  }

  /** The invoice / receipt for this order (design/screens.md B7), with the buyer's phone in full. */
  @Get(":id/invoice")
  async invoice(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const invoice = await withContext(this.app, context, (tx) => readSellerInvoice(tx, context.storeId, id, (key) => this.storage.publicUrl(key)));
    if (!invoice) throw new NotFoundException();
    return invoice;
  }

  /** Confirm, pack, send, delivered, cash collected, failed, rebook or cancel — only the step that follows the order's status. */
  @Post(":id/actions")
  @HttpCode(200)
  async act(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const request = orderActionRequestSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      return runSellerAction(tx, context, id, request);
    });
  }
}

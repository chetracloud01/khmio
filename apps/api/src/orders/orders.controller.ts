import { withContext, type AppDb } from "@khmio/db";
import { formatTrackingCode, orderActionRequestSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { invoiceOrderSelect, invoiceStoreSelect, toInvoice } from "./invoice";
import { readOrderDetail, runSellerAction } from "./order-actions";
import { sellerSummary } from "./summary";

/** Most orders the list returns; older ones stay in the database. */
const ORDER_LIST_LIMIT = 200;

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
    return withContext(this.app, context, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: context.storeId }, select: { slug: true } });
      const orders = await tx.order.findMany({
        orderBy: { createdAt: "desc" },
        take: ORDER_LIST_LIMIT,
        select: {
          id: true,
          orderNumber: true,
          trackingCode: true,
          status: true,
          paymentMethod: true,
          currency: true,
          totalMinor: true,
          buyerName: true,
          buyerPhone: true,
          fulfilment: true,
          area: true,
          districtId: true,
          provinceId: true,
          createdAt: true,
          items: { select: { quantity: true } },
        },
      });
      // The tracking code as printed, so the list's search finds an order by it.
      return orders.map(({ items, trackingCode, ...order }) => ({
        ...order,
        trackingCode: formatTrackingCode(store.slug, trackingCode),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      }));
    });
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
    return withContext(this.app, context, async (tx) => {
      const order = await tx.order.findFirst({ where: { id, storeId: context.storeId }, select: invoiceOrderSelect });
      if (!order) throw new NotFoundException();
      const store = await tx.store.findUniqueOrThrow({ where: { id: context.storeId }, select: invoiceStoreSelect });
      return toInvoice(order, store, (key) => this.storage.publicUrl(key), "seller");
    });
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

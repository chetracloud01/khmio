import { withPublicOrder, withPublicStore, type AppDb } from "@khmio/db";
import { canBuyerCancel, formatTrackingCode, normalizeKhmerPhone, parseTrackingCode, shopSlugSchema, toFieldErrors, trackOrderInputSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, Res } from "@nestjs/common";
import { readDeliverySettings } from "../delivery/delivery";
import { AppException, InvalidInputException } from "../errors";
import { APP_DB } from "../db";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { invoiceOrderSelect, invoiceStoreSelect, toInvoice } from "../orders/invoice";
import { ORDER_TOKEN_PATTERN, parsePlaceOrder, placeOrder } from "../orders/place-order";
import { linkFor, newLinkCode } from "../telegram/links";
import { productInclude, toProductDto } from "../products/products";
import { getEnv } from "../config";
import { clientAddress, RATE_LIMITER, type RateLimiter } from "../security/rate-limit";
import { requireHuman } from "../security/turnstile";
import { captureError } from "../sentry";

interface StatusResponse {
  status(code: number): unknown;
}
interface AddressRequest {
  ip?: string;
}

/**
 * What a buyer reaches, with no login: the shop page's data, placing an
 * order, and the order page. Read and written as a buyer (withPublicStore,
 * withPublicOrder): the database itself shows only the store's public face,
 * its visible products and delivery zones, and the buyer's own order.
 */
@Controller("public")
export class PublicController {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  private url = (key: string) => this.storage.publicUrl(key);

  @Get("stores/:slug")
  async store(@Param("slug") slug: string) {
    if (!shopSlugSchema.safeParse(slug).success) throw new NotFoundException();
    const shop = await withPublicStore(this.app, slug, async (tx, storeId) => {
      const [openRow] = await tx.$queryRaw<{ open: boolean }[]>`SELECT app_public_store_open() AS open`;
      const [store, categories, products, delivery] = await Promise.all([
        tx.store.findUniqueOrThrow({
          where: { id: storeId },
          select: {
            slug: true,
            name: true,
            businessType: true,
            phone: true,
            area: true,
            description: true,
            logoKey: true,
            defaultCurrency: true,
            usdToKhrRate: true,
            allowCod: true,
            vatPercent: true,
          },
        }),
        tx.category.findMany({ select: { id: true, nameKm: true, nameEn: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
        tx.product.findMany({ where: { deletedAt: null, isVisible: true }, include: productInclude, orderBy: { createdAt: "desc" } }),
        readDeliverySettings(tx, storeId),
      ]);
      const { logoKey, ...rest } = store;
      // Drivers are hidden from buyers by the database; only zones, pickup and provinces go out.
      const { zones, pickup, province } = delivery.settings;
      return {
        store: { ...rest, logoUrl: logoKey ? this.url(logoKey) : null },
        categories,
        // Wholesale prices are never shown to buyers.
        products: products.map((product) => toProductDto(product, this.url)),
        delivery: { zones, pickup, province },
        // Ordering needs delivery saved at least once; which payment methods fit is worked out per checkout
        // (packages/shared getAvailablePaymentMethods). KHQR joins in step 5.
        ordering: { deliveryConfigured: delivery.configured, khqrReady: false },
        // A paused shop: the page shows "temporarily closed" and orders are refused.
        open: openRow?.open ?? false,
      };
    });
    if (!shop) throw new NotFoundException();
    return shop;
  }

  /** Places an order: 201 with its link token; 200 with the same token when this checkout was already placed. */
  @Post("stores/:slug/orders")
  @HttpCode(201)
  async order(@Req() req: AddressRequest, @Param("slug") slug: string, @Body() body: unknown, @Res({ passthrough: true }) response: StatusResponse) {
    if (!shopSlugSchema.safeParse(slug).success) throw new NotFoundException();
    const address = clientAddress(req);
    await this.limits.hit("checkoutAddress", address);
    const request = parsePlaceOrder(body);
    const phone = typeof request.checkout.phone === "string" ? normalizeKhmerPhone(request.checkout.phone) : null;
    if (phone) await this.limits.hit("checkoutPhone", phone);
    await requireHuman(getEnv().TURNSTILE_SECRET_KEY, request.botCheck, address, () => captureError(new Error("Turnstile unreachable: an order went through without the bot check")));
    const placed = await placeOrder(this.app, slug, request);
    if (!placed) throw new NotFoundException();
    if (!placed.created) response.status(200);
    return { token: placed.token, orderNumber: placed.orderNumber };
  }

  /** The buyer's order page. The link's token is the only key; the order number alone opens nothing. */
  @Get("orders/:token")
  async orderPage(@Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    const found = await withPublicOrder(this.app, token, async (tx, storeId) => {
      const [order, store, followers] = await Promise.all([
        tx.order.findFirst({
          select: {
            orderNumber: true,
            trackingCode: true,
            status: true,
            paymentMethod: true,
            currency: true,
            subtotalMinor: true,
            discountMinor: true,
            deliveryFeeMinor: true,
            vatPercent: true,
            vatMinor: true,
            totalMinor: true,
            exchangeRateUsed: true,
            fulfilment: true,
            area: true,
            districtId: true,
            provinceId: true,
            landmark: true,
            pickupAddress: true,
            pickupHours: true,
            buyerName: true,
            cancelReason: true,
            createdAt: true,
            items: {
              // variantId: "Order again" puts the same options back in the buyer's cart.
              select: { variantId: true, titleKm: true, titleEn: true, variantLabelKm: true, variantLabelEn: true, unitPriceMinor: true, quantity: true, lineTotalMinor: true },
              orderBy: { createdAt: "asc" },
            },
            events: { select: { status: true, at: true }, orderBy: { at: "asc" } },
            // How it was sent: the driver's name or the bus ticket — the driver's phone stays with the shop.
            dispatches: { select: { route: true, driverName: true, busCompany: true, ticketNumber: true, dispatchedAt: true }, orderBy: { dispatchedAt: "desc" }, take: 1 },
          },
        }),
        tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { slug: true, name: true, phone: true, logoKey: true } }),
        // Whether this order is followed on Telegram (the database shows only this order's followers).
        tx.orderFollower.count({ where: { stoppedAt: null } }),
      ]);
      if (!order) return null;
      const { logoKey, ...shop } = store;
      const { dispatches, trackingCode, ...rest } = order;
      // The buyer's phone stays off this page: the link may be forwarded.
      return {
        ...rest,
        trackingCode: formatTrackingCode(store.slug, trackingCode),
        dispatch: dispatches[0] ?? null,
        canCancel: canBuyerCancel(order),
        followingOnTelegram: followers > 0,
        store: { ...shop, logoUrl: logoKey ? this.url(logoKey) : null },
      };
    });
    if (!found) throw new NotFoundException();
    return found;
  }

  /** The buyer's invoice / receipt (design/screens.md B7): the saved amounts, the shop's invoice details, their phone half hidden. */
  @Get("orders/:token/invoice")
  async invoice(@Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    const found = await withPublicOrder(this.app, token, async (tx, storeId) => {
      const order = await tx.order.findFirst({ select: invoiceOrderSelect });
      if (!order) return null;
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: invoiceStoreSelect });
      return toInvoice(order, store, this.url, "buyer");
    });
    if (!found) throw new NotFoundException();
    return found;
  }

  /**
   * "Track my order" (design/screens.md B8): the order link for a tracking code and the phone it was placed with.
   * A wrong pair is one answer (404), never which half was wrong; tries are limited per address.
   */
  @Post("track")
  @HttpCode(200)
  async track(@Req() req: AddressRequest, @Body() body: unknown) {
    await this.limits.hit("trackOrder", clientAddress(req));
    const parsed = trackOrderInputSchema.safeParse(body);
    if (!parsed.success) throw new InvalidInputException(toFieldErrors(parsed.error));
    const code = parseTrackingCode(parsed.data.code);
    if (!code) throw new InvalidInputException({ code: "tracking_code_invalid" });
    const [row] = await this.app.$queryRaw<{ token: string | null }[]>`SELECT app_order_token_by_tracking(${code}, ${parsed.data.phone}) AS token`;
    if (!row?.token) throw new NotFoundException();
    return { token: row.token };
  }

  /** "Get updates on Telegram": a t.me link with a one-time code for this order (15 minutes). */
  @Post("orders/:token/telegram-link")
  @HttpCode(200)
  async telegramLink(@Req() req: AddressRequest, @Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    await this.limits.hit("buyerAction", clientAddress(req));
    const { code, codeHash, expiresAt } = newLinkCode("order_follow");
    const link = await linkFor(code, false);
    const made = await withPublicOrder(this.app, token, async (tx, storeId) => {
      const order = await tx.order.findFirst({ select: { id: true } });
      if (!order) return false;
      // createMany: the buyer may write the code but never read codes back.
      await tx.telegramLinkCode.createMany({ data: [{ kind: "order_follow", codeHash, storeId, orderId: order.id, expiresAt }] });
      return true;
    });
    if (!made) throw new NotFoundException();
    return { link, expiresAt };
  }

  /** The buyer cancels their own order — only while no money has moved and nothing is packed (canBuyerCancel). */
  @Post("orders/:token/cancel")
  @HttpCode(200)
  async cancel(@Req() req: AddressRequest, @Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    await this.limits.hit("buyerAction", clientAddress(req));
    const result = await withPublicOrder(this.app, token, async (tx) => {
      const order = await tx.order.findFirst({ select: { status: true, paymentMethod: true, fulfilment: true, area: true } });
      if (!order) return "missing" as const;
      if (!canBuyerCancel(order)) return "refused" as const;
      // The database function cancels only from the status read here, records the history and tells the seller.
      const [row] = await tx.$queryRaw<{ cancelled: boolean }[]>`SELECT app_buyer_cancel_order(${order.status}::"OrderStatus") AS cancelled`;
      return row?.cancelled ? ("cancelled" as const) : ("refused" as const);
    });
    if (!result || result === "missing") throw new NotFoundException();
    if (result === "refused") throw new AppException(409, "action_not_allowed");
    return { cancelled: true };
  }
}

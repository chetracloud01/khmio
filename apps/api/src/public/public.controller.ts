import { withPublicOrder, withPublicStore, type AppDb } from "@khmio/db";
import type { PaymentProvider } from "@khmio/payments";
import { normalizeKhmerPhone, parseTrackingCode, shopSlugSchema, toFieldErrors, trackOrderInputSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, Res } from "@nestjs/common";
import { AppException, InvalidInputException } from "../errors";
import { APP_DB } from "../db";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { ORDER_TOKEN_PATTERN, parsePlaceOrder, placeOrder } from "../orders/place-order";
import { KHQR } from "../payments/khqr";
import { linkFor, newLinkCode } from "../telegram/links";
import { getEnv } from "../config";
import { clientAddress, RATE_LIMITER, type RateLimiter } from "../security/rate-limit";
import { requireHuman } from "../security/turnstile";
import { captureError } from "../sentry";
import { addFollowCode, cancelAsBuyer, orderTokenByTracking, readPublicInvoice, readPublicOrder } from "./public-order";
import { readPublicShop, toPublicShop } from "./public-shop";

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
    @Inject(KHQR) private readonly khqr: PaymentProvider | null,
  ) {}

  private url = (key: string) => this.storage.publicUrl(key);

  @Get("stores/:slug")
  async store(@Param("slug") slug: string) {
    if (!shopSlugSchema.safeParse(slug).success) throw new NotFoundException();
    const shop = await withPublicStore(this.app, slug, async (tx, storeId) => toPublicShop(await readPublicShop(tx, storeId, this.khqr), this.url));
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
    const placed = await placeOrder(this.app, slug, request, this.khqr);
    if (!placed) throw new NotFoundException();
    if (!placed.created) response.status(200);
    return { token: placed.token, orderNumber: placed.orderNumber };
  }

  /** The buyer's order page. The link's token is the only key; the order number alone opens nothing. */
  @Get("orders/:token")
  async orderPage(@Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    const testBank = getEnv().KHQR_PROVIDER === "fake";
    const found = await withPublicOrder(this.app, token, (tx, storeId) => readPublicOrder(tx, storeId, this.url, testBank));
    if (!found) throw new NotFoundException();
    return found;
  }

  /** The buyer's invoice / receipt (design/screens.md B7): the saved amounts, the shop's invoice details, their phone half hidden. */
  @Get("orders/:token/invoice")
  async invoice(@Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    const found = await withPublicOrder(this.app, token, (tx, storeId) => readPublicInvoice(tx, storeId, this.url));
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
    const token = await orderTokenByTracking(this.app, code, parsed.data.phone);
    if (!token) throw new NotFoundException();
    return { token };
  }

  /** "Get updates on Telegram": a t.me link with a one-time code for this order (15 minutes). */
  @Post("orders/:token/telegram-link")
  @HttpCode(200)
  async telegramLink(@Req() req: AddressRequest, @Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    await this.limits.hit("buyerAction", clientAddress(req));
    const { code, codeHash, expiresAt } = newLinkCode("order_follow");
    const link = await linkFor(code, false);
    const made = await withPublicOrder(this.app, token, (tx, storeId) => addFollowCode(tx, storeId, codeHash, expiresAt));
    if (!made) throw new NotFoundException();
    return { link, expiresAt };
  }

  /** The buyer cancels their own order — only while no money has moved and nothing is packed (canBuyerCancel). */
  @Post("orders/:token/cancel")
  @HttpCode(200)
  async cancel(@Req() req: AddressRequest, @Param("token") token: string) {
    if (!ORDER_TOKEN_PATTERN.test(token)) throw new NotFoundException();
    await this.limits.hit("buyerAction", clientAddress(req));
    const result = await withPublicOrder(this.app, token, cancelAsBuyer);
    if (!result || result === "missing") throw new NotFoundException();
    if (result === "refused") throw new AppException(409, "action_not_allowed");
    return { cancelled: true };
  }
}

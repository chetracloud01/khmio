import { withContext, type AppDb } from "@khmio/db";
import { shopDetailsSaveSchema } from "@khmio/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { AppException, InvalidInputException } from "../errors";
import { isStorePhotoKey } from "../files/photos";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { RATE_LIMITER, type RateLimiter } from "../security/rate-limit";
import { linkFor, newLinkCode } from "../telegram/links";
import { addGroupLinkCode, readStaffGroups, unlinkStaffGroup } from "./staff-groups";
import { readDeliverySettings } from "../delivery/delivery";
import { isReadyToShare, markLinkShared, pickupSwitchProblem, readRateBand, readStoreDetails, saveStoreDetails } from "./store";

/**
 * The shop details page (design/screens.md S10), saved in one go: the shop,
 * its location and pickup, getting paid (Bakong ID, cash on delivery),
 * prices and tax, and "On your invoices".
 */
@Controller("store")
@UseGuards(MerchantStoreGuard)
export class StoreController {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  private url = (key: string) => this.storage.publicUrl(key);

  @Get()
  async get(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readStoreDetails(tx, context.storeId, this.url));
  }

  /**
   * "Share your shop link" was used (copied, shared or the QR downloaded).
   * Only once the shop is ready for buyers (packages/shared canShareShop).
   */
  @Post("link-shared")
  @HttpCode(200)
  async linkShared(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => {
      if (!isReadyToShare(await readStoreDetails(tx, context.storeId, this.url))) throw new AppException(409, "action_not_allowed");
      await markLinkShared(tx, context.storeId);
      return { linkShared: true };
    });
  }

  /** The shop's staff Telegram groups (they get the same order alerts). */
  @Get("telegram-groups")
  async telegramGroups(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, readStaffGroups);
  }

  /** "Add the bot to your staff group": a t.me link with a one-time code (15 minutes) for this shop. */
  @Post("telegram-groups/link")
  @HttpCode(200)
  async telegramGroupLink(@CurrentStore() context: MerchantStore) {
    await this.limits.hit("groupLink", context.storeId);
    const { code, codeHash, expiresAt } = newLinkCode("group_link");
    const link = await linkFor(code, true);
    await withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await addGroupLinkCode(tx, context, codeHash, expiresAt);
    });
    return { link, expiresAt };
  }

  @Delete("telegram-groups/:id")
  @HttpCode(200)
  async unlinkTelegramGroup(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      if (!(await unlinkStaffGroup(tx, context, id))) throw new NotFoundException();
      return { unlinked: true };
    });
  }

  @Put()
  async save(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    return withContext(this.app, context, async (tx) => {
      // The rate must sit inside the band the platform allows today — refused on save, never silently clamped at checkout.
      const input = shopDetailsSaveSchema(await readRateBand(tx)).parse(body);
      if (input.logoKey && !isStorePhotoKey(context.storeId, input.logoKey)) throw new InvalidInputException({ logoKey: "photo_required" });
      await assertStoreWritable(tx, context.storeId);
      const pickupProblem = pickupSwitchProblem(await readDeliverySettings(tx, context.storeId), input.pickupEnabled);
      if (pickupProblem) throw new InvalidInputException({ pickupEnabled: pickupProblem });
      await saveStoreDetails(tx, context, input);
      return readStoreDetails(tx, context.storeId, this.url);
    });
  }
}

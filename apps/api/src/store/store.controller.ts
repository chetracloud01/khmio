import { withContext, type AppDb } from "@khmio/db";
import { getMissingForSharing, invoiceDetailsSchema, storeDetailsSaveSchema, storeSettingsSchema } from "@khmio/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { AppException, InvalidInputException } from "../errors";
import { isStorePhotoKey } from "../files/photos";
import { FILE_STORAGE, type FileStorage } from "../files/storage";
import { assertStoreWritable, storePlan } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";

import { linkFor, newLinkCode } from "../telegram/links";
import { RATE_LIMITER, type RateLimiter } from "../security/rate-limit";

const storeSelect = {
  slug: true,
  name: true,
  businessType: true,
  phone: true,
  area: true,
  description: true,
  logoKey: true,
  usdToKhrRate: true,
  defaultCurrency: true,
  allowCod: true,
  deliveryConfiguredAt: true,
  linkSharedAt: true,
  taxNumber: true,
  invoiceNote: true,
  telegramLink: true,
  facebookLink: true,
} as const;

/** The shop details page: name, business type, phone, area, description, logo and the (optional) Bakong ID. */
@Controller("store")
@UseGuards(MerchantStoreGuard)
export class StoreController {
  constructor(
    @Inject(APP_DB) private readonly app: AppDb,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(RATE_LIMITER) private readonly limits: RateLimiter,
  ) {}

  @Get()
  async get(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => this.details(tx, context.storeId));
  }

  /** Store settings: the currency buyers see first, the USD to KHR rate, cash on delivery, VAT. */
  @Get("settings")
  async getSettings(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => this.settings(tx, context.storeId));
  }

  @Put("settings")
  async saveSettings(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      // The rate must sit inside the band the platform allows today — refused on save, never silently clamped at checkout.
      const input = storeSettingsSchema(await this.rateBand(tx)).omit({ onlineStockLocation: true }).parse(body);
      await tx.store.update({ where: { id: context.storeId }, data: input });
      await tx.auditLog.create({
        data: { actorType: "merchant", actorId: context.merchantId, storeId: context.storeId, action: "store.settings_saved", entity: "store", entityId: context.storeId },
      });
      return this.settings(tx, context.storeId);
    });
  }

  /** "On your invoices" (design/screens.md S10): tax number, note, Telegram and Facebook — saved on their own, apart from the shop details. */
  @Put("invoice")
  async saveInvoiceDetails(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = invoiceDetailsSchema.parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await tx.store.update({ where: { id: context.storeId }, data: input });
      await tx.auditLog.create({
        data: { actorType: "merchant", actorId: context.merchantId, storeId: context.storeId, action: "store.invoice_details_saved", entity: "store", entityId: context.storeId },
      });
      return this.details(tx, context.storeId);
    });
  }

  /**
   * "Share your shop link" was used (copied, shared or the QR downloaded).
   * Only once the shop is ready for buyers (packages/shared getMissingForSharing).
   */
  @Post("link-shared")
  @HttpCode(200)
  async linkShared(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, async (tx) => {
      const details = await this.details(tx, context.storeId);
      if (getMissingForSharing({ businessType: details.businessType, shopPhone: details.phone, ...details.readiness }).length > 0) {
        throw new AppException(409, "action_not_allowed");
      }
      await tx.store.updateMany({ where: { id: context.storeId, linkSharedAt: null }, data: { linkSharedAt: new Date() } });
      return { linkShared: true };
    });
  }

  /** The shop's staff Telegram groups (they get the same order alerts). */
  @Get("telegram-groups")
  async telegramGroups(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) =>
      tx.storeAlertChat.findMany({ select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    );
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
      // createMany: the API may write codes but never read them back.
      await tx.telegramLinkCode.createMany({ data: [{ kind: "group_link", codeHash, storeId: context.storeId, createdBy: context.merchantId, expiresAt }] });
    });
    return { link, expiresAt };
  }

  @Delete("telegram-groups/:id")
  @HttpCode(200)
  async unlinkTelegramGroup(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return withContext(this.app, context, async (tx) => {
      const { count } = await tx.storeAlertChat.deleteMany({ where: { id } });
      if (count === 0) throw new NotFoundException();
      await tx.auditLog.create({ data: { actorType: "merchant", actorId: context.merchantId, storeId: context.storeId, action: "store.telegram_group_unlinked", entity: "store", entityId: context.storeId } });
      return { unlinked: true };
    });
  }

  @Put()
  async save(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = storeDetailsSaveSchema.parse(body);
    if (input.logoKey && !isStorePhotoKey(context.storeId, input.logoKey)) throw new InvalidInputException({ logoKey: "photo_required" });
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await tx.store.update({
        where: { id: context.storeId },
        data: {
          name: input.shopName,
          businessType: input.businessType,
          phone: input.phone,
          area: input.area,
          description: input.description,
          logoKey: input.logoKey,
        },
      });
      // A Bakong ID is optional: clearing it turns KHQR off for the shop; cash on delivery still works.
      await tx.storePaymentConfig.upsert({
        where: { storeId_provider: { storeId: context.storeId, provider: "bakong_khqr" } },
        create: { storeId: context.storeId, provider: "bakong_khqr", bakongAccountId: input.bakongId || null, enabled: input.bakongId !== "" },
        update: { bakongAccountId: input.bakongId || null, enabled: input.bakongId !== "" },
      });
      await tx.auditLog.create({
        data: { actorType: "merchant", actorId: context.merchantId, storeId: context.storeId, action: "store.details_saved", entity: "store", entityId: context.storeId },
      });
      return this.details(tx, context.storeId);
    });
  }

  private async rateBand(tx: Parameters<Parameters<typeof withContext>[2]>[0]) {
    const platform = await tx.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { usdToKhrMin: true, usdToKhrMax: true } });
    return { min: platform.usdToKhrMin, max: platform.usdToKhrMax };
  }

  private async settings(tx: Parameters<Parameters<typeof withContext>[2]>[0], storeId: string) {
    const [store, band] = await Promise.all([
      tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultCurrency: true, usdToKhrRate: true, allowCod: true, vatPercent: true } }),
      this.rateBand(tx),
    ]);
    return { ...store, rateBand: band };
  }

  /** The shop's details, plus what the dashboard needs around them: the plan in force and the setup checklist's facts. */
  private async details(tx: Parameters<Parameters<typeof withContext>[2]>[0], storeId: string) {
    const visible = { deletedAt: null, isVisible: true } as const;
    const [{ usdToKhrRate, allowCod, deliveryConfiguredAt, linkSharedAt, ...store }, bakong, plan, visibleProducts, productsWithPhoto] = await Promise.all([
      tx.store.findUniqueOrThrow({ where: { id: storeId }, select: storeSelect }),
      tx.storePaymentConfig.findUnique({ where: { storeId_provider: { storeId, provider: "bakong_khqr" } }, select: { bakongAccountId: true } }),
      storePlan(tx, storeId),
      tx.product.count({ where: visible }),
      tx.product.count({ where: { ...visible, photos: { some: {} } } }),
    ]);
    const bakongId = bakong?.bakongAccountId ?? "";
    return {
      ...store,
      logoUrl: store.logoKey ? this.storage.publicUrl(store.logoKey) : null,
      bakongId,
      usdToKhrRate,
      plan: plan.plan,
      paused: plan.paused,
      // The facts packages/shared shop-readiness.ts asks for.
      readiness: { visibleProducts, productsWithPhoto, deliveryConfigured: deliveryConfiguredAt !== null, khqrReady: bakongId !== "", codEnabled: allowCod },
      /** The last checklist step: the seller shared (copied or sent) the shop link. */
      linkShared: linkSharedAt !== null,
    };
  }
}

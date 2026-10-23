import { type AppDb, merchantActor, withContext, writeAudit } from "@khmio/db";
import { deliverySettingsSchema, deliverySettingsShape } from "@khmio/shared";
import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { readDeliverySettings, saveDeliverySettings } from "./delivery";

/** The delivery page (roadmap step 4): Phnom Penh zones and fees, provinces, drivers. Pickup is saved on Shop details. */
@Controller("delivery")
@UseGuards(MerchantStoreGuard)
export class DeliveryController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get()
  async get(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readDeliverySettings(tx, context.storeId));
  }

  @Put()
  async save(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const sent = deliverySettingsShape.omit({ pickup: true }).parse(body);
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      // Checked with pickup as saved, so this page can't switch off the shop's last way to get an order.
      const { settings: current } = await readDeliverySettings(tx, context.storeId);
      const settings = deliverySettingsSchema.parse({ ...sent, pickup: current.pickup });
      await saveDeliverySettings(tx, context.storeId, settings);
      await writeAudit(tx, merchantActor(context), { action: "store.delivery_saved", entity: "store", entityId: context.storeId });
      return readDeliverySettings(tx, context.storeId);
    });
  }
}

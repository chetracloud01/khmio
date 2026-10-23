import type { SystemDb } from "@khmio/db";
import { createStoreInputSchema } from "@khmio/shared";
import { Body, ConflictException, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { SYSTEM_DB } from "../db";
import { InvalidInputException } from "../errors";
import { CurrentMerchant, SessionGuard } from "../auth/session.guard";
import { createStore, slugAvailability } from "./create-store";

@Controller("stores")
@UseGuards(SessionGuard)
export class StoresController {
  constructor(@Inject(SYSTEM_DB) private readonly system: SystemDb) {}

  /** Onboarding's live check while the seller types a link. Answers only yes or no — it never shows whose shop it is. */
  @Get("slug-available")
  async slugAvailable(@Query("slug") slug: unknown) {
    return slugAvailability(this.system, slug);
  }

  /** Onboarding's "Finish": the two answers become a shop. */
  @Post()
  async create(@CurrentMerchant() merchantId: string, @Body() body: unknown) {
    const input = createStoreInputSchema.parse(body);
    const result = await createStore(this.system, merchantId, input);
    if (result.ok) return { storeId: result.storeId };
    if (result.reason === "slug_taken") throw new InvalidInputException({ slug: "slug_taken" });
    throw new ConflictException();
  }
}

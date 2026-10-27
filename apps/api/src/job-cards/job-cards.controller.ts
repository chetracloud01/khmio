import { withContext, type AppDb, type Tx } from "@khmio/db";
import { jobCardInputSchema, jobCardStatusRequestSchema, vehicleInputSchema } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { APP_DB } from "../db";
import { assertStoreWritable } from "../merchant/plan";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { assertModule } from "../modules/modules";
import { addVehicle, createJobCard, moveJobCard, readJobCard, readJobCards, readVehicles, updateJobCard } from "./job-cards";

const searchSchema = z.object({ search: z.string().max(60).default("") });

/** Vehicles and job cards (Features › jobCards). Every route needs the module; writes need a writable shop. */
@Controller()
@UseGuards(MerchantStoreGuard)
export class JobCardsController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  private read<T>(context: MerchantStore, work: (tx: Tx) => Promise<T>) {
    return withContext(this.app, context, async (tx) => {
      await assertModule(tx, context.storeId, "jobCards");
      return work(tx);
    });
  }

  private write<T>(context: MerchantStore, work: (tx: Tx) => Promise<T>) {
    return withContext(this.app, context, async (tx) => {
      await assertStoreWritable(tx, context.storeId);
      await assertModule(tx, context.storeId, "jobCards");
      return work(tx);
    });
  }

  @Get("vehicles")
  async vehicles(@CurrentStore() context: MerchantStore, @Query() query: unknown) {
    const { search } = searchSchema.parse(query);
    return { vehicles: await this.read(context, (tx) => readVehicles(tx, search)) };
  }

  @Post("vehicles")
  async addVehicle(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = vehicleInputSchema.parse(body);
    return this.write(context, (tx) => addVehicle(tx, context.storeId, input));
  }

  @Get("job-cards")
  async list(@CurrentStore() context: MerchantStore) {
    return { jobCards: await this.read(context, (tx) => readJobCards(tx)) };
  }

  @Post("job-cards")
  async create(@CurrentStore() context: MerchantStore, @Body() body: unknown) {
    const input = jobCardInputSchema.parse(body);
    return this.write(context, (tx) => createJobCard(tx, context.storeId, input));
  }

  @Get("job-cards/:id")
  async one(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    return this.read(context, (tx) => readJobCard(tx, id));
  }

  @Put("job-cards/:id")
  async update(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = jobCardInputSchema.parse(body);
    return this.write(context, (tx) => updateJobCard(tx, context.storeId, id, input));
  }

  @Post("job-cards/:id/status")
  @HttpCode(200)
  async move(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { status } = jobCardStatusRequestSchema.parse(body);
    return this.write(context, (tx) => moveJobCard(tx, id, status));
  }
}

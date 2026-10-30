import { withContext, type AppDb } from "@khmio/db";
import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { APP_DB } from "../db";
import { CurrentStore, MerchantStoreGuard, type MerchantStore } from "../merchant/store.guard";
import { parseCustomerListQuery, readCustomer, readCustomerPage, readCustomerStatus } from "./customers";

/** The shop's customers (design/screens.md S14): every plan, read only. */
@Controller("customers")
@UseGuards(MerchantStoreGuard)
export class CustomersController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  /** One page of the list: search, sort and page in the address (packages/shared CUSTOMER_LIST_SPEC; anything else is refused). Before ":id". */
  @Get("page")
  async page(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = parseCustomerListQuery(params);
    return withContext(this.app, context, (tx) => readCustomerPage(tx, context.storeId, query));
  }

  /** The Customers page's tiles: how many customers in each view, and what they've spent. Before ":id". */
  @Get("status")
  async status(@CurrentStore() context: MerchantStore) {
    return withContext(this.app, context, (tx) => readCustomerStatus(tx, context.storeId));
  }

  /** One customer with their numbers and orders; another shop's customer is not found. */
  @Get(":id")
  async get(@CurrentStore() context: MerchantStore, @Param("id", ParseUUIDPipe) id: string) {
    const customer = await withContext(this.app, context, (tx) => readCustomer(tx, context.storeId, id));
    if (!customer) throw new NotFoundException();
    return customer;
  }
}

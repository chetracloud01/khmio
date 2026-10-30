import {
  PURCHASE_PAYMENT_STATES,
  STOCK_COUNT_STATUSES,
  currencySchema,
  purchasePaymentMethodSchema,
  stockMovementReasonSchema,
  stockMovementTypeSchema,
} from "@khmio/shared";
import { z } from "zod";
import { listPageSchema, perCurrency } from "./shapes";

/** GET /stock (and every stock change): each live product option with its count at the main branch, and the latest changes. */
export const stockPageSchema = z.object({
  /** Pro and Advance write; on a lower plan the counts are shown, locked. */
  tracksStock: z.boolean(),
  /** At or below this many, an option is marked low. */
  lowAt: z.number(),
  /** On hand × cost, dollars and riel apart, and how many options in stock have no cost yet. */
  value: z.object({ USD: z.number(), KHR: z.number(), withoutCost: z.number() }),
  items: z.array(
    z.object({
      variantId: z.string(),
      productId: z.string(),
      titleKm: z.string(),
      titleEn: z.string(),
      categoryId: z.string(),
      brandId: z.string().nullable(),
      optionKm: z.string(),
      optionEn: z.string(),
      sku: z.string(),
      /** null = not tracked: sells without a limit. */
      onHand: z.number().nullable(),
      /** Free stock at or below its reorder point (sold out included): "Low" and "To reorder". */
      low: z.boolean(),
      /** The item's own reorder levels; null = the shop's rule. */
      reorderMin: z.number().nullable(),
      reorderMax: z.number().nullable(),
      /** How many to order now; null when it doesn't need ordering. */
      suggested: z.number().nullable(),
      /** Its newest bill: who it came from and what one cost (in the product's cost currency). */
      lastSupplierId: z.string().nullable(),
      lastSupplierName: z.string().nullable(),
      lastCostMinor: z.number().nullable(),
      /** The option's cost (the average after purchases); null = not known. */
      costMinor: z.number().nullable(),
      costCurrency: currencySchema.nullable(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.string(),
      variantId: z.string(),
      type: stockMovementTypeSchema,
      quantity: z.number(),
      reason: stockMovementReasonSchema.nullable(),
      note: z.string(),
      /** The bill (or return to the supplier) it belongs to. */
      purchaseId: z.string().nullable(),
      purchaseNumber: z.number().nullable(),
      /** A purchase turned from its bill's other currency: the bill's currency and the rate used. */
      billCurrency: currencySchema.nullable(),
      billRate: z.number().nullable(),
      /** A purchase's cost of one and who it came from. */
      unitCostMinor: z.number().nullable(),
      costCurrency: currencySchema.nullable(),
      supplier: z.string(),
      createdAt: z.string(),
      orderId: z.string().nullable(),
      orderNumber: z.number().nullable(),
      inStore: z.boolean(),
    }),
  ),
});
export type StockPage = z.infer<typeof stockPageSchema>;

/** GET /suppliers: every supplier, live ones first. */
export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  note: z.string(),
  archived: z.boolean(),
  purchaseCount: z.number(),
  /** What the shop still owes them, dollars and riel apart. */
  owed: z.object({ USD: z.number(), KHR: z.number() }),
  /** Bills less returns, dollars and riel apart. */
  bought: z.object({ USD: z.number(), KHR: z.number() }),
  /** YYYY-MM-DD of the last bill; null = none yet. */
  lastBillOn: z.string().nullable(),
});
export type Supplier = z.infer<typeof supplierSchema>;
export const suppliersSchema = z.object({ suppliers: z.array(supplierSchema) });

/** GET /purchases/page: one row per bill or return to the supplier. */
export const purchaseRowSchema = z.object({
  id: z.string(),
  number: z.number(),
  kind: z.enum(["purchase", "return"]),
  billRef: z.string(),
  /** YYYY-MM-DD, as on the bill. */
  purchasedOn: z.string(),
  currency: currencySchema,
  totalMinor: z.number(),
  supplierId: z.string().nullable(),
  supplierName: z.string(),
  /** A return: the bill it sends goods back from. */
  returnsId: z.string().nullable(),
  returnsNumber: z.number().nullable(),
  lineCount: z.number(),
  /** Bought on credit: the day it's due (YYYY-MM-DD). */
  dueOn: z.string().nullable(),
  /** When the goods arrived and stock went up (a return always has one); null: not received yet. */
  receivedAt: z.string().nullable(),
  /** A bill's standing with its supplier; null on a return. */
  payment: z
    .object({ paid: z.number(), returned: z.number(), owed: z.number(), state: z.enum(PURCHASE_PAYMENT_STATES) })
    .nullable(),
});
export type PurchaseRow = z.infer<typeof purchaseRowSchema>;

/** GET /purchases/:id, POST /purchases, POST /purchases/:id/returns: one bill with its lines and returns. */
export const purchaseDetailSchema = purchaseRowSchema.extend({
  /** Riel per $1 used to turn lines into their items' cost currencies; null: nothing was turned. */
  exchangeRateUsed: z.number().nullable(),
  note: z.string(),
  createdAt: z.string(),
  lines: z.array(
    z.object({
      variantId: z.string(),
      productId: z.string(),
      titleKm: z.string(),
      titleEn: z.string(),
      optionKm: z.string(),
      optionEn: z.string(),
      sku: z.string(),
      quantity: z.number(),
      unitCostMinor: z.number(),
      lineTotalMinor: z.number(),
      /** The cost of one in the item's own currency (what went into its average); null on bills from before rates were kept. */
      itemCostMinor: z.number().nullable(),
      itemCostCurrency: currencySchema.nullable(),
      /** How many may still go back to the supplier (0 on a return). */
      returnable: z.number(),
    }),
  ),
  returnedBy: z.array(z.object({ id: z.string(), number: z.number(), purchasedOn: z.string(), totalMinor: z.number() })),
  /** The supplier's phone (855…), or empty. */
  supplierPhone: z.string(),
  /** Who received it; null: not received, or someone this merchant may not see. */
  receivedByName: z.string().nullable(),
  /** Payments against the bill, voided ones too (crossed out). */
  payments: z.array(z.object({ id: z.string(), number: z.number(), paidOn: z.string(), amountMinor: z.number(), method: purchasePaymentMethodSchema, note: z.string(), createdAt: z.string(), voided: z.boolean() })),
});
export type PurchaseDetail = z.infer<typeof purchaseDetailSchema>;

/** GET /purchases/page: one page of the list, and what the list shows was bought (bills less returns, dollars and riel apart). */
export const purchaseListPageSchema = listPageSchema(purchaseRowSchema).extend({
  totals: z.object({ USD: z.number(), KHR: z.number() }),
  /** What the shop owes its suppliers in all. */
  owed: z.object({ USD: z.number(), KHR: z.number() }),
});

/** GET /stock/counts/:id (and the count routes' answers): a stock count (CNT-…), its lines and what its differences are worth. */
export const stockCountSchema = z.object({
  id: z.string(),
  number: z.number(),
  status: z.enum(STOCK_COUNT_STATUSES),
  /** The categories counted; empty = every item. */
  categoryIds: z.array(z.string()),
  note: z.string(),
  startedAt: z.string(),
  appliedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  lines: z.array(
    z.object({
      variantId: z.string(),
      counted: z.number(),
      /** What the app had when it was typed; null = it wasn't tracked. */
      expectedOnHand: z.number().nullable(),
      countedAt: z.string(),
      /** Fixed when applied; a draft's is today's. */
      costMinor: z.number().nullable(),
      costCurrency: currencySchema.nullable(),
    }),
  ),
  value: z.object({ lost: perCurrency, found: perCurrency, net: perCurrency, lostItems: z.number(), foundItems: z.number(), withoutCost: z.number() }),
});
export type StockCount = z.infer<typeof stockCountSchema>;
export const stockCountsSchema = z.object({ counts: z.array(stockCountSchema) });

/** GET /stock/items/:variantId: one item's page — its Stock list row, what's held, its history and the bills that bought it. */
export const stockItemDetailSchema = z.object({
  tracksStock: z.boolean(),
  item: stockPageSchema.shape.items.element,
  held: z.number(),
  movements: stockPageSchema.shape.movements,
  bills: z.array(
    z.object({
      purchaseId: z.string(),
      number: z.number(),
      purchasedOn: z.string(),
      currency: currencySchema,
      exchangeRateUsed: z.number().nullable(),
      supplierName: z.string(),
      quantity: z.number(),
      unitCostMinor: z.number(),
      lineTotalMinor: z.number(),
      itemCostMinor: z.number().nullable(),
      itemCostCurrency: currencySchema.nullable(),
    }),
  ),
});
export type StockItemDetail = z.infer<typeof stockItemDetailSchema>;

/** GET /stock/summary: what needs attention in each part of the Stock area (the tab row's badges). */
export const stockSummarySchema = z.object({ toReorder: z.number(), unpaidBills: z.number(), overdueBills: z.number(), suppliers: z.number() });
export type StockSummary = z.infer<typeof stockSummarySchema>;

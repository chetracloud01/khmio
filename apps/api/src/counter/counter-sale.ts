import { merchantActor, writeAudit, type Prisma, type Tx } from "@khmio/db";
import { cashChange, computeOrderTotal, startOfPhnomPenhDay, type CounterSaleInput, type Currency, type OrderTotal, type PlanId } from "@khmio/shared";
import { AppException, InvalidInputException } from "../errors";
import type { MerchantStore } from "../merchant/store.guard";
import { newOrderToken, orderItemRows, orderTotalLines, readOrderVariants } from "../orders/place-order";
import { returnOrderStock, takeOrderStock, tracksStock } from "../stock/stock";

// Selling in the shop (design/screens.md P1–P4): a sale at the counter is an
// order with channel "in_store", completed the moment it's made, inside the
// seller's own withContext. Every amount is worked out here from the catalog
// — never taken from the phone — and a sale never sends a Telegram alert.

export interface RecordedSale {
  id: string;
  orderNumber: number;
  currency: Currency;
  totalMinor: number;
  /** Cash: what to hand back. */
  changeMinor: number | null;
  /** false = this sale's key had already made it; this is it again. */
  created: boolean;
}

const recordedSaleSelect = { id: true, orderNumber: true, currency: true, totalMinor: true, changeMinor: true } satisfies Prisma.OrderSelect;

/** The cash amounts to save with a sale, or the field error when the buyer gave too little. */
export function counterCashAmounts(payment: CounterSaleInput["payment"], total: number): { cashReceivedMinor: number | null; changeMinor: number | null } {
  if (payment.method !== "cash") return { cashReceivedMinor: null, changeMinor: null };
  const change = cashChange(total, payment.receivedMinor);
  if (change === null) throw new InvalidInputException({ "payment.receivedMinor": "cash_short" });
  return { cashReceivedMinor: payment.receivedMinor, changeMinor: change };
}

/** Rings up one sale. The same key twice gives back the first sale, never a second one. */
export async function recordCounterSale(tx: Tx, context: MerchantStore, input: CounterSaleInput, plan: PlanId): Promise<RecordedSale> {
  const { storeId, merchantId } = context;
  const existing = await tx.order.findFirst({ where: { storeId, idempotencyKey: input.idempotencyKey }, select: recordedSaleSelect });
  if (existing) return { ...existing, created: false };

  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { usdToKhrRate: true, vatPercent: true, area: true } });
  const { byId, missing } = await readOrderVariants(tx, input.lines);
  if (Object.keys(missing).length > 0) throw new InvalidInputException(missing);

  const total: OrderTotal = computeOrderTotal({
    lines: orderTotalLines(input.lines, byId),
    currency: input.currency,
    usdToKhrRate: store.usdToKhrRate,
    vatPercent: store.vatPercent,
    deliveryFee: null,
  });
  const cash = counterCashAmounts(input.payment, total.total);

  // A buyer who gave their phone joins the shop's customers, as at online checkout.
  const customer = input.buyerPhone
    ? await tx.customer.upsert({
        where: { storeId_phone: { storeId, phone: input.buyerPhone } },
        create: { storeId, phone: input.buyerPhone, name: input.buyerName },
        update: input.buyerName ? { name: input.buyerName } : {},
        select: { id: true },
      })
    : null;
  // The shop's next order number: one counter for online orders and counter sales alike.
  const { lastOrderNumber } = await tx.store.update({ where: { id: storeId }, data: { lastOrderNumber: { increment: 1 } }, select: { lastOrderNumber: true } });

  const order = await tx.order.create({
    data: {
      storeId,
      customerId: customer?.id ?? null,
      orderNumber: lastOrderNumber,
      channel: "in_store",
      publicToken: newOrderToken(),
      status: "completed",
      paymentMethod: input.payment.method,
      currency: input.currency,
      subtotalMinor: total.subtotal,
      discountMinor: total.discount,
      deliveryFeeMinor: 0,
      vatPercent: store.vatPercent,
      vatMinor: total.vat,
      totalMinor: total.total,
      exchangeRateUsed: store.usdToKhrRate,
      fulfilment: "in_store",
      area: store.area,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      ...cash,
      soldByMerchantId: merchantId,
      idempotencyKey: input.idempotencyKey,
    },
    select: recordedSaleSelect,
  });
  await tx.orderItem.createMany({ data: orderItemRows(storeId, order.id, total, byId) });
  // Pro and Advance: the sale takes its stock; too little left refuses it, as online.
  if (tracksStock(plan)) await takeOrderStock(tx, order.id, input.lines.map((line) => line.variantId));
  await tx.orderStatusEvent.createMany({ data: [{ storeId, orderId: order.id, status: "completed", actor: "merchant", actorMerchantId: merchantId }] });
  await writeAudit(tx, merchantActor(context), { action: "counter.sale_recorded", entity: "order", entityId: order.id });
  return { ...order, created: true };
}

/** Undoes a sale at the counter (the seller hands the money back). Only a completed counter sale of this shop. */
export async function voidCounterSale(tx: Tx, context: MerchantStore, orderId: string): Promise<void> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, storeId: context.storeId, channel: "in_store", status: "completed" },
    data: { status: "cancelled", cancelReason: "counter_void" },
  });
  if (count === 0) throw new AppException(409, "action_not_allowed");
  await returnOrderStock(tx, orderId);
  await tx.orderStatusEvent.createMany({ data: [{ storeId: context.storeId, orderId, status: "cancelled", actor: "merchant", actorMerchantId: context.merchantId }] });
  await writeAudit(tx, merchantActor(context), { action: "counter.sale_voided", entity: "order", entityId: orderId });
}

export const counterSaleRowSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentMethod: true,
  currency: true,
  totalMinor: true,
  buyerName: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;
type CounterSaleRow = Prisma.OrderGetPayload<{ select: typeof counterSaleRowSelect }>;

/** Amounts per currency, never added across currencies. */
type Sums = Record<Currency, number>;

/**
 * Today's sales at the counter (design/screens.md P4) with their totals: all,
 * cash and shop QR, each per currency. Voided sales are listed but not counted.
 */
export function toCounterDay(rows: CounterSaleRow[]) {
  const counted = rows.filter((row) => row.status !== "cancelled");
  const sum = (method?: "cash" | "shop_qr") => {
    const sums: Sums = { USD: 0, KHR: 0 };
    for (const row of counted) if (!method || row.paymentMethod === method) sums[row.currency] += row.totalMinor;
    return { count: counted.filter((row) => !method || row.paymentMethod === method).length, ...sums };
  };
  return {
    sales: rows.map(({ _count, createdAt, ...row }) => ({ ...row, createdAt: createdAt.toISOString(), lineCount: _count.items, voided: row.status === "cancelled" })),
    totals: { all: sum(), cash: sum("cash"), shopQr: sum("shop_qr") },
  };
}

export async function readCounterDay(tx: Tx, storeId: string, now = new Date()) {
  const rows = await tx.order.findMany({
    where: { storeId, channel: "in_store", createdAt: { gte: startOfPhnomPenhDay(now) } },
    orderBy: { createdAt: "desc" },
    select: counterSaleRowSelect,
  });
  return toCounterDay(rows);
}

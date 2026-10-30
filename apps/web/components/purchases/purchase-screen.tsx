"use client";

import { Button, Card, ConfirmDialog, DetailList, Notice, SegmentedControl, StatusPill } from "@khmio/ui";
import { Clock3, ListChecks, PackageCheck, Truck, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { PrintLink } from "@/components/paper/print-link";
import { SubPage } from "@/components/seller-frame/sub-page";
import { itemName } from "@/components/stock/item-name";
import { useDateText } from "@/components/use-date-text";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema } from "@/lib/api";
import { BillPayments } from "./bill-payments";
import { BillStatusCard } from "./bill-status-card";
import { PaymentSheet } from "./payment-sheet";
import { ReturnSheet } from "./return-sheet";
import { usePurchaseText } from "./use-purchase-text";

type BillTab = "items" | "payments" | "receiving" | "returns";

/**
 * One bill or return (design/screens.md S13 "Bill"). On top, the bill's two
 * answers — goods arrived? paid? — with a bar of how much is paid and what's
 * left (BillStatusCard), and its details beside it; the main buttons
 * (Print, Received, Record payment, Send back) in the header. Then tabs: Items ·
 * Payments (a timeline, what was left after each) · Receiving (when and by
 * whom, or "Received") · Returns. Saved before its goods arrived, Received
 * puts them in stock; only then can goods go back. Never edited: what's
 * wrong goes back with "Send back to supplier"; a payment made by mistake is
 * voided.
 */
export function PurchaseScreen({
  purchase: initial,
  writable,
  hrefFor,
  printHrefFor,
  voucherHrefFor,
  back,
}: {
  purchase: PurchaseDetail;
  /** A plan that follows stock: goods can be sent back and the bill paid. */
  writable: boolean;
  hrefFor: (id: string) => string;
  /** A bill's or a return's print page. */
  printHrefFor: (id: string) => string;
  /** A payment voucher's print page. */
  voucherHrefFor: (paymentId: string) => string;
  back: { href: string; label: string };
}) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const { title, total, billDay } = usePurchaseText();
  const { dateTime } = useDateText();
  const [purchase, setPurchase] = useState(initial);
  const [tab, setTab] = useState<BillTab>("items");
  const [returning, setReturning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmingReceive, setConfirmingReceive] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const isReturn = purchase.kind === "return";
  const received = purchase.receivedAt !== null;
  const payment = purchase.payment;
  const canReceive = writable && !received;
  const canPay = writable && payment !== null && payment.owed > 0;
  const canSendBack = writable && !isReturn && received && purchase.lines.some((line) => line.returnable > 0);
  const nameOf = (line: PurchaseDetail["lines"][number]) => itemName(locale, line);
  const money = (amount: number) => formatMoney(amount, purchase.currency);

  async function receive() {
    setReceiving(true);
    setProblem(null);
    try {
      setPurchase(await api(`/purchases/${purchase.id}/receive`, purchaseDetailSchema, { method: "POST" }));
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setReceiving(false);
    }
  }

  const receiveButton = (
    <Button variant="primary" loading={receiving} onClick={() => setConfirmingReceive(true)}>
      <PackageCheck className="h-4 w-4" aria-hidden="true" />
      {t("receiveButton")}
    </Button>
  );

  const tabs: { value: BillTab; label: string; icon: typeof Wallet; badge?: { value: number; tone: "warning" | "muted" } }[] = isReturn
    ? []
    : [
        { value: "items", label: t("tabItems"), icon: ListChecks, badge: { value: purchase.lineCount, tone: "muted" } },
        { value: "payments", label: t("tabPayments"), icon: Wallet, badge: { value: purchase.payments.filter((entry) => !entry.voided).length, tone: "muted" } },
        { value: "receiving", label: t("tabReceiving"), icon: Truck, ...(received ? {} : { badge: { value: 1, tone: "warning" } }) },
        { value: "returns", label: t("tabReturns"), icon: Undo2, badge: { value: purchase.returnedBy.length, tone: "muted" } },
      ];
  const shown: BillTab = isReturn ? "items" : tab;

  return (
    <SubPage
      width="page"
      back={back}
      title={title(purchase)}
      description={[purchase.supplierName || t("noSupplier"), billDay(purchase.purchasedOn)].join(" · ")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PrintLink href={printHrefFor(purchase.id)} label={t("printButton")} />
          {canSendBack && (
            <Button variant="secondary" onClick={() => setReturning(true)}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              {t("sendBack")}
            </Button>
          )}
          {canPay && (
            <Button variant={canReceive ? "secondary" : "primary"} onClick={() => setPaying(true)}>
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {t("recordPayment")}
            </Button>
          )}
          {canReceive && receiveButton}
        </div>
      }
    >
      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {isReturn ? (
          <Card className="flex flex-col gap-1 p-4 md:p-5">
            <StatusPill tone="warning" className="self-start">
              {t("kind_return")}
            </StatusPill>
            <p className="text-2xl font-bold tabular-nums">{total(purchase)}</p>
            <p className="text-sm text-muted">{t("returnRecordHint")}</p>
          </Card>
        ) : (
          <BillStatusCard purchase={purchase} />
        )}
        <Card className="p-4">
          <DetailList
            items={[
              { label: t("colSupplier"), value: purchase.supplierName || t("noSupplier") },
              ...(purchase.billRef ? [{ label: t("billRefLabel"), value: purchase.billRef }] : []),
              ...(purchase.returnsId && purchase.returnsNumber !== null
                ? [{ label: t("returnOfLabel"), value: <Link className="font-medium text-primary underline" href={hrefFor(purchase.returnsId)}>{title({ kind: "purchase", number: purchase.returnsNumber })}</Link> }]
                : []),
              { label: t("total"), value: total(purchase) },
              ...(purchase.exchangeRateUsed !== null ? [{ label: t("rateUsedLabel"), value: t("rateUsed", { rate: purchase.exchangeRateUsed.toLocaleString("en-US") }) }] : []),
              ...(purchase.note ? [{ label: t("noteLabel"), value: purchase.note }] : []),
            ]}
          />
        </Card>
      </div>

      {tabs.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <SegmentedControl look="underline" size="sm" label={title(purchase)} value={tab} onChange={setTab} options={tabs} />
        </div>
      )}

      {shown === "items" && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg">
          {purchase.lines.map((line) => (
            <li key={line.variantId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nameOf(line)}</p>
                <p className="truncate text-xs text-muted">
                  {[
                    line.sku,
                    t("lineMath", { quantity: line.quantity, cost: money(line.unitCostMinor) }),
                    // Kept in the other currency: what one was turned into at the bill's rate.
                    ...(line.itemCostMinor !== null && line.itemCostCurrency && line.itemCostCurrency !== purchase.currency ? [t("turnedEach", { amount: formatMoney(line.itemCostMinor, line.itemCostCurrency) })] : []),
                    ...(!isReturn && line.returnable < line.quantity ? [t("sentBackCount", { count: line.quantity - line.returnable })] : []),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(line.lineTotalMinor)}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 bg-border/10 p-3">
            <span className="font-semibold">{t("total")}</span>
            <span className="text-lg font-semibold tabular-nums">{total(purchase)}</span>
          </li>
        </ul>
      )}

      {shown === "payments" && <BillPayments purchase={purchase} writable={writable} voucherHrefFor={voucherHrefFor} onPay={() => setPaying(true)} onChanged={setPurchase} />}

      {shown === "receiving" && (
        <Card className="flex flex-col gap-3 p-4">
          {received && purchase.receivedAt ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-success">
                <PackageCheck className="h-5 w-5" aria-hidden="true" />
                {t("goodsReceived")}
              </p>
              <DetailList
                items={[
                  { label: t("receivedLabel"), value: dateTime(purchase.receivedAt) },
                  ...(purchase.receivedByName ? [{ label: t("receivedByLabel"), value: purchase.receivedByName }] : []),
                  { label: t("receivedStockLabel"), value: t("receivedStock", { count: purchase.lines.reduce((sum, line) => sum + line.quantity, 0) }) },
                ]}
              />
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold text-warning">
                <Clock3 className="h-5 w-5" aria-hidden="true" />
                {t("goodsWaiting")}
              </p>
              <p className="text-sm text-muted">{t("notReceivedHint")}</p>
              {canReceive && <div>{receiveButton}</div>}
            </>
          )}
        </Card>
      )}

      {shown === "returns" && (
        <section className="flex flex-col gap-3">
          {purchase.returnedBy.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">{t(received ? "noReturnsYet" : "returnsAfterReceiving")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg">
              {purchase.returnedBy.map((entry) => (
                <li key={entry.id} className="flex items-center gap-1 pr-1">
                  <Link href={hrefFor(entry.id)} className="flex min-h-touch min-w-0 flex-1 items-center justify-between gap-3 p-3 hover:bg-border/20">
                    <span className="font-medium">
                      {title({ kind: "return", number: entry.number })} · <span className="text-muted">{billDay(entry.purchasedOn)}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">−{money(entry.totalMinor)}</span>
                  </Link>
                  <PrintLink iconOnly href={printHrefFor(entry.id)} label={t("printReturn", { code: title({ kind: "return", number: entry.number }) })} />
                </li>
              ))}
            </ul>
          )}
          {canSendBack && (
            <Button variant="secondary" className="self-start" onClick={() => setReturning(true)}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              {t("sendBack")}
            </Button>
          )}
        </section>
      )}

      {/* Stock goes up and can't be taken back by undoing: one tap isn't enough. */}
      <ConfirmDialog
        open={confirmingReceive}
        title={t("receiveConfirm")}
        body={t("receiveConfirmHint", { count: purchase.lineCount })}
        confirmLabel={t("receiveButton")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          setConfirmingReceive(false);
          void receive();
        }}
        onClose={() => setConfirmingReceive(false)}
      />
      {paying && <PaymentSheet purchase={purchase} onClose={() => setPaying(false)} onSaved={setPurchase} />}
      {returning && <ReturnSheet purchase={purchase} nameOf={nameOf} onClose={() => setReturning(false)} onSaved={setPurchase} />}
    </SubPage>
  );
}

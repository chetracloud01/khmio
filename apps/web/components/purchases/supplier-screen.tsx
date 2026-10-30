"use client";

import { formatKhmerPhoneLocal, type Currency, type ListPage, type ListQuery } from "@khmio/shared";
import { Button, buttonVariants, Card, Notice, SectionTitle, StatusPill } from "@khmio/ui";
import { CalendarClock, HandCoins, Pencil, Plus, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CallButton } from "@/components/call-button";
import { DetailStats } from "@/components/detail-stats";
import { formatMoney } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { api, ApiError, type PurchaseRow, type Supplier, supplierSchema } from "@/lib/api";
import { PurchasesScreen } from "./purchases-screen";
import { SupplierSheet } from "./supplier-sheet";
import { useBillRowActions } from "./bill-row-actions";
import { usePurchaseText } from "./use-purchase-text";

const CURRENCIES = ["USD", "KHR"] as const;

/**
 * One supplier (design/screens.md S13 "Supplier"), the detail behind a
 * Suppliers row: how to reach them, what was bought from them, what the shop
 * still owes them and their last bill, then their bills in the same list as
 * Purchases — each row with Pay and Receive, after which the figures read
 * again. Edit, archive or use again; a new bill starts with them chosen.
 */
export function SupplierScreen({
  supplier: initial,
  writable,
  loadBills,
  billHref,
  newBillHref,
  back,
}: {
  supplier: Supplier;
  writable: boolean;
  /** Their bills, page by page (the purchase list with this supplier fixed). */
  loadBills: (query: ListQuery) => Promise<ListPage<PurchaseRow>>;
  billHref: (purchase: PurchaseRow) => string;
  newBillHref: string;
  back: { href: string; label: string };
}) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const { billDay } = usePurchaseText();
  const [supplier, setSupplier] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Bumped after a payment or a receipt: the bills read again, and the supplier's figures with them.
  const [reloadKey, setReloadKey] = useState(0);
  const bills = useBillRowActions(() => {
    setReloadKey((key) => key + 1);
    api(`/suppliers/${supplier.id}`, supplierSchema).then(setSupplier, () => undefined);
  });
  const amounts = (sums: Record<Currency, number>) => CURRENCIES.filter((currency) => sums[currency] !== 0).map((currency) => formatMoney(sums[currency], currency));
  const bought = amounts(supplier.bought);
  const owed = amounts(supplier.owed);
  // A save answers with the supplier alone: what was bought from them stays as the page read it.
  const saved = (next: Supplier) => setSupplier((current) => ({ ...next, bought: current.bought, owed: current.owed, lastBillOn: current.lastBillOn }));

  async function setArchived(archived: boolean) {
    setProblem(null);
    try {
      saved(await api(`/suppliers/${supplier.id}/archive`, supplierSchema, { method: "PATCH", body: { archived } }));
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  return (
    <SubPage
      width="page"
      back={back}
      title={supplier.name}
      description={supplier.phone ? formatKhmerPhoneLocal(supplier.phone) : undefined}
      actions={
        <>
          {supplier.phone && <CallButton phone={supplier.phone} label={t("callSupplier", { name: supplier.name })} />}
          {writable && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t("edit")}
              </Button>
              <Button variant="ghost" onClick={() => void setArchived(!supplier.archived)}>
                {t(supplier.archived ? "restore" : "archive")}
              </Button>
              {!supplier.archived && (
                <Link href={newBillHref} className={buttonVariants({ variant: "primary" })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("newBill")}
                </Link>
              )}
            </>
          )}
        </>
      }
    >
      {supplier.archived && <StatusPill tone="muted">{t("chip_archived")}</StatusPill>}
      {(problem ?? bills.problem) && (
        <Notice tone="danger" role="alert">
          {problem ?? bills.problem}
        </Notice>
      )}
      <DetailStats
        stats={[
          { icon: Wallet, label: t("colBought"), value: bought[0] ?? "—", detail: bought.slice(1).join(" · ") || undefined },
          { icon: HandCoins, label: t("colOwed"), value: owed[0] ?? "—", detail: owed.slice(1).join(" · ") || undefined },
          { icon: ReceiptText, label: t("colBills"), value: String(supplier.purchaseCount) },
          { icon: CalendarClock, label: t("colLastBill"), value: supplier.lastBillOn ? billDay(supplier.lastBillOn) : "—" },
        ]}
      />
      {supplier.note && (
        <Card className="p-4">
          <p className="text-sm">{supplier.note}</p>
        </Card>
      )}
      {/* "Pay" on a Suppliers row lands here (#bills). */}
      <section id="bills" className="flex scroll-mt-20 flex-col gap-3">
        <SectionTitle>{t("billsTitle")}</SectionTitle>
        <PurchasesScreen
          forSupplier
          server={{ load: loadBills, reloadKey }}
          suppliers={[]}
          totals={null}
          owed={null}
          hrefFor={billHref}
          onPay={writable ? bills.onPay : undefined}
          onReceive={writable ? bills.onReceive : undefined}
        />
      </section>
      {bills.dialogs}
      {editing && <SupplierSheet supplier={supplier} onClose={() => setEditing(false)} onSaved={saved} />}
    </SubPage>
  );
}

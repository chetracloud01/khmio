"use client";

import { formatDocumentNumber, stockMovementSign } from "@khmio/shared";
import { BottomSheet, Button, OptionChips, SectionTitle } from "@khmio/ui";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import type { StockPage } from "@/lib/api";

type Movement = StockPage["movements"][number];
/** What kind of change a movement was: the "See all" sheet's first filter. */
type Kind = "opening" | "bought" | "sold" | "up" | "down" | "sentBack";
const KINDS: readonly Kind[] = ["opening", "bought", "sold", "up", "down", "sentBack"];

const kindOf = (movement: Movement): Kind => {
  if (movement.reason === "opening_stock") return "opening";
  if (movement.reason === "supplier_return") return "sentBack";
  if (movement.type === "purchase") return "bought";
  if (movement.type === "sale") return "sold";
  return stockMovementSign(movement.type) === 1 ? "up" : "down";
};

/**
 * The latest stock changes, newest first: what changed, why, when, and by how
 * many (design/screens.md S13). With `preview`, a slim card of the newest few
 * (the Stock list's top strip), and "See all" opens the rest in a sheet; an
 * item's page shows them all.
 */
export function StockHistory({ movements, nameOf, preview }: { movements: Movement[]; nameOf: (variantId: string) => string; /** Show only this many, with "See all". */ preview?: number }) {
  const t = useTranslations("Stock");
  const { clockTime, date } = useDateText();
  const [all, setAll] = useState(false);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [reason, setReason] = useState<string>("all");

  /** What a change was, as a sentence: a sale and its order, a buyer's return, a bill with its cost and supplier, goods sent back, opening stock, or went up / down and why. */
  const what = (movement: Movement): string => {
    if (movement.type === "sale") return t(movement.inStore ? "saleInShop" : "saleOnline", { number: movement.orderNumber ?? 0 });
    if (movement.reason === "returned" && movement.orderNumber !== null) return t("returnedFrom", { number: movement.orderNumber });
    if (movement.type === "purchase") {
      const cost = movement.unitCostMinor !== null && movement.costCurrency ? [t("eachCost", { amount: formatMoney(movement.unitCostMinor, movement.costCurrency) })] : [];
      const bill = movement.purchaseNumber !== null ? [formatDocumentNumber("bill", movement.purchaseNumber)] : [];
      // Turned from the bill's other currency: say at what rate.
      const turned = movement.billCurrency && movement.billRate !== null && movement.costCurrency && movement.billCurrency !== movement.costCurrency ? [t("turnedFromBill", { rate: movement.billRate.toLocaleString("en-US") })] : [];
      return [t("typePurchase"), ...bill, ...cost, ...turned, ...(movement.supplier ? [movement.supplier] : [])].join(" · ");
    }
    if (movement.reason === "supplier_return") {
      const bill = movement.purchaseNumber !== null ? [formatDocumentNumber("return", movement.purchaseNumber)] : [];
      return [t("reason_supplier_return"), ...bill, ...(movement.supplier ? [movement.supplier] : [])].join(" · ");
    }
    if (movement.reason === "opening_stock") {
      const cost = movement.unitCostMinor !== null && movement.costCurrency ? [t("eachCost", { amount: formatMoney(movement.unitCostMinor, movement.costCurrency) })] : [];
      return [t("typeOpening"), ...cost].join(" · ");
    }
    const direction = kindOf(movement) === "up" ? t("typeUp") : t("typeDown");
    return `${direction}${movement.reason ? ` · ${t(`reason_${movement.reason}`)}` : ""}`;
  };

  // The "See all" sheet's filters: what kind of change, then (for went up / down) why — each with how many there are.
  const ofKind = kind === "all" ? movements : movements.filter((movement) => kindOf(movement) === kind);
  const reasons = [...new Set(ofKind.flatMap((movement) => (movement.reason && (kind === "up" || kind === "down") ? [movement.reason] : [])))];
  const filtered = reason === "all" ? ofKind : ofKind.filter((movement) => movement.reason === reason);
  const filters = (
    <div className="flex flex-col gap-2 pb-3">
      <OptionChips
        label={t("historyKind")}
        mode="one"
        value={[kind]}
        onChange={([next]) => {
          setKind(KINDS.find((entry) => entry === next) ?? "all");
          setReason("all");
        }}
        options={[
          { value: "all", label: t("historyAll"), detail: String(movements.length) },
          ...KINDS.flatMap((entry) => {
            const count = movements.filter((movement) => kindOf(movement) === entry).length;
            return count > 0 ? [{ value: entry, label: t(`historyKind_${entry}`), detail: String(count) }] : [];
          }),
        ]}
      />
      {reasons.length > 1 && (
        <OptionChips
          label={t("reasonLabel")}
          mode="one"
          value={[reason]}
          onChange={([next]) => setReason(next ?? "all")}
          options={[{ value: "all", label: t("historyAllReasons") }, ...reasons.map((entry) => ({ value: entry, label: t(`reason_${entry}`), detail: String(ofKind.filter((movement) => movement.reason === entry).length) }))]}
        />
      )}
    </div>
  );

  const list = (shown: Movement[], compact = false) => (
    <ul className={compact ? "flex flex-col divide-y divide-border" : "flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg"}>
      {shown.map((movement) => {
        const adds = stockMovementSign(movement.type) === 1;
        return (
          <li key={movement.id} className={compact ? "flex items-center gap-3 px-1 py-2" : "flex items-center gap-3 p-3"}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{nameOf(movement.variantId)}</span>
              <span className="block truncate text-xs text-muted">
                {what(movement)} · {date(movement.createdAt)} {clockTime(movement.createdAt)}
                {movement.note && ` · ${movement.note}`}
              </span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${adds ? "text-success" : "text-danger"}`}>
              {adds ? "+" : "−"}
              {movement.quantity}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (preview !== undefined) {
    return (
      <section className="flex flex-col rounded-2xl border border-border bg-bg px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>{t("recentActivity")}</SectionTitle>
          {movements.length > preview && (
            <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
              <History className="h-4 w-4" aria-hidden="true" />
              {t("seeAllActivity", { count: movements.length })}
            </Button>
          )}
        </div>
        {movements.length === 0 ? <p className="py-2 text-sm text-muted">{t("noActivityYet")}</p> : list(movements.slice(0, preview), true)}
        <BottomSheet open={all} onClose={() => setAll(false)} closeLabel={t("cancel")} title={t("recentActivity")} placement="side">
          {filters}
          {filtered.length === 0 ? <p className="py-2 text-sm text-muted">{t("noActivityYet")}</p> : list(filtered, true)}
        </BottomSheet>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{t("recentActivity")}</SectionTitle>
      {movements.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">{t("noActivityYet")}</p> : list(movements)}
    </section>
  );
}

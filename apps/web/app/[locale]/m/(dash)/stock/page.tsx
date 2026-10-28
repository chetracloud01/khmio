"use client";

import {
  getMinimumPlanFor,
  MAX_STOCK_NOTE_LENGTH,
  MAX_SUPPLIER_LENGTH,
  parseKhrInput,
  parseQuantityInput,
  parseUsdInput,
  stockAdjustmentReasonSchema,
  stockMovementSign,
  type Currency,
  type FormErrorCode,
  type StockAdjustmentReason,
} from "@khmio/shared";
import { BottomSheet, Button, ConfirmDialog, EmptyState, Input, Notice, SearchInput, SegmentedControl, Select, StatCard, StatusPill } from "@khmio/ui";
import { ChevronRight, Coins, PackageOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney } from "@/components/order-ui";
import { CostCurrencyChoice } from "@/components/product-form/price-inputs";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useDateText } from "@/components/use-date-text";
import { api, ApiError, type StockPage, stockPageSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";

type Item = StockPage["items"][number];
type Mode = "purchase" | "correct";

// Stock (design/screens.md S13), roadmap Pro plan: every product option with
// its count at the main branch and its cost, "Not tracked" until the seller
// starts it from a count, stock in (a purchase: its cost moves the average
// cost, docs/blueprint.md "Cost price", level 2) and corrections with their
// reason, what the stock is worth, and the latest changes.
// Orders and counter sales take stock themselves. Lower plans see their
// counts, locked.
export default function StockPage() {
  const t = useTranslations("Stock");
  const tShop = useTranslations("Storefront");
  const locale = useLocale();
  const { clockTime, date } = useDateText();
  const [page, setPage] = useState<StockPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Item | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api("/stock", stockPageSchema).then(setPage, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <PageOffline onRetry={load} />;
  if (!page) return <PageLoading />;

  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const name = (item: Item) => [text(item.titleKm, item.titleEn), text(item.optionKm, item.optionEn)].filter(Boolean).join(" · ");
  const shown = page.items.filter((item) => `${item.titleKm} ${item.titleEn} ${item.optionKm} ${item.optionEn} ${item.sku}`.toLowerCase().includes(query.trim().toLowerCase()));
  const nameOf = new Map(page.items.map((item) => [item.variantId, name(item)]));
  /** A product's one cost currency: its options share it (null = no cost yet). */
  const productCurrency = (item: Item): Currency | null => item.costCurrency ?? page.items.find((other) => other.productId === item.productId && other.costCurrency)?.costCurrency ?? null;
  const worth = (["USD", "KHR"] as const).filter((currency) => page.value[currency] > 0).map((currency) => formatMoney(page.value[currency], currency));

  return (
    <SubPage back={{ href: `/${locale}/m/products`, label: t("backToProducts") }} title={t("title")} description={t("description")} width="page">
      {!page.tracksStock && <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />}

      {page.tracksStock && page.items.some((item) => item.onHand !== null) && (
        <div className="max-w-sm">
          <StatCard
            icon={Coins}
            label={t("stockValueTitle")}
            value={worth[0] ?? formatMoney(0, "USD")}
            detail={[...worth.slice(1), ...(page.value.withoutCost > 0 ? [t("withoutCost", { count: page.value.withoutCost })] : [])].join(" · ") || undefined}
          />
        </div>
      )}

      {page.items.length === 0 ? (
        <EmptyState icon={PackageOpen} title={t("noProductsYet")} />
      ) : (
        <section className="flex flex-col gap-3">
          <SearchInput label={t("searchItems")} placeholder={t("searchItems")} value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} clearLabel={tShop("clearSearch")} />
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
            {shown.map((item) => (
              <li key={item.variantId}>
                <Button variant="ghost" tone="muted" fullWidth disabled={!page.tracksStock} onClick={() => setOpen(item)} className="min-h-[60px] justify-between rounded-none px-3 text-left text-fg">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{name(item)}</span>
                    <span className="block truncate text-xs text-muted">
                      {item.sku}
                      {item.costMinor !== null && item.costCurrency && ` · ${t("costLine", { amount: formatMoney(item.costMinor, item.costCurrency) })}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.onHand === null ? (
                      <span className="text-sm text-muted">{t("notTracked")}</span>
                    ) : (
                      <>
                        {item.low && <StatusPill tone={item.onHand === 0 ? "danger" : "warning"}>{item.onHand === 0 ? t("levelOut") : t("levelLow")}</StatusPill>}
                        <span className="text-lg font-semibold tabular-nums">{item.onHand}</span>
                      </>
                    )}
                    {page.tracksStock && <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("recentActivity")}</h2>
        {page.movements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">{t("noActivityYet")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
            {page.movements.map((movement) => {
              const adds = stockMovementSign(movement.type) === 1;
              const what =
                movement.type === "sale"
                  ? t(movement.inStore ? "saleInShop" : "saleOnline", { number: movement.orderNumber ?? 0 })
                  : movement.reason === "returned" && movement.orderNumber !== null
                    ? t("returnedFrom", { number: movement.orderNumber })
                    : movement.type === "purchase"
                      ? [
                          t("typePurchase"),
                          ...(movement.unitCostMinor !== null && movement.costCurrency ? [t("eachCost", { amount: formatMoney(movement.unitCostMinor, movement.costCurrency) })] : []),
                          ...(movement.supplier ? [movement.supplier] : []),
                        ].join(" · ")
                      : `${t("typeAdjust")}${movement.reason ? ` · ${t(`reason_${movement.reason}`)}` : ""}`;
              return (
                <li key={movement.id} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{nameOf.get(movement.variantId) ?? ""}</span>
                    <span className="block truncate text-xs text-muted">
                      {what} · {date(movement.createdAt)} {clockTime(movement.createdAt)}
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
        )}
      </section>

      {open && <ManageSheet item={open} title={name(open)} costCurrency={productCurrency(open)} onClose={() => setOpen(null)} onSaved={(next) => setPage(next)} />}
    </SubPage>
  );
}

/** How a cost of one is typed in each currency. */
const COST_INPUT = {
  USD: { label: "costOfOneUsd", inputMode: "decimal", parse: parseUsdInput },
  KHR: { label: "costOfOneKhr", inputMode: "numeric", parse: parseKhrInput },
} as const;

/**
 * One option's stock: start tracking it from a count; or record stock in (with
 * its cost and supplier), a correction, or stop tracking. The cost is typed in
 * the product's one cost currency; a product without a cost yet picks it here.
 */
function ManageSheet({
  item,
  title,
  costCurrency,
  onClose,
  onSaved,
}: {
  item: Item;
  title: string;
  costCurrency: Currency | null;
  onClose: () => void;
  onSaved: (page: StockPage) => void;
}) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const tracked = item.onHand !== null;
  const [mode, setMode] = useState<Mode>("purchase");
  const [direction, setDirection] = useState<"adjust_in" | "adjust_out">("adjust_out");
  const [quantity, setQuantity] = useState(tracked ? "" : "0");
  const [reason, setReason] = useState<StockAdjustmentReason | "">("");
  const [note, setNote] = useState("");
  const { store } = useMerchant();
  const [currency, setCurrency] = useState<Currency>(costCurrency ?? store.defaultCurrency);
  const [costText, setCostText] = useState("");
  const [supplier, setSupplier] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);

  async function send(path: string, method: "POST" | "DELETE", body?: object) {
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await api(path, stockPageSchema, { method, body }));
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const amount = parseQuantityInput(quantity);
  const unitCost = COST_INPUT[currency].parse(costText);
  const purchase = mode === "purchase";
  const save = () =>
    tracked
      ? void send("/stock/changes", "POST", {
          variantId: item.variantId,
          type: mode === "purchase" ? "purchase" : direction,
          quantity: amount,
          ...(mode === "correct" && reason ? { reason } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(purchase && unitCost !== undefined ? { unitCost, costCurrency: currency } : {}),
          ...(purchase && supplier.trim() ? { supplier: supplier.trim() } : {}),
        })
      : void send("/stock/track", "POST", { variantId: item.variantId, onHand: amount });

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={title}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={Number.isNaN(amount)} onClick={save}>
          {tracked ? (mode === "purchase" ? t("submitPurchase") : t("submitAdjustment")) : t("startTracking")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {tracked ? (
          <>
            <p className="text-sm">
              {t("onHandNow")} <span className="text-lg font-semibold tabular-nums">{item.onHand}</span>
            </p>
            <SegmentedControl
              mode="choice"
              label={t("changeKind")}
              value={mode}
              onChange={(next) => setMode(next === "correct" ? "correct" : "purchase")}
              options={[
                { value: "purchase", label: t("recordPurchase") },
                { value: "correct", label: t("recordAdjustment") },
              ]}
            />
            {mode === "correct" && (
              <>
                <SegmentedControl
                  mode="choice"
                  label={t("adjustDirectionLabel")}
                  value={direction}
                  onChange={(next) => setDirection(next === "adjust_in" ? "adjust_in" : "adjust_out")}
                  options={[
                    { value: "adjust_out", label: t("adjustRemove") },
                    { value: "adjust_in", label: t("adjustAdd") },
                  ]}
                />
                <Select
                  label={t("reasonLabel")}
                  value={reason}
                  placeholder={t("reasonLabel")}
                  onChange={(event) => {
                    const parsed = stockAdjustmentReasonSchema.safeParse(event.target.value);
                    setReason(parsed.success ? parsed.data : "");
                  }}
                  options={stockAdjustmentReasonSchema.options.map((value) => ({ value, label: t(`reason_${value}`) }))}
                  error={errorText(errors.reason)}
                />
              </>
            )}
            <Input label={t("quantityLabel")} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} error={errorText(errors.quantity)} />
            {purchase && (
              <>
                {/* The product's cost currency is fixed once it has a cost; until then it's picked here. */}
                {!costCurrency && <CostCurrencyChoice value={currency} onChange={setCurrency} />}
                <Input
                  label={t(COST_INPUT[currency].label)}
                  inputMode={COST_INPUT[currency].inputMode}
                  value={costText}
                  onChange={(event) => setCostText(event.target.value)}
                  error={errorText(errors.unitCost) ?? errorText(errors.costCurrency)}
                />
                <p className="-mt-2 text-xs text-muted">{t("costOfOneHint")}</p>
                <Input
                  label={t("supplierLabel")}
                  placeholder={t("supplierPlaceholder")}
                  maxLength={MAX_SUPPLIER_LENGTH}
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                  error={errorText(errors.supplier)}
                />
              </>
            )}
            <Input
              label={mode === "correct" && reason === "other" ? t("noteRequiredLabel") : t("noteLabel")}
              placeholder={t("notePlaceholder")}
              maxLength={MAX_STOCK_NOTE_LENGTH}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={errorText(errors.note)}
            />
            <Button variant="ghost" tone="danger" className="self-start" disabled={busy} onClick={() => setConfirmingStop(true)}>
              {t("stopTracking")}
            </Button>
            <p className="-mt-3 text-xs text-muted">{t("stopTrackingHint")}</p>
            {/* The count is lost (starting again needs a recount), so one tap isn't enough. */}
            <ConfirmDialog
              open={confirmingStop}
              title={t("stopTrackingConfirm")}
              body={t("stopTrackingHint")}
              confirmLabel={t("stopTracking")}
              cancelLabel={t("cancel")}
              danger
              onConfirm={() => {
                setConfirmingStop(false);
                void send(`/stock/track/${item.variantId}`, "DELETE");
              }}
              onClose={() => setConfirmingStop(false)}
            />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t("trackHint")}</p>
            <Input label={t("countNow")} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} error={errorText(errors.onHand)} />
          </>
        )}
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}

"use client";

import {
  getMinimumPlanFor,
  MAX_STOCK_NOTE_LENGTH,
  parseQuantityInput,
  stockAdjustmentReasonSchema,
  stockMovementSign,
  type FormErrorCode,
  type StockAdjustmentReason,
} from "@khmio/shared";
import { BottomSheet, Button, ConfirmDialog, EmptyState, Input, Notice, SearchInput, SegmentedControl, Select, StatusPill } from "@khmio/ui";
import { ChevronRight, PackageOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useDateText } from "@/components/use-date-text";
import { api, ApiError, type StockPage, stockPageSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../page-states";

type Item = StockPage["items"][number];
type Mode = "purchase" | "correct";

// Stock (design/screens.md S13), roadmap Pro plan: every product option with
// its count at the main branch, "Not tracked" until the seller starts it from
// a count, stock in and corrections with their reason, and the latest changes.
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

  return (
    <SubPage back={{ href: `/${locale}/m/products`, label: t("backToProducts") }} title={t("title")} description={t("description")} width="page">
      {!page.tracksStock && <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />}

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
                    <span className="block truncate text-xs text-muted">{item.sku}</span>
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
                      ? t("typePurchase")
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

      {open && <ManageSheet item={open} title={name(open)} onClose={() => setOpen(null)} onSaved={(next) => setPage(next)} />}
    </SubPage>
  );
}

/** One option's stock: start tracking it from a count; or record stock in, a correction, or stop tracking. */
function ManageSheet({ item, title, onClose, onSaved }: { item: Item; title: string; onClose: () => void; onSaved: (page: StockPage) => void }) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const tracked = item.onHand !== null;
  const [mode, setMode] = useState<Mode>("purchase");
  const [direction, setDirection] = useState<"adjust_in" | "adjust_out">("adjust_out");
  const [quantity, setQuantity] = useState(tracked ? "" : "0");
  const [reason, setReason] = useState<StockAdjustmentReason | "">("");
  const [note, setNote] = useState("");
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
  const save = () =>
    tracked
      ? void send("/stock/changes", "POST", {
          variantId: item.variantId,
          type: mode === "purchase" ? "purchase" : direction,
          quantity: amount,
          ...(mode === "correct" && reason ? { reason } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
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

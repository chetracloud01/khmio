"use client";

import { addDays, DUE_DAY_CHOICES, MAX_PURCHASE_NOTE_LENGTH, phnomPenhDay, purchasePaymentMethodSchema, type Currency, type FormErrorCode } from "@khmio/shared";
import { Button, Card, Input, Notice, OptionChips, SectionTitle, SegmentedControl } from "@khmio/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney } from "@/components/order-ui";
import { CostCurrencyChoice } from "@/components/product-form/price-inputs";
import { dueChoiceSchema, dueOnOf, rateOf, type BillDraft } from "./bill-draft";
import { usePaymentMethodOptions } from "./payment-ui";
import { usePurchaseText } from "./use-purchase-text";

type DayChoice = "today" | "yesterday" | "other";

/** What the save buttons need: whether the bill can be saved, and what saving does. */
export interface BillSaving {
  ready: boolean;
  busy: boolean;
  /** Save: asks first whether the goods have arrived. */
  onSave: () => void;
}

/**
 * The New bill's summary (design/screens.md S13 "New bill"): on a laptop a
 * panel beside the items that stays in view; on a phone the last block. The
 * day (Today · Yesterday · another), the currency — and, when an item's
 * cost is kept in the other one, the rate its line is turned at (the shop's
 * unless the invoice says otherwise) — how many items and the
 * total, how it's paid — now (Cash · Bank · KHQR · Other) or on credit (due
 * in 7 · 15 · 30 days, another day, or no day) — a note, and the buttons.
 */
export function BillSummary({
  draft,
  onChange,
  itemCount,
  total,
  needsRate,
  rateBand,
  errors,
  problem,
  saving,
  onCancel,
}: {
  draft: BillDraft;
  onChange: (change: Partial<BillDraft>) => void;
  /** A line's item keeps its cost in the other currency: the bill needs a rate. */
  needsRate: boolean;
  /** The rates the platform allows (the shop's own rate is in it). */
  rateBand: { min: number; max: number };
  itemCount: number;
  total: number;
  errors: Partial<Record<string, FormErrorCode>>;
  problem: string | null;
  saving: BillSaving;
  onCancel: () => void;
}) {
  const t = useTranslations("Purchases");
  const errorText = useFormErrorText();
  const methodOptions = usePaymentMethodOptions();
  const { billDay } = usePurchaseText();
  const today = phnomPenhDay(new Date());
  const yesterday = addDays(today, -1);
  const dayChoice: DayChoice = draft.purchasedOn === today ? "today" : draft.purchasedOn === yesterday ? "yesterday" : "other";
  const dueOn = dueOnOf(draft);
  const money = (amount: number) => formatMoney(amount, draft.currency);

  return (
    <Card className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-2">
        <SectionTitle>{t("dateLabel")}</SectionTitle>
        <OptionChips
          label={t("dateLabel")}
          mode="one"
          value={[dayChoice]}
          onChange={([next]) => {
            if (next === "today") onChange({ purchasedOn: today });
            else if (next === "yesterday") onChange({ purchasedOn: yesterday });
            // "Another day": keep the day for now and show the picker.
            else if (next === "other" && dayChoice !== "other") onChange({ purchasedOn: addDays(yesterday, -1) });
          }}
          options={[
            { value: "today", label: t("dayToday") },
            { value: "yesterday", label: t("dayYesterday") },
            { value: "other", label: t("dayOther") },
          ]}
        />
        {dayChoice === "other" && (
          <Input label={t("dateLabel")} type="date" max={today} value={draft.purchasedOn} onChange={(event) => onChange({ purchasedOn: event.target.value })} error={errorText(errors.purchasedOn)} />
        )}
        {dayChoice !== "other" && <p className="text-xs text-muted">{billDay(draft.purchasedOn)}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <CostCurrencyChoice label={t("currencyLabel")} value={draft.currency} onChange={(currency: Currency) => onChange({ currency })} />
        <p className="text-xs text-muted">{t("currencyHint")}</p>
      </div>

      {needsRate && (
        <div className="flex flex-col gap-1">
          <Input
            label={t("rateLabel")}
            inputMode="numeric"
            prefix="៛"
            value={draft.exchangeRate}
            onChange={(event) => onChange({ exchangeRate: event.target.value })}
            error={rateOf(draft.exchangeRate, rateBand) === null ? errorText("rate_out_of_band") : errorText(errors.exchangeRate)}
          />
          <p className="text-xs text-muted">{t("rateHint", { min: rateBand.min, max: rateBand.max })}</p>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 border-y border-border py-3">
        <span className="text-sm text-muted">{t("lineCount", { count: itemCount })}</span>
        <span className="text-2xl font-semibold tabular-nums">{money(total)}</span>
      </div>

      <div className="flex flex-col gap-3">
        <SegmentedControl
          mode="choice"
          label={t("paymentLabel")}
          value={draft.paidNow ? "now" : "credit"}
          onChange={(next) => onChange({ paidNow: next === "now" })}
          options={[
            { value: "now", label: t("paidNowLabel") },
            { value: "credit", label: t("onCreditLabel") },
          ]}
        />
        {draft.paidNow ? (
          <>
            <OptionChips
              label={t("methodLabel")}
              mode="one"
              value={[draft.method]}
              onChange={([next]) => {
                const method = purchasePaymentMethodSchema.safeParse(next);
                if (method.success) onChange({ method: method.data });
              }}
              options={methodOptions}
            />
            <p className="text-xs text-muted">{t("paidNowOn", { amount: money(total) })}</p>
          </>
        ) : (
          <>
            <OptionChips
              label={t("dueOnLabel")}
              mode="one"
              value={[String(draft.dueChoice)]}
              onChange={([next]) => {
                const choice = dueChoiceSchema.safeParse(next === "none" || next === "other" ? next : Number(next));
                if (choice.success) onChange({ dueChoice: choice.data, ...(choice.data === "other" && !draft.dueOn ? { dueOn: addDays(draft.purchasedOn, 30) } : {}) });
              }}
              options={[
                { value: "none", label: t("dueNone") },
                ...DUE_DAY_CHOICES.map((days) => ({ value: String(days), label: t("dueInDays", { count: days }) })),
                { value: "other", label: t("dayOther") },
              ]}
            />
            {draft.dueChoice === "other" && <Input label={t("dueOnLabel")} type="date" min={draft.purchasedOn} value={draft.dueOn} onChange={(event) => onChange({ dueOn: event.target.value })} error={errorText(errors.dueOn)} />}
            <p className="text-xs text-muted">{dueOn ? t("dueOnText", { day: billDay(dueOn) }) : t("paidNowOff")}</p>
          </>
        )}
      </div>

      <Input label={t("noteLabel")} placeholder={t("notePlaceholder")} maxLength={MAX_PURCHASE_NOTE_LENGTH} value={draft.note} onChange={(event) => onChange({ note: event.target.value })} error={errorText(errors.note)} />

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      <div className="flex flex-col items-stretch gap-1 border-t border-border pt-4">
        <Button variant="primary" fullWidth className="h-12 text-base shadow-raised" loading={saving.busy} disabled={!saving.ready} onClick={saving.onSave}>
          <Check className="h-5 w-5" aria-hidden="true" />
          {t("saveBill")}
        </Button>
        <Button variant="ghost" size="sm" className="self-center text-muted" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("saveHint")}</p>
    </Card>
  );
}

/** A phone's bar above the bottom menu: how many items, the total, and Save — always in reach. */
export function BillSaveBar({ itemCount, total, currency, saving }: { itemCount: number; total: number; currency: Currency; saving: BillSaving }) {
  const t = useTranslations("Purchases");
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-bg/95 px-4 py-2 shadow-raised backdrop-blur md:bottom-0 lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="min-w-0 text-sm">
          <span className="text-muted">{t("lineCount", { count: itemCount })} · </span>
          <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </p>
        <Button variant="primary" className="shrink-0 shadow-raised" loading={saving.busy} disabled={!saving.ready} onClick={saving.onSave}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("saveBill")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { canAddMore, computeOrderTotal, extraPriceIn, MAX_ITEM_NOTE_LENGTH, type BuyerStockState, type Currency } from "@khmio/shared";
import { Button, Input, OptionChips } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatMoney } from "@/components/order-ui";
import type { Product } from "@/lib/api";
import { QuantityStepper } from "./quantity-control";
import { StockNote, type StockLabels } from "./stock-note";

export interface PickedItem {
  variantId: string;
  choiceIds: string[];
  note: string;
  quantity: number;
}

/**
 * Picking one item to add (design/screens.md B3 with Features › options and
 * choices): a value of each variant group (Size, Colour) finds the variant;
 * choice groups ("pick one" or "pick any", some required) add their extra
 * prices; a note and how many. The shop's product sheet and Sell in shop use
 * it alike. A product with options but no groups (made before groups) shows
 * its options as one group.
 */
export function ItemPicker({
  product,
  currency,
  usdToKhrRate,
  stockOf,
  inCartOf,
  stockLabels,
  onAdd,
}: {
  product: Product;
  currency: Currency;
  usdToKhrRate: number;
  stockOf: (variantId: string) => BuyerStockState;
  /** How many of a variant are already in the cart or sale (stock counts them together). */
  inCartOf: (variantId: string) => number;
  stockLabels: StockLabels;
  onAdd: (item: PickedItem) => void;
}) {
  const t = useTranslations("Storefront");
  const locale = useLocale();
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const grouped = product.variantGroups.length > 0;
  const first = product.variants[0];
  // One value per variant group, or (no groups) the variant itself.
  const [values, setValues] = useState<string[]>(grouped ? (first?.valueIds ?? []) : first ? [first.id] : []);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);

  const variant = grouped ? product.variants.find((entry) => entry.valueIds.join("|") === values.join("|")) : product.variants.find((entry) => entry.id === values[0]);
  const choiceIds = product.choiceGroups.flatMap((group) => choices[group.id] ?? []);
  const missing = product.choiceGroups.filter((group) => group.required && !(choices[group.id]?.length));
  const stock = variant ? stockOf(variant.id) : null;
  const fits = stock !== null && canAddMore(stock, (variant ? inCartOf(variant.id) : 0) + quantity - 1);
  const unitPrice = variant
    ? computeOrderTotal({
        lines: [
          {
            key: variant.id,
            quantity: 1,
            priceUsdCents: variant.priceUsdCents,
            priceKhr: variant.priceKhr,
            discountPercent: product.discountPercent,
            extras: product.choiceGroups.flatMap((group) => group.values.filter((value) => choiceIds.includes(value.id)).map((value) => ({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr }))),
          },
        ],
        currency,
        usdToKhrRate,
        vatPercent: 0,
        deliveryFee: null,
      }).total
    : null;
  // The same rule the total uses: the extra in the buyer's currency, converted and rounded on its own.
  const extraText = (value: { extraUsdCents: number | null; extraKhr: number | null }) => {
    const extra = extraPriceIn({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr }, currency, usdToKhrRate);
    return extra > 0 ? `+${formatMoney(extra, currency)}` : undefined;
  };
  /** A value is offered while some variant has it together with the other groups' picks. */
  const valueExists = (groupIndex: number, valueId: string) =>
    product.variants.some((entry) => entry.valueIds[groupIndex] === valueId && entry.valueIds.every((id, at) => at === groupIndex || id === values[at]));

  return (
    <div className="flex flex-col gap-4">
      {grouped
        ? product.variantGroups.map((group, groupIndex) => (
            <section key={group.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{text(group.nameKm, group.nameEn)}</h3>
              <OptionChips
                label={text(group.nameKm, group.nameEn)}
                mode="one"
                value={values[groupIndex] ? [values[groupIndex]] : []}
                onChange={([picked]) => picked && setValues((previous) => previous.map((id, at) => (at === groupIndex ? picked : id)))}
                options={group.values.map((value) => ({ value: value.id, label: text(value.labelKm, value.labelEn), disabled: !valueExists(groupIndex, value.id) }))}
              />
            </section>
          ))
        : product.hasOptions && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("optionHeading")}</h3>
              <OptionChips
                label={t("optionHeading")}
                mode="one"
                value={values}
                onChange={(picked) => setValues(picked)}
                options={product.variants.map((entry) => ({ value: entry.id, label: text(entry.labelKm, entry.labelEn) }))}
              />
            </section>
          )}

      {product.choiceGroups.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {text(group.nameKm, group.nameEn)}
            <span className="text-xs font-normal text-muted">{group.required ? t("choiceRequired") : group.pick === "many" ? t("choiceAny") : t("choiceOptional")}</span>
          </h3>
          <OptionChips
            label={text(group.nameKm, group.nameEn)}
            mode={group.pick}
            value={choices[group.id] ?? []}
            onChange={(picked) => setChoices((previous) => ({ ...previous, [group.id]: picked }))}
            invalid={missing.includes(group)}
            options={group.values.map((value) => ({ value: value.id, label: text(value.labelKm, value.labelEn), detail: extraText(value) }))}
          />
        </section>
      ))}

      <Input label={t("itemNoteLabel")} placeholder={t("itemNotePlaceholder")} maxLength={MAX_ITEM_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} />

      {variant ? stock && <StockNote state={stock} labels={stockLabels} /> : <p className="text-sm text-danger">{t("comboUnavailable")}</p>}

      <div className="flex items-center gap-3">
        <QuantityStepper
          quantity={quantity}
          decreaseLabel={t("decrease", { title: text(product.titleKm, product.titleEn) })}
          increaseLabel={t("increase", { title: text(product.titleKm, product.titleEn) })}
          onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
          onIncrease={() => setQuantity((current) => current + 1)}
          increaseDisabled={!fits}
          className="w-32 shrink-0"
        />
        <Button
          variant="primary"
          className="flex-1"
          disabled={!variant || missing.length > 0 || !fits}
          onClick={() => variant && onAdd({ variantId: variant.id, choiceIds, note: note.trim(), quantity })}
        >
          {unitPrice === null ? t("addToCart") : t("addToCartPrice", { price: formatMoney(unitPrice * quantity, currency) })}
        </Button>
      </div>
    </div>
  );
}

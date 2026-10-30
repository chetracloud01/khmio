"use client";

import { khrInputText, parseKhrInput, parseUsdInput, usdInputText, type Currency, type ProductFormInput } from "@khmio/shared";
import { Input, MoneyInput, SegmentedControl } from "@khmio/ui";
import { useTranslations } from "next-intl";
import type { ProductVariant } from "@/lib/api";

// The product form's prices — retail, wholesale and cost — for a simple
// product and for each option row, from one list: each kind's boxes, the
// schema fields they fill (packages/shared product.ts) and its words.
// Retail and wholesale are typed in dollars and riel side by side; cost is
// one amount in the product's one cost currency (docs/blueprint.md "Cost price").

export type PriceKind = "retail" | "wholesale" | "cost";
type TwoCurrencyKind = Exclude<PriceKind, "cost">;

/** The text typed in each box: retailUsd, retailKhr, …, cost (kept as typed; parsed on save). */
export type PriceTexts = Record<`${TwoCurrencyKind}${"Usd" | "Khr"}` | "cost", string>;

type PriceInput = Pick<ProductFormInput, "retailPriceUsdCents" | "retailPriceKhr" | "wholesalePriceUsdCents" | "wholesalePriceKhr" | "costMinor">;

/** Each two-currency kind's schema fields: the dollar box, the riel box, and the message about both. */
const PRICE_FIELDS = {
  retail: { usd: "retailPriceUsdCents", khr: "retailPriceKhr", both: "retailPrice" },
  wholesale: { usd: "wholesalePriceUsdCents", khr: "wholesalePriceKhr", both: "wholesalePrice" },
} as const satisfies Record<TwoCurrencyKind, { usd: keyof PriceInput; khr: keyof PriceInput; both: string }>;

const COST_FIELD = "costMinor" satisfies keyof PriceInput;

const PRICE_WORDS = {
  retail: { title: "retailPriceTitle", hint: "autoFillNote" },
  wholesale: { title: "wholesalePriceTitle", hint: "wholesaleHint" },
  cost: { title: "costPriceTitle", hint: "costPriceHint" },
} as const;

/** The cost box's label and how its text is read and written, per currency. */
const COST_CURRENCIES = {
  USD: { label: "costAmountUsd", shortLabel: "optionPriceUsd", choice: "costCurrencyUsd", inputMode: "decimal", parse: parseUsdInput, text: usdInputText },
  KHR: { label: "costAmountKhr", shortLabel: "optionPriceKhr", choice: "costCurrencyKhr", inputMode: "numeric", parse: parseKhrInput, text: khrInputText },
} as const;

const CURRENCIES: readonly Currency[] = ["USD", "KHR"];

export const EMPTY_PRICE_TEXTS: PriceTexts = { retailUsd: "", retailKhr: "", wholesaleUsd: "", wholesaleKhr: "", cost: "" };

/** A saved product's cost currency: the one its options' costs are in, else the shop's main currency. */
export function costCurrencyOf(variants: readonly ProductVariant[] | undefined, fallback: Currency): Currency {
  return variants?.find((variant) => variant.costCurrency)?.costCurrency ?? fallback;
}

/** A saved option's prices as box text. */
export function priceTextsOf(variant: ProductVariant | undefined): PriceTexts {
  const costCurrency = variant?.costCurrency;
  return {
    retailUsd: usdInputText(variant?.priceUsdCents),
    retailKhr: khrInputText(variant?.priceKhr),
    wholesaleUsd: usdInputText(variant?.wholesalePriceUsdCents),
    wholesaleKhr: khrInputText(variant?.wholesalePriceKhr),
    cost: costCurrency ? COST_CURRENCIES[costCurrency].text(variant.costMinor) : "",
  };
}

/** Just the price boxes of a row that has more (an option row). */
export function pickPriceTexts(row: PriceTexts): PriceTexts {
  return { retailUsd: row.retailUsd, retailKhr: row.retailKhr, wholesaleUsd: row.wholesaleUsd, wholesaleKhr: row.wholesaleKhr, cost: row.cost };
}

/** The prices as the shared schema takes them; kinds not shown (wholesale on a lower plan) are left out, so the API keeps what was saved. */
export function priceInput(texts: PriceTexts, kinds: readonly PriceKind[], costCurrency: Currency): PriceInput {
  const input: PriceInput = {};
  for (const kind of kinds) {
    if (kind === "cost") {
      input[COST_FIELD] = COST_CURRENCIES[costCurrency].parse(texts.cost);
      continue;
    }
    input[PRICE_FIELDS[kind].usd] = parseUsdInput(texts[`${kind}Usd`]);
    input[PRICE_FIELDS[kind].khr] = parseKhrInput(texts[`${kind}Khr`]);
  }
  return input;
}

/** The fields a price box's message can sit on, for clearing and checking (prefix: "options.2." on an option row). */
function priceFieldKeys(kind: TwoCurrencyKind, prefix = ""): { usd: string; khr: string; both: string } {
  const fields = PRICE_FIELDS[kind];
  return { usd: prefix + fields.usd, khr: prefix + fields.khr, both: prefix + fields.both };
}

/** Dollars or riel for every cost of the product: once for a simple product, once above its option rows. */
export function CostCurrencyChoice({ value, onChange, label }: { value: Currency; onChange: (currency: Currency) => void; /** "Costs in" unless the page says otherwise (a bill: "Bill in"). */ label?: string }) {
  const t = useTranslations("ProductForm");
  return (
    <SegmentedControl
      mode="choice"
      label={label ?? t("costCurrencyLabel")}
      value={value}
      onChange={onChange}
      options={CURRENCIES.map((currency) => ({ value: currency, label: t(COST_CURRENCIES[currency].choice) }))}
      className="self-start"
    />
  );
}

export function PriceInputs({
  texts,
  onChange,
  kinds,
  usdToKhrRate,
  costCurrency,
  onCostCurrencyChange,
  error,
  clearErrors,
  checkFields,
  fieldPrefix = "",
  compact = false,
  costLocked = false,
}: {
  texts: PriceTexts;
  onChange: (box: keyof PriceTexts, text: string) => void;
  /** The kinds shown, in order. */
  kinds: readonly PriceKind[];
  /** Fills retail's other box from the store's rate. */
  usdToKhrRate: number;
  /** The product's cost currency. */
  costCurrency: Currency;
  /** Shows the cost currency choice here (a simple product); option rows share one above them. */
  onCostCurrencyChange?: (currency: Currency) => void;
  error: (key: string) => string | undefined;
  clearErrors: (...keys: string[]) => void;
  /** Re-checks fields when a box is left (the simple product's form). */
  checkFields?: (...keys: string[]) => void;
  fieldPrefix?: string;
  /** An option row: smaller titles, short box labels, no hints. */
  compact?: boolean;
  /** Its stock is tracked: the cost is the average its bills worked out, shown, not typed. */
  costLocked?: boolean;
}) {
  const t = useTranslations("ProductForm");
  return (
    <>
      {kinds.map((kind) => (
        <div key={kind} className="flex flex-col gap-2">
          <p className={compact ? "text-xs font-medium text-muted" : "text-sm font-medium text-fg"}>{t(PRICE_WORDS[kind].title)}</p>
          {kind === "cost" ? (
            <>
              {onCostCurrencyChange && !costLocked && <CostCurrencyChoice value={costCurrency} onChange={onCostCurrencyChange} />}
              <Input
                disabled={costLocked}
                label={t(compact ? COST_CURRENCIES[costCurrency].shortLabel : COST_CURRENCIES[costCurrency].label)}
                inputMode={COST_CURRENCIES[costCurrency].inputMode}
                value={texts.cost}
                onChange={(event) => {
                  onChange("cost", event.target.value);
                  clearErrors(fieldPrefix + COST_FIELD);
                }}
                onBlur={() => checkFields?.(fieldPrefix + COST_FIELD)}
                error={error(fieldPrefix + COST_FIELD)}
              />
            </>
          ) : (
            <TwoCurrencyBoxes kind={kind} {...{ texts, onChange, usdToKhrRate, error, clearErrors, checkFields, fieldPrefix, compact }} />
          )}
          {kind === "cost" && costLocked ? (
            <p className="text-xs text-muted">{t("costFromBills")}</p>
          ) : (
            !compact && <p className="text-xs text-muted">{t(PRICE_WORDS[kind].hint)}</p>
          )}
        </div>
      ))}
    </>
  );
}

function TwoCurrencyBoxes({
  kind,
  texts,
  onChange,
  usdToKhrRate,
  error,
  clearErrors,
  checkFields,
  fieldPrefix,
  compact,
}: {
  kind: TwoCurrencyKind;
  texts: PriceTexts;
  onChange: (box: keyof PriceTexts, text: string) => void;
  usdToKhrRate: number;
  error: (key: string) => string | undefined;
  clearErrors: (...keys: string[]) => void;
  checkFields?: (...keys: string[]) => void;
  fieldPrefix: string;
  compact: boolean;
}) {
  const t = useTranslations("ProductForm");
  const keys = priceFieldKeys(kind, fieldPrefix);
  // A box left re-checks itself and wholesale (it is compared with retail).
  const check = (key: string) => checkFields?.(key, priceFieldKeys("wholesale", fieldPrefix).both);
  return (
    <MoneyInput
      className={compact ? "gap-2" : undefined}
      usd={texts[`${kind}Usd`]}
      khr={texts[`${kind}Khr`]}
      usdLabel={t(compact ? "optionPriceUsd" : "priceUsdLabel")}
      khrLabel={t(compact ? "optionPriceKhr" : "priceKhrLabel")}
      autoFillRate={kind === "retail" ? usdToKhrRate : undefined}
      onUsdChange={(text) => {
        onChange(`${kind}Usd`, text);
        clearErrors(keys.usd, keys.both);
      }}
      onKhrChange={(text) => {
        onChange(`${kind}Khr`, text);
        clearErrors(keys.khr, keys.both);
      }}
      onUsdBlur={() => check(keys.usd)}
      onKhrBlur={() => check(keys.khr)}
      usdError={error(keys.usd) ?? error(keys.both)}
      khrError={error(keys.khr)}
    />
  );
}

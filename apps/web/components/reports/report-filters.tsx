"use client";

import { currencySchema, phnomPenhDay, reportQuerySchema, toFieldErrors, type Currency, type ReportPeriod, type ReportQuery } from "@khmio/shared";
import { Button, Card, Input, SegmentedControl, Switch } from "@khmio/ui";
import { Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { readStored, writeStored } from "@/lib/device-storage";

const PERIODS: readonly ReportPeriod[] = ["today", "week", "month", "all", "custom"];

/** Where this browser keeps "show all in one currency" for the reports (a viewer's own choice). */
const IN_ONE_KEY = "khmio.reportsInOne";

/** A query as an address (its set parts only). */
export const reportSearch = (query: ReportQuery): string => new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString();

/**
 * A report page's period (kept in the address: a refresh or a shared link
 * opens the same days) and "show all in one currency" (kept in this
 * browser). Every report uses it (design/screens.md S17).
 */
export function useReportQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(params.entries()));
  const query: ReportQuery = parsed.success ? parsed.data : { period: "all" };
  const [inOne, setInOne] = useState<Currency | null>(null);
  useEffect(() => setInOne(readStored(IN_ONE_KEY, currencySchema)), []);
  return {
    query,
    /** The query for the API's address. */
    search: reportSearch(query),
    setQuery: (next: ReportQuery) => router.replace(`${pathname}?${reportSearch(next)}`),
    inOne,
    setInOne: (currency: Currency | null) => {
      setInOne(currency);
      writeStored(IN_ONE_KEY, currency);
    },
  };
}

/**
 * A report's filters (design/screens.md S17): Today · 7 days · 30 days · All ·
 * Custom (From → To, in order, not ahead), and "show all in one currency" —
 * a switch, then $ USD / ៛ KHR — at the shop's rate, for reading only. Hidden
 * on paper.
 */
export function ReportFilters({
  query,
  onQuery,
  firstDay,
  inOne,
  onInOne,
  mainCurrency,
  rate,
}: {
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  /** Where Custom starts when it's opened (the report's first day). */
  firstDay?: string;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  /** The shop's riel per $1. */
  rate: number;
}) {
  const t = useTranslations("Reports");
  const tApp = useTranslations("SellerApp");
  const errorText = useFormErrorText();
  const today = phnomPenhDay(new Date());
  // The custom days being typed; the report follows once they make a range.
  const [customOpen, setCustomOpen] = useState(query.period === "custom");
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? "");
  const customCheck = reportQuerySchema.safeParse({ period: "custom", from: from || undefined, to: to || undefined });
  // Only a range in the wrong order or ahead of today is worth saying; an empty box just waits.
  const toError = customCheck.success ? undefined : toFieldErrors(customCheck.error).to;
  const customError = toError === "required" ? undefined : toError;
  const periodLabel = (value: ReportPeriod) => (value === "today" ? tApp("periodToday") : value === "week" ? tApp("periodWeek") : value === "month" ? tApp("periodMonth") : t(`period_${value}`));

  return (
    <Card className="flex flex-col gap-4 p-4 print:hidden">
      <div className="-mx-4 overflow-x-auto px-4">
        <SegmentedControl
          size="sm"
          label={t("periodLabel")}
          value={customOpen ? "custom" : query.period}
          onChange={(period) => {
            if (period === "custom") {
              setCustomOpen(true);
              setFrom((current) => current || firstDay || today);
              setTo((current) => current || today);
              return;
            }
            setCustomOpen(false);
            onQuery({ period });
          }}
          options={PERIODS.map((value) => ({ value, label: periodLabel(value) }))}
        />
      </div>
      {customOpen && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <Input label={t("fromLabel")} type="date" max={today} value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input label={t("toLabel")} type="date" max={today} value={to} onChange={(event) => setTo(event.target.value)} error={customError ? errorText(customError) : undefined} />
          <Button variant="primary" className="sm:mt-7" disabled={!customCheck.success} onClick={() => customCheck.success && onQuery(customCheck.data)}>
            {t("showRange")}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Switch checked={inOne !== null} onChange={(on) => onInOne(on ? mainCurrency : null)} label={t("inOneLabel")} description={inOne ? t("rateNote", { rate: rate.toLocaleString("en-US") }) : t("inOneHint")} />
        {inOne && (
          <SegmentedControl
            mode="choice"
            size="sm"
            label={t("inOneLabel")}
            value={inOne}
            onChange={onInOne}
            options={[
              { value: "USD", label: t("inUsd") },
              { value: "KHR", label: t("inKhr") },
            ]}
          />
        )}
      </div>
    </Card>
  );
}

/** A report's Print button: the browser's own printing, the page laid out for paper. */
export function PrintButton() {
  const t = useTranslations("Reports");
  return (
    <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      {t("print")}
    </Button>
  );
}

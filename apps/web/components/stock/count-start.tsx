"use client";

import { formatDocumentNumber, phnomPenhDay, type CountValue, type Currency } from "@khmio/shared";
import { Button, Card, Notice, OptionChips, SectionTitle, StatusPill, type Tone } from "@khmio/ui";
import { Ban, CircleCheck, ClipboardCheck, History, TrendingDown, type LucideIcon } from "lucide-react";
import { ActionStatTile } from "@/components/action-stat-tile";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { formatMoney } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import type { StockCount } from "@/lib/api";
import { HISTORY_TILES, historyFigures, historyTileOf, inHistoryTile, tileChipSearch, type HistoryTile } from "./count-tiles";

/** Each Past counts group's look (the tiles and the chips). */
const HISTORY_LOOK: Record<HistoryTile, { icon: LucideIcon; tone: Tone }> = {
  recent: { icon: TrendingDown, tone: "danger" },
  applied: { icon: CircleCheck, tone: "success" },
  cancelled: { icon: Ban, tone: "muted" },
};

/** Each status's pill tone. */
export const COUNT_STATUS_TONE: Record<StockCount["status"], Tone> = { draft: "warning", applied: "success", cancelled: "muted" };

/** "−$45.00 + ៛8,000": a count's net, each currency apart; "—" when nothing differs. */
export function netText(value: CountValue, mainCurrency: Currency): string {
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const parts = [mainCurrency, other].filter((currency) => value.net[currency] !== 0).map((currency) => `${value.net[currency] < 0 ? "−" : "+"}${formatMoney(Math.abs(value.net[currency]), currency)}`);
  return parts.join(" · ") || "—";
}

/**
 * Starting a stock count (design/screens.md S13 "Count stock"): what's being
 * counted — every item, or chosen categories — then Start. Under it, the
 * tiles over the shop's past counts — the last one (opens it), what was lost
 * in 30 days, applied, cancelled; tapped, the list follows — and the past
 * counts (CNT-…): when, what, how many items, and what the differences came
 * to; each opens, read-only.
 */
export function CountStart({
  categories,
  counts,
  mainCurrency,
  writable,
  busy,
  problem,
  onStart,
  countHref,
}: {
  /** The categories the shop's items are in. */
  categories: { id: string; name: string }[];
  counts: StockCount[];
  mainCurrency: Currency;
  writable: boolean;
  busy: boolean;
  problem: string | null;
  onStart: (categoryIds: string[]) => void;
  countHref: (count: StockCount) => string;
}) {
  const t = useTranslations("Stock");
  const router = useRouter();
  const { dateTime } = useDateText();
  const [range, setRange] = useState<"all" | "some">("all");
  const [chosen, setChosen] = useState<string[]>([]);
  const [activeTile, setActiveTile] = useState<HistoryTile | null>(null);
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const today = phnomPenhDay(new Date());
  const history = historyFigures(counts, today);
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";

  function selectTile(tile: HistoryTile | null) {
    const search = tileChipSearch(window.location.search, tile);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(tile);
    setListKey((key) => key + 1);
  }
  const lostText = (lost: Record<Currency, number>) => [mainCurrency, other].filter((currency) => lost[currency] !== 0).map((currency) => `−${formatMoney(Math.abs(lost[currency]), currency)}`);
  const nameOf = new Map(categories.map((category) => [category.id, category.name]));
  const rangeText = (count: StockCount) => (count.categoryIds.length === 0 ? t("countRangeAll") : count.categoryIds.map((id) => nameOf.get(id) ?? "—").join(", "));

  const columns: DataGridColumn<StockCount>[] = [
    { key: "number", header: t("countColNumber"), hideable: false, pin: "start", sortable: true, value: (count) => count.number, exportValue: (count) => formatDocumentNumber("count", count.number), cell: (count) => <span className="font-medium">{formatDocumentNumber("count", count.number)}</span> },
    { key: "started", header: t("countColStarted"), sortable: true, value: (count) => count.startedAt, exportValue: (count) => dateTime(count.startedAt), cell: (count) => <span className="whitespace-nowrap">{dateTime(count.startedAt)}</span> },
    { key: "range", header: t("countColRange"), value: rangeText, cell: (count) => <span className="line-clamp-1">{rangeText(count)}</span> },
    { key: "items", header: t("countColItems"), align: "right", sortable: true, value: (count) => count.lines.length, cell: (count) => <span className="tabular-nums">{count.lines.length}</span> },
    {
      key: "net",
      header: t("countColNet"),
      align: "right",
      value: (count) => count.value.net[mainCurrency],
      exportValue: (count) => netText(count.value, mainCurrency),
      cell: (count) => <span className={count.value.net[mainCurrency] < 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums"}>{netText(count.value, mainCurrency)}</span>,
    },
    { key: "status", header: t("countColStatus"), value: (count) => t(`countStatus_${count.status}`), cell: (count) => <StatusPill tone={COUNT_STATUS_TONE[count.status]}>{t(`countStatus_${count.status}`)}</StatusPill> },
  ];

  return (
    <>
      {writable && (
        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold leading-normal">{t("countStartTitle")}</h2>
              <p className="text-sm text-muted">{t("countStartHint")}</p>
            </div>
          </div>
          <OptionChips
            label={t("countStartTitle")}
            mode="one"
            value={[range]}
            onChange={([next]) => setRange(next === "some" ? "some" : "all")}
            options={[
              { value: "all", label: t("countRangeAll") },
              { value: "some", label: t("countRangeSome") },
            ]}
          />
          {range === "some" && (
            <OptionChips label={t("countRangeSome")} mode="many" value={chosen} onChange={setChosen} options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          )}
          {problem && (
            <Notice tone="danger" role="alert">
              {problem}
            </Notice>
          )}
          <Button variant="primary" className="self-start" loading={busy} disabled={range === "some" && chosen.length === 0} onClick={() => onStart(range === "some" ? chosen : [])}>
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            {t("countStart")}
          </Button>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("countHistoryTitle")}</SectionTitle>
        <nav aria-label={t("countHistoryTitle")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* The last applied count: tapped, it opens. */}
          <ActionStatTile
            icon={History}
            tone="brand"
            label={t("countTile_last")}
            count={history.last ? formatDocumentNumber("count", history.last.number) : undefined}
            amount={history.last ? netText(history.last.value, mainCurrency) : t("countNoneYet")}
            sub={history.last?.appliedAt ? dateTime(history.last.appliedAt) : undefined}
            action={history.last ? t("countActionOpen") : undefined}
            active={false}
            onSelect={() => history.last && router.push(countHref(history.last))}
          />
          {HISTORY_TILES.map((tile) => {
            const lost = lostText(history.recent.lost);
            return (
              <ActionStatTile
                key={tile}
                icon={HISTORY_LOOK[tile].icon}
                tone={HISTORY_LOOK[tile].tone}
                label={t(`countTile_${tile}`)}
                count={tile === "recent" ? t("countCountsCount", { count: history.recent.count }) : undefined}
                amount={tile === "recent" ? (lost[0] ?? formatMoney(0, mainCurrency)) : t("countCountsCount", { count: tile === "applied" ? history.applied : history.cancelled })}
                sub={tile === "recent" ? lost[1] : undefined}
                active={activeTile === tile}
                onSelect={() => selectTile(activeTile === tile ? null : tile)}
              />
            );
          })}
        </nav>
        <DataGrid
          key={listKey}
          syncUrl
          onViewChange={({ chip }) => setActiveTile(historyTileOf(chip))}
          chips={HISTORY_TILES.map((tile) => ({ value: tile, label: t(`countTile_${tile}`), icon: HISTORY_LOOK[tile].icon, predicate: (count: StockCount) => inHistoryTile(tile, count, today) }))}
          rows={counts}
          getRowId={(count) => count.id}
          columns={columns}
          searchText={(count) => `${formatDocumentNumber("count", count.number)} ${rangeText(count)}`}
          searchPlaceholder={t("countSearch")}
          onRowClick={(count) => router.push(countHref(count))}
          initialSort={{ key: "number", direction: "desc" }}
          defaultPageSize={10}
          renderCard={(count) => (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex w-full items-baseline justify-between gap-2">
                <span className="font-semibold">{formatDocumentNumber("count", count.number)}</span>
                <span className={count.value.net[mainCurrency] < 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums"}>{netText(count.value, mainCurrency)}</span>
              </p>
              <p className="w-full truncate text-xs text-muted">{[dateTime(count.startedAt), rangeText(count), t("countItemsCounted", { count: count.lines.length })].join(" · ")}</p>
              <span className="self-start">
                <StatusPill tone={COUNT_STATUS_TONE[count.status]}>{t(`countStatus_${count.status}`)}</StatusPill>
              </span>
            </div>
          )}
          exportFileName="stock-counts"
          storageKey="seller-stock-counts-v1"
          emptyTitle={t("countHistoryEmpty")}
        />
      </section>
    </>
  );
}

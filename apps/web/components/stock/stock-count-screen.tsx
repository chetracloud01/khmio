"use client";

import { formatDocumentNumber, MAX_STOCK_COUNT, type CountValue, type Currency, type FormErrorCode } from "@khmio/shared";
import { Button, Card, ConfirmDialog, Notice, ProgressBar, QuantityInput, StatusPill, type Tone } from "@khmio/ui";
import { Check, CheckCheck, CircleDashed, ListRestart, Loader2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney, TONE_TEXT } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import { api, ApiError, type StockCount, stockCountSchema, type StockPage } from "@/lib/api";
import { ActionStatTile } from "@/components/action-stat-tile";
import { COUNT_STATUS_TONE, netText } from "./count-start";
import { COUNT_TILES, countTileFigures, countTileOf, inCountTile, tileChipSearch, type CountTile } from "./count-tiles";
import { countProgress, itemsInRange, pendingLines, screenLines, typedCount, type CountLine } from "./count-draft";
import { STOCK_LEVEL_ORDER, STOCK_LEVELS, stockLevelOf } from "./stock-levels";

type Item = StockPage["items"][number];

/** Each tile's look and what it asks for (none: nothing to do there). */
const TILE_LOOK: Record<CountTile, { icon: LucideIcon; tone: Tone; action?: "countActionCount" }> = {
  uncounted: { icon: CircleDashed, tone: "info", action: "countActionCount" },
  lost: { icon: TrendingDown, tone: "danger" },
  found: { icon: TrendingUp, tone: "success" },
  matches: { icon: CheckCheck, tone: "muted" },
};

/** How long typing pauses before the boxes are saved. */
const SAVE_AFTER_MS = 800;

/** "−$57.00 · −៛8,000": one side of the value bar, each currency apart; "—" when there's none. */
function sideText(side: Record<Currency, number>, mainCurrency: Currency): string {
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  return [mainCurrency, other].filter((currency) => side[currency] !== 0).map((currency) => `${side[currency] < 0 ? "−" : "+"}${formatMoney(Math.abs(side[currency]), currency)}`).join(" · ") || "—";
}

/**
 * One stock count (design/screens.md S13 "Count stock"): CNT-… with what it
 * covers and how far it's got; the tiles — Not counted yet · Lost · Found ·
 * Matches — which the list follows when tapped; every item in its range with
 * its count on record, the Counted box (− +; Enter moves down; ✓ Matches in
 * one tap) and its difference in units and money. A draft saves each box a moment after typing stops, so it
 * can be left and continued on any device; the bar at the bottom says what's
 * lost, found and the net, and Apply puts every correction onto today's stock
 * (asking first). Applied or cancelled, it's read-only.
 */
export function StockCountScreen({
  count: initial,
  items,
  nameOf,
  categoryName,
  mainCurrency,
  writable,
  onDone,
}: {
  count: StockCount;
  /** The Stock list's items (today's counts and costs). */
  items: Item[];
  nameOf: (item: Item) => string;
  categoryName: (categoryId: string) => string;
  mainCurrency: Currency;
  writable: boolean;
  /** Applied or cancelled: where to go next. */
  onDone: (count: StockCount) => void;
}) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const { dateTime } = useDateText();
  const tableRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(initial);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"apply" | "cancel" | null>(null);
  const [asking, setAsking] = useState<"apply" | "cancel" | null>(null);
  const [activeTile, setActiveTile] = useState<CountTile | null>(null);
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const draft = writable && count.status === "draft";

  const inRange = itemsInRange(items, count);
  const lines = screenLines(count, inRange, texts);
  const lineOf = new Map<string, CountLine>(lines.map((line) => [line.variantId, line]));
  const progress = countProgress(lines, inRange);
  const pending = pendingLines(count, texts);
  const invalid = Object.values(texts).some((text) => Number.isNaN(typedCount(text) ?? 0));
  const tiles = countTileFigures(inRange, lines);
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";

  function selectTile(tile: CountTile | null) {
    const search = tileChipSearch(window.location.search, tile);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(tile);
    setListKey((key) => key + 1);
  }
  /** The shelf matches the record: one tap instead of typing it. */
  const matches = (item: Item) => setTexts((current) => ({ ...current, [item.variantId]: String(item.onHand ?? 0) }));

  /** Saves what changed: counts typed, boxes emptied. The answer is the count as saved. */
  async function saveNow(): Promise<boolean> {
    const changes = pendingLines(count, texts);
    if (changes.length === 0) return true;
    setSaving(true);
    setProblem(null);
    try {
      let saved = count;
      for (let at = 0; at < changes.length; at += MAX_STOCK_COUNT) {
        const batch = changes.slice(at, at + MAX_STOCK_COUNT);
        try {
          saved = await api(`/stock/counts/${count.id}/lines`, stockCountSchema, { method: "PUT", body: { lines: batch } });
        } catch (failure) {
          // Lines come back by their place in what was sent: shown under that item's box.
          if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
            setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^lines\.(\d+)\..*$/, (_, index: string) => batch[Number(index)]?.variantId ?? key), code])));
          }
          throw failure;
        }
      }
      setCount(saved);
      setErrors({});
      return true;
    } catch (failure) {
      if (!(failure instanceof ApiError && Object.keys(failure.fields).length > 0)) setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // A moment after typing stops, what changed is saved: the count can be left any time.
  const pendingKey = JSON.stringify(pending);
  useEffect(() => {
    if (!draft || pending.length === 0 || invalid) return;
    const timer = window.setTimeout(() => void saveNow(), SAVE_AFTER_MS);
    return () => window.clearTimeout(timer);
    // saveNow reads the latest boxes when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, draft, invalid]);

  async function finish(action: "apply" | "cancel") {
    setAsking(null);
    if (action === "apply" && !(await saveNow())) return;
    setBusy(action);
    setProblem(null);
    try {
      onDone(await api(`/stock/counts/${count.id}/${action}`, stockCountSchema, { method: "POST" }));
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        // A line that would leave less than what's held for unpaid KHQR orders: under its box.
        setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^lines\.(\d+)\..*$/, (_, index: string) => count.lines[Number(index)]?.variantId ?? key), code])));
      } else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  /** Enter: to the next item's box, as a counter walks the shelf. */
  const nextBox = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const boxes = [...(tableRef.current?.querySelectorAll<HTMLInputElement>("[data-count]") ?? [])];
    boxes[boxes.indexOf(event.currentTarget) + 1]?.focus();
  };
  /** Every box not typed yet takes its count on record: then only what's different needs changing. */
  const fillFromRecord = () =>
    setTexts((current) => ({ ...Object.fromEntries(inRange.flatMap((item) => (item.onHand === null || lineOf.has(item.variantId) ? [] : [[item.variantId, String(item.onHand)]]))), ...current }));

  /** Counted less what the app had when it was typed; an untracked item starts from its count (no difference). */
  const differenceOf = (item: Item) => {
    const line = lineOf.get(item.variantId);
    return line && line.expectedOnHand !== null ? line.counted - line.expectedOnHand : null;
  };
  const difference = (item: Item) => {
    const change = differenceOf(item);
    const line = lineOf.get(item.variantId);
    if (!line) return <span className="text-muted">—</span>;
    if (change === null) return <span className="text-xs text-muted">{t("countStartsTracking")}</span>;
    if (change === 0) return <span className="text-muted">{t("countMatches")}</span>;
    const money = line.costMinor !== null && line.costCurrency ? formatMoney(Math.abs(change * line.costMinor), line.costCurrency) : null;
    return (
      <span className={`flex flex-col items-end font-semibold tabular-nums ${change > 0 ? "text-success" : "text-danger"}`}>
        <span>
          {change > 0 ? "+" : "−"}
          {Math.abs(change)}
        </span>
        {money && (
          <span className="text-xs">
            {change > 0 ? "+" : "−"}
            {money}
          </span>
        )}
      </span>
    );
  };
  /** The Counted box (a draft), or what was counted (read-only). A fixed width in the table, the card's whole width on a phone. */
  const box = (item: Item, width = "w-40") => {
    if (!draft) return <span className="tabular-nums">{lineOf.get(item.variantId)?.counted ?? "—"}</span>;
    const saved = count.lines.find((line) => line.variantId === item.variantId);
    return (
      <div className={width}>
        <QuantityInput
          hideLabel
          label={t("countBoxLabel", { name: nameOf(item) })}
          value={texts[item.variantId] ?? (saved ? String(saved.counted) : "")}
          onChange={(text) => setTexts((current) => ({ ...current, [item.variantId]: text }))}
          decreaseLabel={t("countLess", { name: nameOf(item) })}
          increaseLabel={t("countMore", { name: nameOf(item) })}
          placeholder={item.onHand === null ? "" : String(item.onHand)}
          data-count
          onKeyDown={nextBox}
          error={Number.isNaN(typedCount(texts[item.variantId]) ?? 0) ? errorText("quantity_invalid") : errorText(errors[item.variantId])}
        />
      </div>
    );
  };
  /** The box, and — while the item isn't counted and has a count on record — "✓ Matches" in one tap. */
  const countCell = (item: Item, phone = false) => (
    <div className="flex items-start gap-2">
      {box(item, phone ? "min-w-0 flex-1" : "w-40")}
      {draft && item.onHand !== null && !lineOf.has(item.variantId) && (
        <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" aria-label={t("countMatchesFor", { name: nameOf(item), count: item.onHand })} onClick={() => matches(item)}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("countMatchesButton")}
        </Button>
      )}
    </div>
  );

  const columns: DataGridColumn<Item>[] = [
    {
      key: "item",
      header: t("colItem"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: nameOf,
      cell: (item) => (
        <div className="min-w-0 max-w-64">
          <p className="truncate font-medium">
            <DataGridHighlight text={nameOf(item)} />
          </p>
          <p className="truncate text-xs text-muted">
            <DataGridHighlight text={item.sku} />
          </p>
        </div>
      ),
    },
    { key: "category", header: t("colCategory"), defaultHidden: true, sortable: true, value: (item) => categoryName(item.categoryId), cell: (item) => <span className="whitespace-nowrap text-muted">{categoryName(item.categoryId) || "—"}</span> },
    { key: "onRecord", header: t("colOnRecord"), align: "right", sortable: true, value: (item) => item.onHand ?? -1, cell: (item) => <span className="tabular-nums">{item.onHand ?? t("notTracked")}</span> },
    { key: "counted", header: t("countCounted"), hideable: false, exportValue: (item) => lineOf.get(item.variantId)?.counted ?? "", cell: (item) => countCell(item) },
    { key: "difference", header: t("colDifference"), align: "right", sortable: true, value: (item) => differenceOf(item) ?? 0, cell: difference },
  ];

  const value: CountValue = progress.value;
  const changing = value.lostItems + value.foundItems;

  return (
    <>
      {/* The count: its number and status, what it covers, whether it's saved; Cancel kept apart from the counting buttons. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{formatDocumentNumber("count", count.number)}</h2>
          <StatusPill tone={COUNT_STATUS_TONE[count.status]}>{t(`countStatus_${count.status}`)}</StatusPill>
          <span className="text-sm text-muted">{count.categoryIds.length === 0 ? t("countRangeAll") : count.categoryIds.map(categoryName).filter(Boolean).join(", ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted" role="status" aria-live="polite">
            {draft && (saving ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : pending.length === 0 && count.lines.length > 0 ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : null)}
            {draft ? (saving ? t("countSaving") : pending.length > 0 ? t("countUnsaved") : count.lines.length > 0 ? t("countSavedAll") : t("countStartedAt", { time: dateTime(count.startedAt) })) : count.appliedAt ? t("countAppliedAt", { time: dateTime(count.appliedAt) }) : count.cancelledAt ? t("countCancelledAt", { time: dateTime(count.cancelledAt) }) : ""}
          </p>
          {draft && (
            <Button variant="ghost" size="sm" className="text-danger" loading={busy === "cancel"} onClick={() => setAsking("cancel")}>
              {t("countCancel")}
            </Button>
          )}
        </div>
      </div>
      <ProgressBar value={progress.counted} max={progress.total} size="sm" tone={progress.counted === progress.total ? "success" : "brand"} label={t("countProgress", { counted: progress.counted, total: progress.total })} />

      {/* Where the items stand: tapped, the list follows. */}
      <nav aria-label={t("countTilesLabel")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COUNT_TILES.map((tile) => {
          const look = TILE_LOOK[tile];
          const figure = tiles[tile];
          const money = (currency: Currency) => `${figure.value[currency] < 0 ? "−" : "+"}${formatMoney(Math.abs(figure.value[currency]), currency)}`;
          const valued = tile === "lost" || tile === "found";
          return (
            <ActionStatTile
              key={tile}
              icon={look.icon}
              tone={look.tone}
              label={t(`countTile_${tile}`)}
              count={valued ? t("itemsCount", { count: figure.count }) : undefined}
              amount={valued ? (figure.value[mainCurrency] !== 0 || figure.value[other] === 0 ? money(mainCurrency) : money(other)) : t("itemsCount", { count: figure.count })}
              sub={tile === "uncounted" ? t("countProgress", { counted: progress.counted, total: progress.total }) : valued && figure.value[mainCurrency] !== 0 && figure.value[other] !== 0 ? money(other) : undefined}
              action={look.action && draft && figure.count > 0 ? t(look.action) : undefined}
              active={activeTile === tile}
              onSelect={() => selectTile(activeTile === tile ? null : tile)}
            />
          );
        })}
      </nav>
      {draft && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fillFromRecord}>
            <ListRestart className="h-4 w-4" aria-hidden="true" />
            {t("countFill")}
          </Button>
          <p className="text-xs text-muted">{t("countFillHint")}</p>
        </div>
      )}

      <div ref={tableRef}>
        <DataGrid
          key={listKey}
          syncUrl
          onViewChange={({ chip }) => setActiveTile(countTileOf(chip))}
          rowNumbers
          rows={inRange}
          getRowId={(item) => item.variantId}
          columns={columns}
          searchText={(item) => `${item.titleKm} ${item.titleEn} ${item.optionKm} ${item.optionEn} ${item.sku}`}
          searchPlaceholder={t("searchItems")}
          chips={[
            ...COUNT_TILES.map((tile) => ({ value: tile, label: t(`countTile_${tile}`), icon: TILE_LOOK[tile].icon, predicate: (item: Item) => inCountTile(tile, lineOf.get(item.variantId)) })),
            ...STOCK_LEVEL_ORDER.map((level) => ({
              value: level,
              label: t(`chip_${level}`),
              icon: STOCK_LEVELS[level].icon,
              iconClass: TONE_TEXT[STOCK_LEVELS[level].tone],
              predicate: (item: Item) => stockLevelOf(item) === level,
            })),
          ]}
          initialSort={{ key: "item", direction: "asc" }}
          defaultPageSize={10}
          renderCard={(item) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium leading-snug">
                    <DataGridHighlight text={nameOf(item)} />
                  </p>
                  <p className="line-clamp-1 text-xs text-muted">{[item.sku, item.onHand === null ? t("notTracked") : t("countOnRecord", { count: item.onHand })].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="shrink-0 text-sm">{difference(item)}</div>
              </div>
              {draft ? countCell(item, true) : <p className="text-sm">{t("countCountedShort", { count: lineOf.get(item.variantId)?.counted ?? 0 })}</p>}
            </div>
          )}
          exportFileName={formatDocumentNumber("count", count.number)}
          // "-v3": the count document (2026-10-29).
          storageKey="seller-stock-count-v3"
          emptyTitle={t("noMatches")}
        />
      </div>

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      {/* What the differences come to, and Apply: above the phone's bottom menu. */}
      <Card className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 shadow-raised md:bottom-4">
        <dl className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs sm:text-sm">
          <div className="flex gap-1">
            <dt className="text-muted">{t("countLost")}</dt>
            <dd className="font-semibold tabular-nums text-danger">{sideText(value.lost, mainCurrency)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">{t("countFound")}</dt>
            <dd className="font-semibold tabular-nums text-success">{sideText(value.found, mainCurrency)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">{t("countNet")}</dt>
            <dd className="font-bold tabular-nums">{netText(value, mainCurrency)}</dd>
          </div>
          {value.withoutCost > 0 && <p className="w-full text-xs text-muted">{t("countWithoutCost", { count: value.withoutCost })}</p>}
          {/* Applying a half-done count is allowed, but never by mistake. */}
          {draft && tiles.uncounted.count > 0 && <p className="w-full text-xs font-medium text-warning">{t("countUncountedStay", { count: tiles.uncounted.count })}</p>}
        </dl>
        {draft && (
          <Button variant="primary" className="shrink-0" loading={busy === "apply"} disabled={invalid || saving || lines.length === 0} onClick={() => setAsking("apply")}>
            {t("countApply")}
          </Button>
        )}
      </Card>

      {/* Stock changes for every item counted and can't be undone by this count: one tap isn't enough. */}
      <ConfirmDialog
        open={asking !== null}
        title={asking === "cancel" ? t("countCancelConfirm") : t("countApplyConfirm", { number: formatDocumentNumber("count", count.number) })}
        body={asking === "cancel" ? t("countCancelHint") : t("countApplyHint", { changing, net: netText(value, mainCurrency) })}
        confirmLabel={asking === "cancel" ? t("countCancel") : t("countApply")}
        cancelLabel={t("countKeepGoing")}
        danger={asking === "cancel"}
        onConfirm={() => asking && void finish(asking)}
        onClose={() => setAsking(null)}
      />
    </>
  );
}

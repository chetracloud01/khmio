"use client";

import { getMinimumPlanFor, type Currency } from "@khmio/shared";
import { Button, buttonVariants, EmptyState, StatusPill } from "@khmio/ui";
import { ArrowUpDown, ChartColumn, PackageOpen, PackagePlus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { formatMoney, TONE_TEXT } from "@/components/order-ui";
import { itemName, productCostCurrency } from "@/components/stock/item-name";
import { ManageSheet } from "@/components/stock/manage-sheet";
import { newBillHref } from "@/components/stock/new-bill-link";
import { ReorderSheet } from "@/components/stock/reorder-sheet";
import { StockArea } from "@/components/stock/stock-area";
import { StockHistory } from "@/components/stock/stock-history";
import { STOCK_LEVEL_ORDER, STOCK_LEVELS, stockLevelOf, stockValueOf } from "@/components/stock/stock-levels";
import { ReorderBar, StockStatusTiles } from "@/components/stock/stock-status-tiles";
import { stockTileOf, stockTileSearch, toReorder, type StockTile } from "@/components/stock/stock-tiles";
import { TrackManySheet } from "@/components/stock/track-many-sheet";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type Catalog, catalogSchema, type StockPage, stockPageSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";
import { localName } from "@/lib/local-name";

type Item = StockPage["items"][number];
const CURRENCIES = ["USD", "KHR"] as const;
/** How many of the latest stock changes the list page's top strip shows; "See all" opens the rest. */
const ACTIVITY_PREVIEW = 3;

// Stock (design/screens.md S13), roadmap Pro plan: in the side menu under
// Orders, one tab of the Stock area. Every product option with its count at
// the main branch, its category, cost and what it's worth, in the shared data
// grid like Products. On top, the status tiles (Out · Low · In stock · Not
// tracked): tapped, the list follows; and, when items are at or below their
// reorder point, one bar to order them all on a new bill. The list has chips
// (To reorder, Out, Low, In stock, Not tracked),
// the filter panel (category, brand, cost currency, cost or not), search,
// sort, pages, export. Each row asks for what it needs — Order (a new bill
// at its suggested quantity), Change stock, or Start tracking — and has its
// reorder levels and suggested order
// (the minimum/maximum rule). A selection starts tracking many at once, sets
// reorder levels, or opens a new bill already filled with what to order.
// Lower plans see their counts, locked.
export default function StockPage() {
  const t = useTranslations("Stock");
  const locale = useLocale();
  const { store } = useMerchant();
  const router = useRouter();
  const [page, setPage] = useState<StockPage | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const [trackMany, setTrackMany] = useState<Item[] | null>(null);
  const [reorderFor, setReorderFor] = useState<Item[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTile, setActiveTile] = useState<StockTile | null>(null);
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api("/stock", stockPageSchema), api("/catalog", catalogSchema)]).then(([stock, names]) => {
      setPage(stock);
      setCatalog(names);
    }, () => setFailed(true));
    // Only the stock-in sheet's picker needs them: without them it still saves, with no supplier.
    api("/suppliers", suppliersSchema).then((answer) => setSuppliers(answer.suppliers.filter((supplier) => !supplier.archived)), () => setSuppliers([]));
  }, []);
  useEffect(load, [load]);

  const nameOf = useCallback((entry: { nameKm: string; nameEn: string }) => localName(locale, entry), [locale]);
  const categoryName = useMemo(() => new Map(catalog?.categories.map((category) => [category.id, nameOf(category)])), [catalog, nameOf]);

  if (failed) return <PageOffline onRetry={load} />;
  if (!page || !catalog) return <PageLoading />;

  const writable = page.tracksStock;
  const name = (item: Item) => itemName(locale, item);
  const byVariant = new Map(page.items.map((item) => [item.variantId, item]));
  function selectTile(tile: StockTile | null) {
    const search = stockTileSearch(window.location.search, tile);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(tile);
    setListKey((key) => key + 1);
  }
  const usedCategories = catalog.categories.filter((category) => page.items.some((item) => item.categoryId === category.id));
  const usedBrands = catalog.brands.filter((brand) => page.items.some((item) => item.brandId === brand.id));

  /** A row's quick change; its tap stays on the button, never opening the row too. */
  const quick = (item: Item) => (event: MouseEvent) => {
    event.stopPropagation();
    setOpen(item);
  };
  /**
   * What a row asks for (corrections and reorder levels are on the item's
   * page): Order — a new bill at its suggested quantity — when it's at or
   * below its reorder point, with Change stock beside it; Start tracking when
   * it has no count yet; else Change stock.
   */
  const actions = (item: Item) =>
    writable && (
      <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap" onClick={(event) => event.stopPropagation()}>
        {toReorder(item) && (
          <Link href={newBillHref(locale, [item])} className={buttonVariants({ variant: "primary", size: "sm", className: "whitespace-nowrap" })}>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {t("orderButton")}
          </Link>
        )}
        <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={quick(item)}>
          {item.onHand === null ? <PackagePlus className="h-4 w-4" aria-hidden="true" /> : <ArrowUpDown className="h-4 w-4" aria-hidden="true" />}
          {item.onHand === null ? t("openingButton") : t("changeStockButton")}
        </Button>
      </div>
    );
  const itemHref = (item: Item) => `/${locale}/m/stock/${item.variantId}`;
  const levelPill = (item: Item) => {
    const level = STOCK_LEVELS[stockLevelOf(item)];
    return <StatusPill tone={level.tone}>{t(level.word)}</StatusPill>;
  };
  const money = (amount: number | null, currency: Currency | null) => (amount !== null && currency ? formatMoney(amount, currency) : "—");

  const columns: DataGridColumn<Item>[] = [
    {
      key: "item",
      header: t("colItem"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (item) => name(item),
      cell: (item) => (
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">
            <DataGridHighlight text={name(item)} />
          </p>
          <p className="truncate text-xs text-muted">
            <DataGridHighlight text={item.sku} />
            {categoryName.get(item.categoryId) && ` · ${categoryName.get(item.categoryId)}`}
          </p>
        </div>
      ),
    },
    { key: "category", header: t("colCategory"), defaultHidden: true, sortable: true, value: (item) => categoryName.get(item.categoryId) ?? "", cell: (item) => <span className="whitespace-nowrap text-muted">{categoryName.get(item.categoryId) ?? "—"}</span> },
    { key: "status", header: t("colStatus"), sortable: true, value: (item) => STOCK_LEVEL_ORDER.indexOf(stockLevelOf(item)), exportValue: (item) => t(STOCK_LEVELS[stockLevelOf(item)].word), cell: levelPill },
    {
      key: "onHand",
      header: t("colOnHand"),
      align: "right",
      sortable: true,
      value: (item) => item.onHand ?? -1,
      exportValue: (item) => item.onHand ?? "",
      cell: (item) => <span className="text-lg font-semibold tabular-nums">{item.onHand ?? "—"}</span>,
    },
    {
      key: "cost",
      header: t("colCost"),
      defaultHidden: true,
      align: "right",
      sortable: true,
      value: (item) => item.costMinor ?? -1,
      exportValue: (item) => money(item.costMinor, item.costCurrency),
      cell: (item) => <span className="tabular-nums">{money(item.costMinor, item.costCurrency)}</span>,
    },
    {
      key: "value",
      header: t("colValue"),
      align: "right",
      sortable: true,
      // Dollars and riel can't be compared: this sorts within a currency.
      value: (item) => stockValueOf(item)?.amount ?? -1,
      exportValue: (item) => money(stockValueOf(item)?.amount ?? null, stockValueOf(item)?.currency ?? null),
      cell: (item) => <span className="font-semibold tabular-nums">{money(stockValueOf(item)?.amount ?? null, stockValueOf(item)?.currency ?? null)}</span>,
    },
    {
      key: "reorder",
      header: t("colReorder"),
      defaultHidden: true,
      align: "right",
      value: (item) => item.reorderMin ?? -1,
      exportValue: (item) => (item.reorderMin === null ? "" : [item.reorderMin, item.reorderMax].filter((level) => level !== null).join("–")),
      cell: (item) =>
        item.onHand === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="whitespace-nowrap tabular-nums text-muted">{item.reorderMin === null ? t("reorderShopRule") : t("reorderLevels", { min: item.reorderMin, max: item.reorderMax ?? item.reorderMin * 2 })}</span>
        ),
    },
    {
      key: "suggested",
      header: t("colSuggested"),
      align: "right",
      sortable: true,
      value: (item) => item.suggested ?? -1,
      exportValue: (item) => item.suggested ?? "",
      cell: (item) => (item.suggested === null ? <span className="text-muted">—</span> : <span className="font-semibold tabular-nums text-warning">{item.suggested}</span>),
    },
    { key: "lastSupplier", header: t("colLastSupplier"), defaultHidden: true, sortable: true, value: (item) => item.lastSupplierName ?? "", cell: (item) => <span className="whitespace-nowrap">{item.lastSupplierName ?? "—"}</span> },
    { key: "actions", header: "", align: "right", hideable: false, pin: "end", exportValue: () => "", cell: (item) => actions(item) },
  ];

  return (
    <StockArea
      tab="stock"
      writable={writable}
      actions={
        <Link href={`/${locale}/m/reports/stock`} className={buttonVariants({ variant: "secondary" })}>
          <ChartColumn className="h-4 w-4" aria-hidden="true" />
          {t("reportLink")}
        </Link>
      }
    >
      {!writable && <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />}

      {writable && page.items.length > 0 && (
        <>
          <StockStatusTiles items={page.items} mainCurrency={store.defaultCurrency} active={activeTile} onSelect={selectTile} />
          <ReorderBar items={page.items} mainCurrency={store.defaultCurrency} billHref={(items) => newBillHref(locale, items)} />
          {page.value.withoutCost > 0 && <p className="text-xs text-muted">{t("withoutCost", { count: page.value.withoutCost })}</p>}
        </>
      )}

      {/* The latest few above the list; "See all" opens the rest, and each item's page has its whole history. */}
      {page.items.length > 0 && (
        <StockHistory
          preview={ACTIVITY_PREVIEW}
          movements={page.movements}
          nameOf={(variantId) => {
            const item = byVariant.get(variantId);
            return item ? name(item) : "";
          }}
        />
      )}

      {page.items.length === 0 ? (
        <EmptyState icon={PackageOpen} title={t("noProductsYet")} />
      ) : (
        <DataGrid
          key={listKey}
          syncUrl
          onViewChange={({ chip }) => setActiveTile(stockTileOf(chip))}
          rowNumbers
          rows={page.items}
          getRowId={(item) => item.variantId}
          columns={columns}
          searchText={(item) => `${item.titleKm} ${item.titleEn} ${item.optionKm} ${item.optionEn} ${item.sku}`}
          searchPlaceholder={t("searchItems")}
          chips={[
            { value: "reorder", label: t("chip_reorder"), icon: ShoppingCart, iconClass: TONE_TEXT.warning, predicate: toReorder },
            ...STOCK_LEVEL_ORDER.map((level) => ({
              value: level,
              label: t(`chip_${level}`),
              icon: STOCK_LEVELS[level].icon,
              iconClass: TONE_TEXT[STOCK_LEVELS[level].tone],
              predicate: (item: Item) => stockLevelOf(item) === level,
            })),
          ]}
          filters={[
            { key: "category", label: t("colCategory"), options: usedCategories.map((category) => ({ value: category.id, label: nameOf(category) })), predicate: (item, value) => item.categoryId === value },
            { key: "brand", label: t("filterBrand"), options: usedBrands.map((brand) => ({ value: brand.id, label: nameOf(brand) })), predicate: (item, value) => item.brandId === value },
            { key: "currency", label: t("filterCurrency"), options: CURRENCIES.map((currency) => ({ value: currency, label: t(`currency_${currency}`) })), predicate: (item, value) => productCostCurrency(page.items, item) === value },
            {
              key: "cost",
              label: t("filterCost"),
              options: [
                { value: "with", label: t("filterCostWith") },
                { value: "without", label: t("filterCostWithout") },
              ],
              predicate: (item, value) => (item.costMinor !== null) === (value === "with"),
            },
          ]}
          bulkActions={
            writable
              ? [
                  { key: "bill", label: t("createBill"), variant: "primary", applies: (item) => item.onHand !== null, run: (rows) => router.push(newBillHref(locale, rows)) },
                  { key: "reorder", label: t("setReorderLevels"), applies: (item) => item.onHand !== null, run: (rows) => setReorderFor(rows) },
                  { key: "track", label: t("openingMany"), applies: (item) => item.onHand === null, run: (rows) => setTrackMany(rows) },
                ]
              : undefined
          }
          selectOnDemand
          onRowClick={(item) => router.push(itemHref(item))}
          initialSort={{ key: "status", direction: "asc" }}
          defaultPageSize={10}
          renderCard={(item) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 font-medium leading-snug">
                  <DataGridHighlight text={name(item)} />
                </p>
                <p className="line-clamp-1 text-xs text-muted">
                  {[categoryName.get(item.categoryId), item.sku, item.costMinor !== null && item.costCurrency ? t("costLine", { amount: formatMoney(item.costMinor, item.costCurrency) }) : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-lg font-semibold tabular-nums">{item.onHand ?? "—"}</span>
                {levelPill(item)}
              </div>
            </div>
          )}
          renderCardAction={(item) => (writable ? <div className="px-4 pb-3">{actions(item)}</div> : null)}
          exportFileName="stock"
          // "-v5": 10 rows a page (2026-10-29) replaces earlier saved choices.
          storageKey="seller-stock-v5"
          emptyTitle={t("noMatches")}
        />
      )}


      {open && (
        <ManageSheet
          item={open}
          title={name(open)}
          costCurrency={productCostCurrency(page.items, open)}
          shopCurrency={store.defaultCurrency}
          suppliers={suppliers}
          onReorderLevels={() => setReorderFor([open])}
          onClose={() => setOpen(null)}
          onSaved={(next) => setPage(next)}
        />
      )}
      {reorderFor && <ReorderSheet items={reorderFor} nameOf={name} onClose={() => setReorderFor(null)} onSaved={(next) => setPage(next)} />}
      {trackMany && (
        <TrackManySheet
          items={trackMany}
          nameOf={name}
          currencyOf={(item) => productCostCurrency(page.items, item)}
          shopCurrency={store.defaultCurrency}
          onClose={() => setTrackMany(null)}
          onSaved={(next) => setPage(next)}
        />
      )}
    </StockArea>
  );
}

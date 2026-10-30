"use client";

import { formatKhmerPhoneLocal, type Currency } from "@khmio/shared";
import { Button, buttonVariants, Mio, StatusPill, type Tone } from "@khmio/ui";
import { AlarmClock, Archive, CircleCheck, HandCoins, PackageOpen, Plus, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { formatMoney } from "@/components/order-ui";
import { StatusTileRow } from "@/components/status-tile-row";
import type { PayablesReport, Supplier } from "@/lib/api";
import { SupplierSheet } from "./supplier-sheet";
import { inTile, standingOf, SUPPLIER_TILES, supplierStandings, supplierTileFigures, supplierTileOf, supplierTileSearch, type SupplierTile } from "./supplier-tiles";
import { usePurchaseText } from "./use-purchase-text";

/** Each group's look (the tiles and the chips) and what it asks for (none: nothing to do there). */
const TILE_LOOK: Record<SupplierTile, { icon: LucideIcon; tone: Tone; action?: "tileActionPay" | "tileActionReceive" }> = {
  overdue: { icon: AlarmClock, tone: "danger", action: "tileActionPay" },
  owed: { icon: HandCoins, tone: "warning", action: "tileActionPay" },
  waiting: { icon: PackageOpen, tone: "warning", action: "tileActionReceive" },
  settled: { icon: CircleCheck, tone: "success" },
  archived: { icon: Archive, tone: "muted" },
};
const CURRENCIES = ["USD", "KHR"] as const;

/**
 * The shop's suppliers (design/screens.md S13 "Suppliers"), the Stock area's
 * third tab. On top, the status tiles — Overdue · You owe · Waiting for goods
 * · Settled · Archived — from the payables report: tapped, the list follows
 * (each is also a chip). The shared data grid like Products: what was bought
 * from each, what the shop still owes them, overdue, bills not received, and
 * their last bill. A row asks for what it needs — Pay (their page, at their
 * bills) and New bill — and opens the supplier's page (edit, archive or use
 * again — never deleted: old bills keep who they came from); a new one is
 * added here.
 */
export function SuppliersScreen({
  suppliers: initial,
  report,
  mainCurrency,
  writable,
  supplierHref,
  newBillHref,
}: {
  suppliers: Supplier[];
  /** Every bill's standing, for overdue and not received (null until read: the tiles wait). */
  report: PayablesReport | null;
  mainCurrency: Currency;
  writable: boolean;
  /** One supplier's page. */
  supplierHref: (supplier: Supplier) => string;
  /** A new bill with this supplier chosen. */
  newBillHref: (supplier: Supplier) => string;
}) {
  const t = useTranslations("Purchases");
  const tPayables = useTranslations("Payables");
  const router = useRouter();
  const { billDay } = usePurchaseText();
  const [suppliers, setSuppliers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [activeTile, setActiveTile] = useState<SupplierTile | null>(null);
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const standings = supplierStandings(report ?? { suppliers: [] });
  const standing = (supplier: Supplier) => standingOf(standings, supplier);
  const tiles = supplierTileFigures(suppliers, standings);
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";

  function selectTile(tile: SupplierTile | null) {
    const search = supplierTileSearch(window.location.search, tile);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(tile);
    setListKey((key) => key + 1);
  }
  const owes = (supplier: Supplier) => supplier.owed.USD > 0 || supplier.owed.KHR > 0;
  /** What a row asks for: Pay (their page, at their bills) when the shop owes them, and New bill. The row's own tap still opens it. */
  const actions = (supplier: Supplier) =>
    writable && (
      <span className="inline-flex flex-wrap justify-end gap-2 lg:flex-nowrap" onClick={(event) => event.stopPropagation()}>
        {owes(supplier) && (
          <Link href={`${supplierHref(supplier)}#bills`} className={buttonVariants({ variant: "primary", size: "sm", className: "whitespace-nowrap" })}>
            <Wallet className="h-4 w-4" aria-hidden="true" />
            {t("payButton")}
          </Link>
        )}
        {!supplier.archived && (
          <Link href={newBillHref(supplier)} className={buttonVariants({ variant: "secondary", size: "sm", className: "whitespace-nowrap" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("newBill")}
          </Link>
        )}
      </span>
    );

  const amounts = (sums: Supplier["bought"]) => CURRENCIES.filter((currency) => sums[currency] !== 0).map((currency) => formatMoney(sums[currency], currency));
  const bought = (supplier: Supplier) => amounts(supplier.bought);
  const owed = (supplier: Supplier) => amounts(supplier.owed);
  const columns: DataGridColumn<Supplier>[] = [
    {
      key: "name",
      header: t("supplierName"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (supplier) => supplier.name,
      cell: (supplier) => (
        // A long note is cut, never stretching the table past the screen.
        <div className="min-w-0 max-w-52">
          <p className="truncate font-medium">
            <DataGridHighlight text={supplier.name} />
          </p>
          <p className="truncate text-xs text-muted">
            <DataGridHighlight text={[supplier.phone ? formatKhmerPhoneLocal(supplier.phone) : "", supplier.note].filter(Boolean).join(" · ")} />
          </p>
        </div>
      ),
    },
    { key: "bills", header: t("colBills"), align: "right", sortable: true, value: (supplier) => supplier.purchaseCount, cell: (supplier) => <span className="tabular-nums">{supplier.purchaseCount}</span> },
    {
      key: "bought",
      header: t("colBought"),
      align: "right",
      sortable: true,
      // Dollars and riel can't be compared: this sorts by dollars, then riel.
      value: (supplier) => supplier.bought.USD * 1_000_000_000 + supplier.bought.KHR,
      exportValue: (supplier) => bought(supplier).join(" + "),
      cell: (supplier) => (
        <div className="tabular-nums">
          {bought(supplier).length === 0 ? "—" : bought(supplier).map((line, index) => <p key={line} className={index === 0 ? "font-semibold" : "text-xs text-muted"}>{line}</p>)}
        </div>
      ),
    },
    {
      key: "owed",
      header: t("colOwed"),
      align: "right",
      sortable: true,
      value: (supplier) => supplier.owed.USD * 1_000_000_000 + supplier.owed.KHR,
      exportValue: (supplier) => owed(supplier).join(" + "),
      cell: (supplier) => (
        <div className="tabular-nums">
          {owed(supplier).length === 0 ? <span className="text-muted">—</span> : owed(supplier).map((line, index) => <p key={line} className={index === 0 ? "font-semibold text-warning" : "text-xs text-muted"}>{line}</p>)}
        </div>
      ),
    },
    {
      key: "overdue",
      header: tPayables("colOverdue"),
      align: "right",
      sortable: true,
      value: (supplier) => standing(supplier).overdue.USD * 1_000_000_000 + standing(supplier).overdue.KHR,
      exportValue: (supplier) => amounts(standing(supplier).overdue).join(" + "),
      cell: (supplier) => (
        <div className="tabular-nums">
          {amounts(standing(supplier).overdue).length === 0 ? <span className="text-muted">—</span> : amounts(standing(supplier).overdue).map((line, index) => <p key={line} className={index === 0 ? "font-semibold text-danger" : "text-xs text-muted"}>{line}</p>)}
        </div>
      ),
    },
    {
      key: "notReceived",
      header: tPayables("colNotReceived"),
      align: "right",
      sortable: true,
      value: (supplier) => standing(supplier).notReceived,
      cell: (supplier) => (standing(supplier).notReceived > 0 ? <span className="font-semibold tabular-nums text-warning">{standing(supplier).notReceived}</span> : <span className="text-muted">—</span>),
    },
    // Shown under View: the row's money and what to do come first on a laptop.
    { key: "lastBill", header: t("colLastBill"), defaultHidden: true, sortable: true, value: (supplier) => supplier.lastBillOn ?? "", cell: (supplier) => <span className="whitespace-nowrap">{supplier.lastBillOn ? billDay(supplier.lastBillOn) : "—"}</span> },
    {
      key: "state",
      header: t("colStatus"),
      // The chips say it now: shown only when picked under View.
      defaultHidden: true,
      value: (supplier) => t(supplier.archived ? "chip_archived" : "chip_live"),
      cell: (supplier) => <StatusPill tone={supplier.archived ? "muted" : "success"}>{t(supplier.archived ? "chip_archived" : "chip_live")}</StatusPill>,
    },
    { key: "actions", header: "", align: "right", hideable: false, pin: "end", exportValue: () => "", cell: (supplier) => actions(supplier) },
  ];

  return (
    <>
      {report && (
        <StatusTileRow
          label={t("supplierTilesLabel")}
          active={activeTile}
          onSelect={selectTile}
          tiles={SUPPLIER_TILES.map((tile) => {
            const look = TILE_LOOK[tile];
            const figure = tiles[tile];
            return {
              key: tile,
              icon: look.icon,
              tone: look.tone,
              label: t(`supplierTile_${tile}`),
              count: tile === "archived" ? undefined : t("supplierCount", { count: figure.count }),
              // Waiting: how many bills; archived: nothing to add; the rest: their money, the shop's currency first.
              amount: tile === "waiting" ? tPayables("billCount", { count: figure.bills }) : tile === "archived" ? String(figure.count) : formatMoney(figure.amount[mainCurrency], mainCurrency),
              sub: tile !== "waiting" && figure.amount[other] > 0 ? `+ ${formatMoney(figure.amount[other], other)}` : undefined,
              action: look.action && figure.count > 0 ? t(look.action) : undefined,
              view: tile,
            };
          })}
        />
      )}
      {writable && (
        <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("addSupplier")}
        </Button>
      )}
      <DataGrid
        key={listKey}
        syncUrl
        onViewChange={({ chip }) => setActiveTile(supplierTileOf(chip))}
        rowNumbers
        rows={suppliers}
        getRowId={(supplier) => supplier.id}
        columns={columns}
        searchText={(supplier) => `${supplier.name} ${supplier.phone} ${formatKhmerPhoneLocal(supplier.phone)} ${supplier.note}`}
        searchPlaceholder={t("searchSuppliers")}
        chips={SUPPLIER_TILES.map((tile) => ({ value: tile, label: t(`supplierTile_${tile}`), icon: TILE_LOOK[tile].icon, predicate: (supplier: Supplier) => inTile(tile, supplier, standing(supplier)) }))}
        onRowClick={(supplier) => router.push(supplierHref(supplier))}
        initialSort={{ key: "name", direction: "asc" }}
        defaultPageSize={10}
        renderCard={(supplier) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                <DataGridHighlight text={supplier.name} />
              </p>
              <p className="truncate text-xs text-muted">
                {[supplier.phone ? formatKhmerPhoneLocal(supplier.phone) : "", t("billCount", { count: supplier.purchaseCount }), supplier.lastBillOn ? billDay(supplier.lastBillOn) : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold tabular-nums">{bought(supplier)[0] ?? "—"}</span>
              {owed(supplier)[0] && <span className="text-xs font-semibold tabular-nums text-warning">{t("owedShort", { amount: owed(supplier)[0] })}</span>}
              {amounts(standing(supplier).overdue)[0] && <span className="text-xs font-semibold tabular-nums text-danger">{tPayables("overdueShort", { amount: amounts(standing(supplier).overdue)[0] })}</span>}
              {standing(supplier).notReceived > 0 && <span className="text-xs font-semibold text-warning">{tPayables("notReceivedShort", { count: standing(supplier).notReceived })}</span>}
              {supplier.archived && <StatusPill tone="muted">{t("chip_archived")}</StatusPill>}
            </div>
          </div>
        )}
        // A card opens with a tap already: buttons only when there's something to do.
        renderCardAction={(supplier) => (writable && (owes(supplier) || !supplier.archived) ? <div className="flex justify-end px-4 pb-3">{actions(supplier)}</div> : null)}
        exportFileName="suppliers"
        // "-v6": the status chips (2026-10-29) replace "In use".
        storageKey="seller-suppliers-v6"
        emptyTitle={t("suppliersEmpty")}
        emptyArt={<Mio size={80} />}
      />
      {adding && <SupplierSheet supplier={null} onClose={() => setAdding(false)} onSaved={(supplier) => setSuppliers((current) => [...current, supplier])} />}
    </>
  );
}

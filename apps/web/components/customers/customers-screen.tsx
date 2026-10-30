"use client";

import { CUSTOMER_CHIPS, formatKhmerPhoneLocal, isCustomerChip, LAPSED_AFTER_DAYS, NEW_CUSTOMER_DAYS, RETURNING_MIN_ORDERS, type Currency, type CustomerChip, type ListQuery } from "@khmio/shared";
import { buttonVariants, Mio, PageHeader } from "@khmio/ui";
import { ChartColumn, PhoneCall, Repeat, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CallButton } from "@/components/call-button";
import { DataGrid, DataGridHighlight, type DataGridColumn, type DataGridServer } from "@/components/data-grid";
import { moneyLines } from "@/components/reports/report-money";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { StatusTileRow, type StatusTile } from "@/components/status-tile-row";
import { useDateText } from "@/components/use-date-text";
import type { CustomerRow, CustomerTiles } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { spentLines } from "./spent";

// The shop's customers (design/screens.md S14): a table on a laptop, cards on
// a phone; search by name or phone; sorted by their newest order unless the
// seller picks another column (CUSTOMER_LIST_SPEC in packages/shared
// customers.ts). Read page by page from the API.

export function CustomersScreen({
  server,
  hrefFor,
  mainCurrency,
  rate,
  tiles,
  reportHref,
}: {
  server: DataGridServer<CustomerRow>;
  hrefFor: (customer: CustomerRow) => string;
  mainCurrency: Currency;
  rate: number;
  /** The tiles' figures; null while they load (the list works without them). */
  tiles: CustomerTiles | null;
  reportHref: string;
}) {
  const t = useTranslations("Customers");
  const [activeTile, setActiveTile] = useState<CustomerChip | null>(null);
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const { load } = server;
  const loadPage = useCallback(
    (query: ListQuery) => {
      // The tile the list now shows, whether a tile or the chips set it.
      setActiveTile(isCustomerChip(query.chip) ? query.chip : null);
      return load(query);
    },
    [load],
  );

  function selectTile(view: CustomerChip | null) {
    const search = listAddress(window.location.search.replace(/^\?/, ""), view ? { chip: view } : null);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(view);
    setListKey((key) => key + 1);
  }
  const { timeAgo, date } = useDateText();
  const router = useRouter();
  const spent = (customer: CustomerRow) => spentLines(customer.spent, mainCurrency);
  const lastOrder = (customer: CustomerRow) => (customer.lastOrderAt ? timeAgo(customer.lastOrderAt) : "—");

  const columns: DataGridColumn<CustomerRow>[] = [
    {
      key: "name",
      header: t("colCustomer"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (customer) => customer.name,
      exportValue: (customer) => `${customer.name} (${formatKhmerPhoneLocal(customer.phone)})`,
      cell: (customer) => (
        <div className="flex min-w-0 items-center gap-2">
          <CallButton phone={customer.phone} label={t("callCustomer", { name: customer.name })} />
          <div className="min-w-0">
            <p className="truncate font-medium"><DataGridHighlight text={customer.name} /></p>
            <p className="text-xs text-muted tabular-nums"><DataGridHighlight text={formatKhmerPhoneLocal(customer.phone)} /></p>
          </div>
        </div>
      ),
    },
    {
      key: "orders",
      header: t("colOrders"),
      align: "right",
      sortable: true,
      value: (customer) => customer.orderCount,
      cell: (customer) => <span className="tabular-nums">{customer.orderCount}</span>,
    },
    {
      key: "spent",
      header: t("colSpent"),
      align: "right",
      sortable: true,
      // Sorted in the shop's main currency; dollars and riel are never added together.
      value: (customer) => customer.spent[mainCurrency],
      exportValue: (customer) => spent(customer).join(" + "),
      cell: (customer) => (
        <div className="tabular-nums">
          {spent(customer).map((line, index) => (
            <p key={line} className={index === 0 ? "font-semibold" : "text-xs text-muted"}>{line}</p>
          ))}
        </div>
      ),
    },
    {
      key: "lastOrder",
      header: t("colLastOrder"),
      sortable: true,
      value: (customer) => (customer.lastOrderAt ? Date.parse(customer.lastOrderAt) : 0),
      exportValue: (customer) => date(customer.lastOrderAt),
      cell: (customer) => <span className="whitespace-nowrap">{lastOrder(customer)}</span>,
    },
    {
      key: "since",
      header: t("colSince"),
      sortable: true,
      value: (customer) => Date.parse(customer.createdAt),
      exportValue: (customer) => date(customer.createdAt),
      cell: (customer) => <span className="whitespace-nowrap text-muted">{date(customer.createdAt)}</span>,
    },
  ];

  return (
    <div className={`${SELLER_PAGE} gap-4`}>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href={reportHref} className={buttonVariants({ variant: "secondary" })}>
            <ChartColumn className="h-4 w-4" aria-hidden="true" />
            {t("reportLink")}
          </Link>
        }
      />
      {tiles && <CustomerStatusTiles tiles={tiles} mainCurrency={mainCurrency} rate={rate} active={activeTile} onSelect={selectTile} />}
      <DataGrid
        key={listKey}
        server={{ ...server, load: loadPage }}
        syncUrl
        getRowId={(customer) => customer.id}
        columns={columns}
        searchPlaceholder={t("searchPlaceholder")}
        chips={CUSTOMER_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`) }))}
        onRowClick={(customer) => router.push(hrefFor(customer))}
        initialSort={{ key: "lastOrder", direction: "desc" }}
        defaultPageSize={20}
        renderCard={(customer) => (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex w-full items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold"><DataGridHighlight text={customer.name} /></span>
              <span className="shrink-0 font-semibold tabular-nums">{spent(customer)[0]}</span>
            </p>
            <p className="w-full truncate text-xs text-muted">
              <span className="tabular-nums"><DataGridHighlight text={formatKhmerPhoneLocal(customer.phone)} /></span> · {t("orderCount", { count: customer.orderCount })} · {lastOrder(customer)}
            </p>
          </div>
        )}
        renderCardAside={(customer) => <CallButton phone={customer.phone} label={t("callCustomer", { name: customer.name })} />}
        exportFileName="customers"
        storageKey="seller-customers"
        emptyTitle={t("empty")}
        emptyArt={<Mio size={80} />}
      />
    </div>
  );
}

/**
 * The Customers page's status tiles (design/screens.md S14), over every
 * customer: all of them (and what they've spent) · new · coming back · not
 * back for a while (worth a call). Tapped, the list follows.
 */
function CustomerStatusTiles({ tiles, mainCurrency, rate, active, onSelect }: { tiles: CustomerTiles; mainCurrency: Currency; rate: number; active: CustomerChip | null; onSelect: (view: CustomerChip | null) => void }) {
  const t = useTranslations("Customers");
  const { counts } = tiles;
  const spent = moneyLines(tiles.spent, mainCurrency, null, rate);
  const customers = (count: number) => t("customerCount", { count });
  const row: StatusTile<CustomerChip>[] = [
    { key: "all", icon: Users, tone: "brand", label: t("tileAll"), count: customers(counts.all), amount: spent.main, sub: spent.other ?? t("tileAllHint"), view: null },
    { key: "new", icon: Sparkles, tone: "success", label: t("chip_new"), amount: customers(counts.new), sub: t("tileNewHint", { days: NEW_CUSTOMER_DAYS }), action: counts.new > 0 ? t("tileActionSee") : undefined, view: "new" },
    {
      key: "returning",
      icon: Repeat,
      tone: "info",
      label: t("chip_returning"),
      amount: customers(counts.returning),
      sub: counts.all > 0 ? t("tileReturningHint", { share: Math.round((counts.returning / counts.all) * 100), orders: RETURNING_MIN_ORDERS }) : undefined,
      action: counts.returning > 0 ? t("tileActionSee") : undefined,
      view: "returning",
    },
    { key: "lapsed", icon: PhoneCall, tone: "warning", label: t("chip_lapsed"), amount: customers(counts.lapsed), sub: t("tileLapsedHint", { days: LAPSED_AFTER_DAYS }), action: counts.lapsed > 0 ? t("tileActionCall") : undefined, view: "lapsed" },
  ];
  return <StatusTileRow label={t("tilesLabel")} tiles={row} active={active} onSelect={onSelect} />;
}

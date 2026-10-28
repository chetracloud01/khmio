"use client";

import { formatKhmerPhoneLocal, type Currency } from "@khmio/shared";
import { Mio, PageHeader } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CallButton } from "@/components/call-button";
import { DataGrid, DataGridHighlight, type DataGridColumn, type DataGridServer } from "@/components/data-grid";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { useDateText } from "@/components/use-date-text";
import type { CustomerRow } from "@/lib/api";
import { spentLines } from "./spent";

// The shop's customers (design/screens.md S14): a table on a laptop, cards on
// a phone; search by name or phone; sorted by their newest order unless the
// seller picks another column (CUSTOMER_LIST_SPEC in packages/shared
// customers.ts). Read page by page from the API.

export function CustomersScreen({ server, hrefFor, mainCurrency }: { server: DataGridServer<CustomerRow>; hrefFor: (customer: CustomerRow) => string; mainCurrency: Currency }) {
  const t = useTranslations("Customers");
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
      <PageHeader title={t("title")} description={t("description")} />
      <DataGrid
        server={server}
        syncUrl
        getRowId={(customer) => customer.id}
        columns={columns}
        searchPlaceholder={t("searchPlaceholder")}
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

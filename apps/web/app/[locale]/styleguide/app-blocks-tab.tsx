"use client";

import { fulfilmentSchema, orderStatusSchema } from "@khmio/shared";
import { Card, Input } from "@khmio/ui";
import { Languages, Store, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { FormActions, FormSection, ReadOnlyField } from "@/components/form-ui";
import { MenuList } from "@/components/menu-list";
import { formatMoney, OrderStatusPill } from "@/components/order-ui";
import { PhotoThumb } from "@/components/photo-thumb";
import { buildSampleOrders, type OrderRecord } from "@/mock/mock-orders";
import { Demo, Section } from "./styleguide-ui";

const WAITING = new Set<OrderRecord["status"]>(["awaiting_payment", "cod_pending"]);

/**
 * Parts shared inside the web app (apps/web/components): they use Next.js,
 * translations or Khmio's own data, so they aren't in the kit
 * (design/design-standard.md "Kit or app block").
 */
export function AppBlocksTab() {
  const t = useTranslations("Styleguide");
  const savedShopName = t("detailShopValue");
  const [shopName, setShopName] = useState(savedShopName);
  const dirty = shopName !== savedShopName;
  const orders = useMemo(() => buildSampleOrders(new Date()), []);

  const columns: DataGridColumn<OrderRecord>[] = [
    { key: "order", header: t("gridColOrder"), hideable: false, sortable: true, value: (order) => order.orderNumber, cell: (order) => <span className="font-medium tabular-nums"><DataGridHighlight text={order.orderNumber} /></span> },
    { key: "buyer", header: t("gridColBuyer"), sortable: true, value: (order) => order.name, cell: (order) => <DataGridHighlight text={order.name} /> },
    { key: "status", header: t("gridColStatus"), cell: (order) => <OrderStatusPill order={order} /> },
    { key: "total", header: t("gridColTotal"), align: "right", sortable: true, value: (order) => order.total, cell: (order) => <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span> },
  ];

  return (
    <>
      <p className="max-w-2xl text-sm text-muted">{t("appBlocksIntro")}</p>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title={t("menuSection")}>
          {/* Rows as data: My shop and any settings list. */}
          <Demo name="MenuList">
            <MenuList
              title={t("menuTitle")}
              rows={[
                { key: "store", href: "#", icon: Store, tone: "brand", title: t("menuShop"), detail: t("menuShopDetail") },
                { key: "delivery", href: "#", icon: Truck, tone: "info", title: t("menuDelivery"), detail: t("menuDeliveryDetail") },
                { key: "language", href: "#", icon: Languages, tone: "success", title: t("menuLanguage"), value: "English" },
              ]}
            />
          </Demo>
        </Section>

        <Section title={t("orderSection")}>
          {/* One wording, colour and icon per status (design/design-standard.md §7). */}
          <Demo name="OrderStatusPill" className="flex-row flex-wrap gap-2">
            {orderStatusSchema.options.map((status) => (
              <OrderStatusPill key={status} order={{ status, fulfilment: fulfilmentSchema.enum.delivery }} />
            ))}
          </Demo>
          <Demo name="PhotoThumb" className="flex-row">
            <PhotoThumb photo={{ key: "sample", url: "/icons/icon-512.png", thumbUrl: "/icons/icon-192.png" }} className="h-16 w-16 rounded-full object-cover" />
          </Demo>
        </Section>
      </div>

      <Section title={t("formSection")} description={t("formHint")}>
        <Demo name={["FormSection", "ReadOnlyField", "FormActions"]}>
          <Card className="flex flex-col p-4 md:p-6">
            <FormSection title={t("formShopTitle")} description={t("formShopHint")}>
              <Input label={t("detailShop")} value={shopName} onChange={(event) => setShopName(event.target.value)} />
              <ReadOnlyField label={t("formLinkLabel")} value="khmio.com/s/sokha-coffee" hint={t("formLinkHint")} />
            </FormSection>
            <FormActions
              dirty={dirty}
              onCancel={() => setShopName(savedShopName)}
              onSave={() => setShopName(savedShopName)}
              saveLabel={t("formSave")}
              cancelLabel={t("buttonSecondary")}
              status={dirty ? t("formUnsaved") : t("formSaved")}
              className="static mx-0 px-0 md:mx-0 md:px-0"
            />
          </Card>
        </Demo>
      </Section>

      <Section title={t("gridSection")} description={t("gridHint")}>
        <Demo name={["DataGrid", "DataGridHighlight"]}>
          <DataGrid
            rows={orders}
            getRowId={(order) => order.orderNumber}
            columns={columns}
            searchText={(order) => `${order.orderNumber} ${order.name}`}
            searchPlaceholder={t("gridSearch")}
            chips={[{ value: "waiting", label: t("tone_warning"), predicate: (order: OrderRecord) => WAITING.has(order.status) }]}
            initialSort={{ key: "order", direction: "desc" }}
            renderCard={(order) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium tabular-nums">{order.orderNumber}</span>
                  <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted">
                  <span className="min-w-0 truncate">{order.name}</span>
                  <OrderStatusPill order={order} />
                </div>
              </div>
            )}
            exportFileName="styleguide-orders"
            rowNumbers
          />
        </Demo>
      </Section>
    </>
  );
}

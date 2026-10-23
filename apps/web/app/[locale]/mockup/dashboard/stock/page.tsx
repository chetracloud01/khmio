"use client";

import {
  getMinimumPlanFor,
  LOW_STOCK_THRESHOLD,
  parseQuantityInput,
  planHasFeature,
  stockAdjustmentReasonSchema,
  stockLocationInputSchema,
  stockMovementInputSchema,
  stockMovementSign,
  stockTransferInputSchema,
  toFieldErrors,
  type FormErrorCode,
  type StockAdjustmentReason,
} from "@khmio/shared";
import { BottomSheet, Button, Card, Input, SegmentedControl, Select } from "@khmio/ui";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MockStockLocationType, MockStockTransaction } from "@/mock/mock-data";
import { useMerchantInventory } from "../../merchant-inventory-context";
import { useMerchantProducts } from "../../merchant-products-context";
import { useMerchantSubscription } from "../../merchant-subscription-context";
import { useOnlineStock } from "../../online-stock";
import { DataGrid } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { useDateText } from "@/components/use-date-text";
import { UpgradePrompt } from "../upgrade-prompt";

type SheetMode = "purchase" | "sale" | "transfer" | "adjust" | null;
type SheetField = "quantity" | "note" | "to" | "reason";

interface LocationOption {
  type: MockStockLocationType;
  id: string;
  label: string;
}

const locationKey = (location: Pick<LocationOption, "type" | "id">) => `${location.type}::${location.id}`;


// Free/Basic: locked. Pro: one stock number per product, kept at the main
// branch. Advance: every warehouse and branch. All plans share one ledger, so
// upgrading or downgrading never loses stock history — it only shows or
// hides locations (see docs/blueprint.md "Subscription tiers").
export default function DashboardStockMockupPage() {
  const t = useTranslations("Stock");
  const tUp = useTranslations("Upgrade");
  const { hydrated: subscriptionReady, subscription } = useMerchantSubscription();
  const { hydrated: productsReady } = useMerchantProducts();
  const { hydrated: inventoryReady } = useMerchantInventory();

  if (!subscriptionReady || !productsReady || !inventoryReady) return null;

  if (!planHasFeature(subscription.plan, "stock")) {
    return (
      <div className="mx-auto flex max-w-[960px] flex-col gap-5 p-4 text-fg">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <UpgradePrompt title={tUp("stockTitle")} body={tUp("stockBody")} plan={getMinimumPlanFor("stock")} />
      </div>
    );
  }

  return <StockScreen multiLocation={planHasFeature(subscription.plan, "warehouses")} />;
}

function StockScreen({ multiLocation }: { multiLocation: boolean }) {
  const t = useTranslations("Stock");
  const tUp = useTranslations("Upgrade");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const { products } = useMerchantProducts();
  const { warehouses, addWarehouse, branches, addBranch, transactions, recordTransaction, recordTransfer } =
    useMerchantInventory();
  const { location: onlineLocation } = useOnlineStock();

  const [addingWarehouse, setAddingWarehouse] = useState(false);
  const [newWarehouseKm, setNewWarehouseKm] = useState("");
  const [newWarehouseEn, setNewWarehouseEn] = useState("");

  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchKm, setNewBranchKm] = useState("");
  const [newBranchEn, setNewBranchEn] = useState("");
  const [newBranchWarehouseId, setNewBranchWarehouseId] = useState(warehouses[0]?.id ?? "");

  const locationOptions: LocationOption[] = useMemo(
    () => [
      ...warehouses.map((warehouse) => ({
        type: "warehouse" as const,
        id: warehouse.id,
        label: `${t("warehouseTag")}: ${locale === "km" ? warehouse.nameKm : warehouse.nameEn}`,
      })),
      ...branches.map((branch) => ({
        type: "branch" as const,
        id: branch.id,
        label: `${t("branchTag")}: ${locale === "km" ? branch.nameKm : branch.nameEn}`,
      })),
    ],
    [warehouses, branches, locale, t],
  );

  const [selectedLocationKey, setSelectedLocationKey] = useState(() =>
    locationOptions[0] ? locationKey(locationOptions[0]) : "",
  );
  const mainBranch = locationOptions.find((option) => option.type === "branch") ?? locationOptions[0];
  const selectedLocation = multiLocation
    ? (locationOptions.find((option) => locationKey(option) === selectedLocationKey) ?? locationOptions[0])
    : mainBranch;
  const transferTargets = locationOptions.filter(
    (option) => !selectedLocation || locationKey(option) !== locationKey(selectedLocation),
  );

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [formProductId, setFormProductId] = useState("");
  const [formVariantId, setFormVariantId] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formNote, setFormNote] = useState("");
  const [transferToKey, setTransferToKey] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"in" | "out">("out");
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>("count_correction");
  const [sheetErrors, setSheetErrors] = useState<Partial<Record<SheetField, string>>>({});

  const formProduct = products.find((product) => product.id === formProductId);

  /** Quantity on hand at one location: the sum of its ledger. */
  function getStockAt(location: Pick<LocationOption, "type" | "id"> | undefined, productId: string, variantId?: string) {
    if (!location) return 0;
    return transactions.reduce((sum, tx) => {
      if (tx.productId !== productId) return sum;
      if ((tx.variantId ?? null) !== (variantId ?? null)) return sum;
      if (tx.locationType !== location.type || tx.locationId !== location.id) return sum;
      return sum + stockMovementSign(tx.type) * tx.quantity;
    }, 0);
  }

  function getStockFor(productId: string, variantId?: string) {
    return getStockAt(selectedLocation, productId, variantId);
  }

  const stockRows = products.flatMap((product) => {
    const title = locale === "km" ? product.titleKm : product.titleEn;
    if (product.variants?.length) {
      return product.variants.map((variant) => ({
        key: `${product.id}::${variant.id}`,
        label: `${title} — ${locale === "km" ? variant.labelKm : variant.labelEn}`,
        qty: getStockFor(product.id, variant.id),
      }));
    }
    return [{ key: product.id, label: title, qty: getStockFor(product.id) }];
  });

  // Low = 5 or fewer left: enough warning to reorder before it runs out.
  function stockLevel(qty: number): "out" | "low" | "ok" {
    if (qty <= 0) return "out";
    return qty <= LOW_STOCK_THRESHOLD ? "low" : "ok";
  }

  function stockPill(qty: number) {
    const level = stockLevel(qty);
    const styles = { out: "bg-danger/10 text-danger", low: "bg-warning/10 text-warning", ok: "bg-success/10 text-success" };
    const labels = { out: t("levelOut"), low: t("levelLow"), ok: t("levelOk") };
    return (
      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${styles[level]}`}>
        {labels[level]}
      </span>
    );
  }

  /** Khmer name required, English optional (falls back to the Khmer one). */
  function parseLocationName(nameKm: string, nameEn: string) {
    const result = stockLocationInputSchema.safeParse({ nameKm, nameEn });
    if (!result.success) return null;
    return { nameKm: result.data.nameKm, nameEn: result.data.nameEn || result.data.nameKm };
  }

  function handleAddWarehouse() {
    const names = parseLocationName(newWarehouseKm, newWarehouseEn);
    if (!names) return;
    addWarehouse({ id: `wh-${Date.now()}`, ...names });
    setNewWarehouseKm("");
    setNewWarehouseEn("");
    setAddingWarehouse(false);
  }

  function handleAddBranch() {
    const names = parseLocationName(newBranchKm, newBranchEn);
    if (!names || !newBranchWarehouseId) return;
    addBranch({ id: `br-${Date.now()}`, ...names, warehouseId: newBranchWarehouseId });
    setNewBranchKm("");
    setNewBranchEn("");
    setAddingBranch(false);
  }

  function openSheet(mode: SheetMode) {
    setSheetMode(mode);
    setFormProductId(products[0]?.id ?? "");
    setFormVariantId(products[0]?.variants?.[0]?.id ?? "");
    setFormQuantity("");
    setFormNote("");
    setTransferToKey(transferTargets[0] ? locationKey(transferTargets[0]) : "");
    setAdjustDirection("out");
    setAdjustReason("count_correction");
    setSheetErrors({});
  }

  function handleProductChange(productId: string) {
    setFormProductId(productId);
    const product = products.find((p) => p.id === productId);
    setFormVariantId(product?.variants?.[0]?.id ?? "");
  }

  /** Schema problems → a message under the matching field in the sheet. */
  function showSchemaErrors(errors: Record<string, FormErrorCode>) {
    setSheetErrors({
      quantity: errorText(errors.quantity),
      note: errorText(errors.note),
      reason: errorText(errors.reason),
      to: errorText(errors.to ?? errors["to.id"]),
    });
  }

  // Stock can never go below zero: a sale, a transfer out or a removal needs enough on hand.
  function blockIfShort(quantity: number, productId: string, variantId?: string): boolean {
    const available = getStockFor(productId, variantId);
    if (quantity <= available) return false;
    setSheetErrors({ quantity: t("insufficientStock", { count: available }) });
    return true;
  }

  // The same schemas the API checks stock changes with (packages/shared stock.ts).
  function handleSubmitTransaction() {
    if (!sheetMode || !selectedLocation) return;
    const item = {
      productId: formProductId,
      variantId: formVariantId || undefined,
      quantity: parseQuantityInput(formQuantity),
      note: formNote.trim() || undefined,
    };

    if (sheetMode === "transfer") {
      const to = transferTargets.find((option) => locationKey(option) === transferToKey);
      const result = stockTransferInputSchema.safeParse({
        ...item,
        from: { type: selectedLocation.type, id: selectedLocation.id },
        to: to ? { type: to.type, id: to.id } : { type: "branch", id: "" },
      });
      if (!result.success) return showSchemaErrors(toFieldErrors(result.error));
      if (blockIfShort(result.data.quantity, result.data.productId, result.data.variantId)) return;
      recordTransfer(result.data);
      setSheetMode(null);
      return;
    }

    const type = sheetMode === "adjust" ? (adjustDirection === "in" ? "adjust_in" : "adjust_out") : sheetMode;
    const result = stockMovementInputSchema.safeParse({
      ...item,
      type,
      locationType: selectedLocation.type,
      locationId: selectedLocation.id,
      reason: sheetMode === "adjust" ? adjustReason : undefined,
    });
    if (!result.success) return showSchemaErrors(toFieldErrors(result.error));
    const movement = result.data;
    if (stockMovementSign(movement.type) < 0 && blockIfShort(movement.quantity, movement.productId, movement.variantId)) {
      return;
    }
    recordTransaction(movement);
    setSheetMode(null);
  }

  function locationLabel(type: MockStockLocationType, id: string) {
    return locationOptions.find((option) => option.type === type && option.id === id)?.label ?? id;
  }

  /** "Purchase", "Transfer → Branch: Main", "Correction · Damaged"… for the activity list. */
  function movementLabel(tx: MockStockTransaction) {
    if (tx.type === "transfer_out" || tx.type === "transfer_in") {
      const other = transactions.find((row) => row.transferId === tx.transferId && row.id !== tx.id);
      const where = other ? locationLabel(other.locationType, other.locationId) : "";
      return tx.type === "transfer_out" ? t("transferredTo", { location: where }) : t("transferredFrom", { location: where });
    }
    if (tx.type === "adjust_in" || tx.type === "adjust_out") {
      return tx.reason ? `${t("typeAdjust")} · ${t(`reason_${tx.reason}`)}` : t("typeAdjust");
    }
    return tx.type === "purchase" ? t("typePurchase") : t("typeSale");
  }

  const sheetTitle = {
    purchase: t("recordPurchase"),
    sale: t("recordSale"),
    transfer: t("recordTransfer"),
    adjust: t("recordAdjustment"),
  };
  const submitLabel = {
    purchase: t("submitPurchase"),
    sale: t("submitSale"),
    transfer: t("submitTransfer"),
    adjust: t("submitAdjustment"),
  };

  const { ago: timeAgoLabel } = useDateText();

  const locationTransactions = selectedLocation
    ? transactions
        .filter((tx) => tx.locationType === selectedLocation.type && tx.locationId === selectedLocation.id)
        .sort((a, b) => a.minutesAgo - b.minutesAgo)
        .slice(0, 10)
    : [];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 p-4 text-fg">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      {multiLocation ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t("warehousesTitle")}</p>
                <Button variant="secondary" onClick={() => setAddingWarehouse((v) => !v)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("addWarehouse")}
                </Button>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {warehouses.map((warehouse) => (
                  <li key={warehouse.id} className="text-muted">
                    {locale === "km" ? warehouse.nameKm : warehouse.nameEn}
                  </li>
                ))}
              </ul>
              {addingWarehouse && (
                <div className="flex flex-col gap-2 rounded-DEFAULT border border-dashed border-border p-3">
                  <Input label={t("nameKmLabel")} value={newWarehouseKm} onChange={(e) => setNewWarehouseKm(e.target.value)} />
                  <Input label={t("nameEnLabel")} value={newWarehouseEn} onChange={(e) => setNewWarehouseEn(e.target.value)} />
                  <Button
                    variant="primary"
                    onClick={handleAddWarehouse}
                    disabled={!parseLocationName(newWarehouseKm, newWarehouseEn)}
                  >
                    {t("addWarehouse")}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t("branchesTitle")}</p>
                <Button variant="secondary" onClick={() => setAddingBranch((v) => !v)} disabled={!warehouses.length}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("addBranch")}
                </Button>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {branches.map((branch) => {
                  const warehouse = warehouses.find((w) => w.id === branch.warehouseId);
                  return (
                    <li key={branch.id} className="text-muted">
                      {locale === "km" ? branch.nameKm : branch.nameEn}
                      {warehouse && (
                        <span className="text-xs">
                          {" "}
                          · {t("suppliedBy")} {locale === "km" ? warehouse.nameKm : warehouse.nameEn}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {addingBranch && (
                <div className="flex flex-col gap-2 rounded-DEFAULT border border-dashed border-border p-3">
                  <Input label={t("nameKmLabel")} value={newBranchKm} onChange={(e) => setNewBranchKm(e.target.value)} />
                  <Input label={t("nameEnLabel")} value={newBranchEn} onChange={(e) => setNewBranchEn(e.target.value)} />
                  <Select
                    label={t("supplyingWarehouseLabel")}
                    value={newBranchWarehouseId}
                    onChange={(e) => setNewBranchWarehouseId(e.target.value)}
                    options={warehouses.map((warehouse) => ({
                      value: warehouse.id,
                      label: locale === "km" ? warehouse.nameKm : warehouse.nameEn,
                    }))}
                  />
                  <Button
                    variant="primary"
                    onClick={handleAddBranch}
                    disabled={!parseLocationName(newBranchKm, newBranchEn) || !newBranchWarehouseId}
                  >
                    {t("addBranch")}
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <Select
            label={t("viewStockAt")}
            value={selectedLocationKey}
            onChange={(e) => setSelectedLocationKey(e.target.value)}
            options={locationOptions.map((option) => ({
              value: `${option.type}::${option.id}`,
              label: option.label,
            }))}
          />
          {onlineLocation && (
            <p className="-mt-3 text-xs text-muted">
              {t("onlineSellsFrom", { location: locationLabel(onlineLocation.type, onlineLocation.id) })}{" "}
              <Link href={`/${locale}/mockup/dashboard/profile#prices`} className="font-medium text-brand underline-offset-2 hover:underline">
                {t("change")}
              </Link>
            </p>
          )}
        </>
      ) : (
        <UpgradePrompt compact title={tUp("warehousesTitle")} plan={getMinimumPlanFor("warehouses")} />
      )}

      <div className={`grid grid-cols-2 gap-3 ${multiLocation ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Button variant="secondary" onClick={() => openSheet("purchase")} className="w-full">
          <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("typePurchase")}
        </Button>
        <Button variant="secondary" onClick={() => openSheet("sale")} className="w-full">
          <ArrowUpFromLine className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("typeSale")}
        </Button>
        {/* Moving stock needs somewhere to move it to — Advance, with 2+ locations. */}
        {multiLocation && (
          <Button variant="secondary" onClick={() => openSheet("transfer")} disabled={!transferTargets.length} className="w-full">
            <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("recordTransfer")}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => openSheet("adjust")}
          className={`w-full ${multiLocation ? "" : "col-span-2 lg:col-span-1"}`}
        >
          <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("recordAdjustment")}
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("stockLevelsTitle")}</h2>
        <DataGrid
          rows={stockRows}
          getRowId={(row) => row.key}
          columns={[
            { key: "item", header: t("colItem"), hideable: false, sortable: true, value: (row) => row.label, cell: (row) => row.label },
            {
              key: "status",
              header: t("colStatus"),
              sortable: true,
              value: (row) => stockLevel(row.qty),
              cell: (row) => stockPill(row.qty),
            },
            {
              key: "qty",
              header: t("colQuantity"),
              align: "right",
              sortable: true,
              value: (row) => row.qty,
              cell: (row) => <span className="font-semibold">{row.qty}</span>,
            },
          ]}
          searchText={(row) => row.label}
          searchPlaceholder={t("searchItems")}
          chips={[
            { value: "low", label: t("levelLow"), predicate: (row) => stockLevel(row.qty) === "low" },
            { value: "out", label: t("levelOut"), predicate: (row) => stockLevel(row.qty) === "out" },
          ]}
          renderCard={(row) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <div className="mt-1">{stockPill(row.qty)}</div>
              </div>
              <span className="shrink-0 text-lg font-semibold tabular-nums">{row.qty}</span>
            </div>
          )}
          exportFileName="stock-levels"
          storageKey="merchant-stock-levels"
          emptyTitle={t("noProductsYet")}
        />
      </section>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("recentActivity")}</p>
        {locationTransactions.length === 0 ? (
          <p className="text-sm text-muted">{t("noActivityYet")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {locationTransactions.map((tx) => {
              const product = products.find((p) => p.id === tx.productId);
              const variant = product?.variants?.find((v) => v.id === tx.variantId);
              const title = product ? (locale === "km" ? product.titleKm : product.titleEn) : tx.productId;
              const variantLabel = variant ? ` — ${locale === "km" ? variant.labelKm : variant.labelEn}` : "";
              const adds = stockMovementSign(tx.type) > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {title}
                      {variantLabel}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {movementLabel(tx)} · {timeAgoLabel(tx.minutesAgo)}
                    </p>
                  </div>
                  <span className={`shrink-0 font-semibold tabular-nums ${adds ? "text-success" : "text-danger"}`}>
                    {adds ? "+" : "−"}
                    {tx.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <BottomSheet
        open={sheetMode !== null}
        onClose={() => setSheetMode(null)}
        closeLabel={t("cancel")}
        title={sheetMode ? sheetTitle[sheetMode] : undefined}
      >
        <div className="flex flex-col gap-3">
          {selectedLocation && (
            <p className="text-sm text-muted">
              {sheetMode === "transfer" ? t("transferFromLabel") : t("atLocation")}:{" "}
              <span className="font-medium text-fg">{selectedLocation.label}</span>
            </p>
          )}
          {sheetMode === "transfer" && (
            <Select
              label={t("transferToLabel")}
              value={transferToKey}
              onChange={(e) => {
                setTransferToKey(e.target.value);
                setSheetErrors((prev) => ({ ...prev, to: undefined }));
              }}
              options={transferTargets.map((option) => ({ value: locationKey(option), label: option.label }))}
              error={sheetErrors.to}
            />
          )}
          {sheetMode === "adjust" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg">{t("adjustDirectionLabel")}</span>
                <SegmentedControl
                  value={adjustDirection}
                  onChange={(next) => setAdjustDirection(next === "in" ? "in" : "out")}
                  options={[
                    { value: "out", label: t("adjustRemove") },
                    { value: "in", label: t("adjustAdd") },
                  ]}
                />
              </div>
              <Select
                label={t("reasonLabel")}
                value={adjustReason}
                onChange={(e) => {
                  const parsed = stockAdjustmentReasonSchema.safeParse(e.target.value);
                  if (parsed.success) setAdjustReason(parsed.data);
                  setSheetErrors((prev) => ({ ...prev, reason: undefined, note: undefined }));
                }}
                options={stockAdjustmentReasonSchema.options.map((value) => ({ value, label: t(`reason_${value}`) }))}
                error={sheetErrors.reason}
              />
            </>
          )}
          <Select
            label={t("productLabel")}
            value={formProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            options={products.map((product) => ({
              value: product.id,
              label: locale === "km" ? product.titleKm : product.titleEn,
            }))}
          />
          {formProduct?.variants?.length ? (
            <Select
              label={t("variantLabel")}
              value={formVariantId}
              onChange={(e) => setFormVariantId(e.target.value)}
              options={formProduct.variants.map((variant) => ({
                value: variant.id,
                label: locale === "km" ? variant.labelKm : variant.labelEn,
              }))}
            />
          ) : null}
          <Input
            label={t("quantityLabel")}
            inputMode="numeric"
            value={formQuantity}
            onChange={(e) => {
              setFormQuantity(e.target.value);
              setSheetErrors((prev) => ({ ...prev, quantity: undefined }));
            }}
            error={sheetErrors.quantity}
          />
          <Input
            label={sheetMode === "adjust" && adjustReason === "other" ? t("noteRequiredLabel") : t("noteLabel")}
            placeholder={t("notePlaceholder")}
            maxLength={200}
            value={formNote}
            onChange={(e) => {
              setFormNote(e.target.value);
              setSheetErrors((prev) => ({ ...prev, note: undefined }));
            }}
            error={sheetErrors.note}
          />
          <Button variant="primary" onClick={handleSubmitTransaction} className="w-full">
            {sheetMode ? submitLabel[sheetMode] : null}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

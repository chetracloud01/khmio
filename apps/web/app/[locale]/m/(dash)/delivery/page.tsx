"use client";

import {
  deliverySettingsSchema,
  formatKhmerPhoneLocal,
  khrInputText,
  MAX_DELIVERY_ZONES,
  parseKhrInput,
  parseUsdInput,
  PHNOM_PENH_DISTRICTS,
  placeName,
  SUGGESTED_DELIVERY_SETTINGS,
  toFieldErrors,
  usdInputText,
  type DeliverySettings,
  type FormErrorCode,
} from "@khmio/shared";
import { Button, Card, cn, Input, MoneyInput, Notice, Select, Switch } from "@khmio/ui";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { SELLER_FORM_BAR } from "@/components/seller-frame/seller-frame";
import { api, ApiError, type DeliveryResponse } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";
import { SubPage } from "@/components/seller-frame/sub-page";

interface ZoneDraft {
  id: string;
  name: string;
  feeUsd: string;
  feeKhr: string;
  districtIds: string[];
}

interface DriverDraft {
  id: string;
  name: string;
  phone: string;
  kind: "own" | "partner";
}

interface Draft {
  zones: ZoneDraft[];
  pickup: { enabled: boolean; address: string; hours: string };
  province: { enabled: boolean; feeUsd: string; feeKhr: string; note: string };
  drivers: DriverDraft[];
}


function toDraft(settings: DeliverySettings): Draft {
  return {
    zones: settings.zones.map((zone) => ({ id: zone.id, name: zone.name, feeUsd: usdInputText(zone.feeUsdCents), feeKhr: khrInputText(zone.feeKhr), districtIds: zone.districtIds })),
    pickup: settings.pickup,
    province: { enabled: settings.province.enabled, feeUsd: usdInputText(settings.province.feeUsdCents), feeKhr: khrInputText(settings.province.feeKhr), note: settings.province.note },
    drivers: settings.drivers.map((driver) => ({ ...driver, phone: formatKhmerPhoneLocal(driver.phone) })),
  };
}

function toInput(draft: Draft) {
  return {
    zones: draft.zones.map((zone) => ({ id: zone.id, name: zone.name, districtIds: zone.districtIds, feeUsdCents: parseUsdInput(zone.feeUsd), feeKhr: parseKhrInput(zone.feeKhr) })),
    pickup: draft.pickup,
    province: { enabled: draft.province.enabled, note: draft.province.note, feeUsdCents: parseUsdInput(draft.province.feeUsd), feeKhr: parseKhrInput(draft.province.feeKhr) },
    drivers: draft.drivers,
  };
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * A shop that has never saved its delivery starts from the suggestion
 * (packages/shared SUGGESTED_DELIVERY_SETTINGS). Buyers usually come to a
 * salon or a repair shop, so a service shop starts with pickup on.
 */
function startingSettings(response: DeliveryResponse, isService: boolean): DeliverySettings {
  if (response.configured) return response.settings;
  return { ...SUGGESTED_DELIVERY_SETTINGS, pickup: { ...SUGGESTED_DELIVERY_SETTINGS.pickup, enabled: isService } };
}

export default function DeliveryPage() {
  const { store } = useMerchant();
  const [response, setResponse] = useState<DeliveryResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api<DeliveryResponse>("/delivery").then(setResponse, () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  if (failed) return <PageOffline onRetry={load} />;
  if (!response) return <PageLoading />;
  return <DeliveryForm initial={startingSettings(response, store.businessType === "service")} configured={response.configured} />;
}

// The standard form (components/form-ui.tsx) over deliverySettingsSchema — the
// same check PUT /delivery runs. What's saved here decides what checkout offers.
function DeliveryForm({ initial, configured: initiallyConfigured }: { initial: DeliverySettings; configured: boolean }) {
  const t = useTranslations("Delivery");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const { refreshStore } = useMerchant();
  const formRef = useRef<HTMLDivElement>(null);

  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [configured, setConfigured] = useState(initiallyConfigured);
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const error = (key: string) => errorText(errors[key]);

  /** Any edit clears the messages it could affect; Save checks everything again. */
  function change(next: Draft, ...cleared: string[]) {
    setDraft(next);
    setJustSaved(false);
    setSaveError(null);
    if (cleared.some((key) => errors[key])) {
      setErrors((previous) => {
        const rest = { ...previous };
        for (const key of cleared) delete rest[key];
        return rest;
      });
    }
  }

  function updateZone(index: number, patch: Partial<ZoneDraft>, field: string) {
    change({ ...draft, zones: draft.zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)) }, `zones.${index}.${field}`);
  }

  /** A district belongs to one zone: choosing it here takes it out of any other. */
  function toggleDistrict(index: number, districtId: string) {
    const selected = draft.zones[index]?.districtIds.includes(districtId);
    const zones = draft.zones.map((zone, i) => ({
      ...zone,
      districtIds:
        i === index
          ? selected
            ? zone.districtIds.filter((id) => id !== districtId)
            : [...zone.districtIds, districtId]
          : zone.districtIds.filter((id) => id !== districtId),
    }));
    change({ ...draft, zones }, ...draft.zones.map((_, i) => `zones.${i}.districtIds`), "zones");
  }

  function updateDriver(index: number, patch: Partial<DriverDraft>, field: string) {
    change({ ...draft, drivers: draft.drivers.map((driver, i) => (i === index ? { ...driver, ...patch } : driver)) }, `drivers.${index}.${field}`);
  }

  async function handleSave() {
    const result = deliverySettingsSchema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = await api<DeliveryResponse>("/delivery", { method: "PUT", body: result.data });
      const nextDraft = toDraft(next.settings);
      setSaved(nextDraft);
      setDraft(nextDraft);
      setConfigured(next.configured);
      setErrors({});
      setJustSaved(true);
      await refreshStore().catch(() => undefined);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields as Record<string, FormErrorCode>);
        focusFirstInvalidField(formRef.current);
      } else {
        setSaveError(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  const zoneOf = (districtId: string) => draft.zones.findIndex((zone) => zone.districtIds.includes(districtId));
  const notCovered = PHNOM_PENH_DISTRICTS.filter((place) => zoneOf(place.id) === -1);
  const status = dirty ? t("unsavedChanges") : justSaved ? t("saved") : undefined;

  const feeInputs = (usd: string, khr: string, onUsd: (value: string) => void, onKhr: (value: string) => void, usdKey: string, khrKey: string) => (
    <MoneyInput
      usd={usd}
      khr={khr}
      onUsdChange={onUsd}
      onKhrChange={onKhr}
      usdLabel={t("feeUsd")}
      khrLabel={t("feeKhr")}
      usdPlaceholder="1.00"
      khrPlaceholder="4000"
      usdError={error(usdKey)}
      khrError={error(khrKey)}
    />
  );

  return (
    <SubPage ref={formRef} title={t("title")} description={t("description")}>

      {!configured && (
        <p role="status" className="rounded-DEFAULT border border-info/40 bg-info/5 p-3 text-sm">
          {tApp("deliverySuggested")}
        </p>
      )}

      <Card className="flex flex-col p-4">
        <FormSection stacked title={t("sectionZones")} description={t("sectionZonesHelp")}>
          {errors.zones && (
            <Notice tone="danger" role="alert">
              {error("zones")}
            </Notice>
          )}

          {draft.zones.map((zone, index) => (
            <div key={zone.id} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    label={t("zoneName")}
                    placeholder={t("zoneNamePlaceholder")}
                    value={zone.name}
                    onChange={(e) => updateZone(index, { name: e.target.value }, "name")}
                    error={error(`zones.${index}.name`)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Messages are keyed by position, so they'd point at the wrong zone now.
                    setErrors({});
                    change({ ...draft, zones: draft.zones.filter((_, i) => i !== index) });
                  }}
                  aria-label={t("removeZone")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-DEFAULT text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {feeInputs(
                zone.feeUsd,
                zone.feeKhr,
                (value) => updateZone(index, { feeUsd: value }, "feeUsdCents"),
                (value) => updateZone(index, { feeKhr: value }, "feeKhr"),
                `zones.${index}.feeUsdCents`,
                `zones.${index}.feeKhr`,
              )}

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("zoneDistricts")}</legend>
                <div className="flex flex-wrap gap-2" data-invalid={errors[`zones.${index}.districtIds`] ? "true" : undefined} tabIndex={-1}>
                  {PHNOM_PENH_DISTRICTS.map((place) => {
                    const owner = zoneOf(place.id);
                    const mine = owner === index;
                    const elsewhere = owner !== -1 && !mine;
                    return (
                      <button
                        key={place.id}
                        type="button"
                        aria-pressed={mine}
                        onClick={() => toggleDistrict(index, place.id)}
                        title={elsewhere ? t("inOtherZone", { zone: draft.zones[owner]?.name || t("unnamedZone") }) : undefined}
                        className={cn(
                          "min-h-touch rounded-full border px-3 text-sm font-medium transition-colors",
                          mine ? "border-brand bg-brand text-on-brand" : elsewhere ? "border-border bg-border/20 text-muted" : "border-border bg-bg text-fg hover:bg-border/10",
                        )}
                      >
                        {placeName(place, locale)}
                      </button>
                    );
                  })}
                </div>
                {errors[`zones.${index}.districtIds`] && <p className="text-sm text-danger">{error(`zones.${index}.districtIds`)}</p>}
              </fieldset>
            </div>
          ))}

          <Button
            variant="secondary"
            onClick={() => change({ ...draft, zones: [...draft.zones, { id: newId("zone"), name: "", feeUsd: "", feeKhr: "", districtIds: [] }] }, "zones")}
            disabled={draft.zones.length >= MAX_DELIVERY_ZONES}
            className="self-start"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addZone")}
          </Button>

          <p className="text-sm text-muted">
            {notCovered.length === 0 ? t("allCovered") : t("notCovered", { districts: notCovered.map((place) => placeName(place, locale)).join(", ") })}
          </p>
          <p className="text-sm text-muted">{t("feeHint")}</p>
        </FormSection>

        <FormSection stacked title={t("sectionPickup")} description={t("sectionPickupHelp")}>
          <Switch checked={draft.pickup.enabled} onChange={(enabled) => change({ ...draft, pickup: { ...draft.pickup, enabled } }, "pickup.address", "zones")} label={t("pickupEnabled")} />
          {draft.pickup.enabled && (
            <>
              <Input
                label={t("pickupAddress")}
                placeholder={t("pickupAddressPlaceholder")}
                maxLength={200}
                value={draft.pickup.address}
                onChange={(e) => change({ ...draft, pickup: { ...draft.pickup, address: e.target.value } }, "pickup.address")}
                error={error("pickup.address")}
              />
              <Input
                label={t("pickupHours")}
                placeholder={t("pickupHoursPlaceholder")}
                maxLength={100}
                value={draft.pickup.hours}
                onChange={(e) => change({ ...draft, pickup: { ...draft.pickup, hours: e.target.value } }, "pickup.hours")}
                error={error("pickup.hours")}
              />
            </>
          )}
        </FormSection>

        <FormSection stacked title={t("sectionProvince")} description={t("sectionProvinceHelp")}>
          <Switch checked={draft.province.enabled} onChange={(enabled) => change({ ...draft, province: { ...draft.province, enabled } }, "zones")} label={t("provinceEnabled")} />
          {draft.province.enabled && (
            <>
              {feeInputs(
                draft.province.feeUsd,
                draft.province.feeKhr,
                (value) => change({ ...draft, province: { ...draft.province, feeUsd: value } }, "province.feeUsdCents"),
                (value) => change({ ...draft, province: { ...draft.province, feeKhr: value } }, "province.feeKhr"),
                "province.feeUsdCents",
                "province.feeKhr",
              )}
              <Input
                label={t("provinceNote")}
                placeholder={t("provinceNotePlaceholder")}
                maxLength={200}
                value={draft.province.note}
                onChange={(e) => change({ ...draft, province: { ...draft.province, note: e.target.value } }, "province.note")}
                error={error("province.note")}
              />
            </>
          )}
        </FormSection>

        <FormSection stacked title={t("sectionDrivers")} description={t("sectionDriversHelp")}>
          {draft.drivers.length === 0 && <p className="text-sm text-muted">{t("noDrivers")}</p>}
          {draft.drivers.map((driver, index) => (
            <div key={driver.id} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t("driverName")} autoComplete="off" value={driver.name} onChange={(e) => updateDriver(index, { name: e.target.value }, "name")} error={error(`drivers.${index}.name`)} />
                <Input
                  label={t("driverPhone")}
                  prefix="+855"
                  inputMode="tel"
                  placeholder="012 345 678"
                  value={driver.phone}
                  onChange={(e) => updateDriver(index, { phone: e.target.value }, "phone")}
                  error={error(`drivers.${index}.phone`)}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    label={t("driverKind")}
                    value={driver.kind}
                    onChange={(e) => updateDriver(index, { kind: e.target.value === "partner" ? "partner" : "own" }, "kind")}
                    options={[
                      { value: "own", label: t("driverOwn") },
                      { value: "partner", label: t("driverPartner") },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    change({ ...draft, drivers: draft.drivers.filter((_, i) => i !== index) });
                  }}
                  aria-label={t("removeDriver")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-DEFAULT text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => change({ ...draft, drivers: [...draft.drivers, { id: newId("driver"), name: "", phone: "", kind: "own" }] })} className="self-start">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addDriver")}
          </Button>
        </FormSection>

        {saveError && (
          <Notice tone="danger" role="alert" className="mb-3">
            {saveError}
          </Notice>
        )}

        <FormActions
          // A new seller can save the suggestion as it is: that's what ticks "delivery" on the checklist.
          dirty={(dirty || !configured) && !saving}
          onCancel={() => {
            setDraft(saved);
            setErrors({});
            setSaveError(null);
          }}
          onSave={() => void handleSave()}
          saveLabel={saving ? tApp("saving") : t("save")}
          cancelLabel={t("cancel")}
          status={status}
          className={SELLER_FORM_BAR}
        />
      </Card>
    </SubPage>
  );
}

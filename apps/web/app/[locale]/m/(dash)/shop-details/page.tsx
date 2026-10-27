"use client";

import {
  BUSINESS_TYPES,
  businessTypeSchema,
  deliveryAreaSchema,
  formatKhmerPhoneLocal,
  shopDetailsSaveSchema,
  toFieldErrors,
  type FormErrorCode,
  type ShopDetailsSave,
} from "@khmio/shared";
import { Card, FileButton, IconButton, Input, Notice, SegmentedControl, Select, Switch } from "@khmio/ui";
import { Wallet, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, compressImageToBlob } from "@/components/compress-image";
import { FormActions, FormSection, ReadOnlyField, SectionJumpLinks, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { SELLER_FORM_BAR } from "@/components/seller-frame/seller-frame";
import { PaymentQrField } from "@/components/counter/payment-qr-field";
import { InvoiceFields } from "@/components/shop-details/invoice-fields";
import { LocationFields } from "@/components/shop-details/location-fields";
import { PricingFields, toPricingDraft, toPricingInput, type PricingDraft } from "@/components/shop-details/pricing-fields";
import { api, ApiError, type StoreDetails, storeDetailsSchema, uploadPhoto } from "@/lib/api";
import { savedShopDetails } from "@/lib/shop-details-save";
import { useMerchant } from "../merchant-context";

/** What PUT /store takes — with the rate and VAT as typed — plus the logo's and the payment QR's pictures while on screen. */
interface Draft extends Omit<ShopDetailsSave, keyof PricingDraft>, PricingDraft {
  logoUrl: string | null;
  paymentQrUrl: string | null;
}

/** Longest side of the uploaded payment QR picture, in pixels. */
const QR_PICTURE_SIZE = 1024;

/** The form's groups, in order: each a FormSection other screens can link to (shop-details#invoices). */
const SECTION_IDS = ["details", "location", "payments", "prices", "invoices"] as const;

function toDraft(store: StoreDetails): Draft {
  const saved = savedShopDetails(store);
  return { ...saved, ...toPricingDraft(saved), phone: formatKhmerPhoneLocal(store.phone), logoUrl: store.logoUrl, paymentQrUrl: store.paymentQrUrl };
}

function toInput({ logoUrl: _logo, paymentQrUrl: _qr, ...draft }: Draft) {
  return { ...draft, ...toPricingInput(draft) };
}

// Shop details (design/screens.md S10), reached from the My shop menu: one
// form in groups — the shop, its location and pickup, getting paid, prices
// and tax, what goes on invoices — over shopDetailsSaveSchema with today's
// rate band, the same check PUT /store runs. The API also refuses to switch pickup off when it's the shop's only
// way to get an order to buyers.
export default function ShopDetailsPage() {
  const t = useTranslations("DashboardProfile");
  const tType = useTranslations("BusinessType");
  const tApp = useTranslations("App");
  const { store, refreshStore } = useMerchant();
  const tStore = useTranslations("StoreSettings");
  const errorText = useFormErrorText();
  const schema = shopDetailsSaveSchema(store.rateBand);
  const formRef = useRef<HTMLDivElement>(null);

  const [saved, setSaved] = useState<Draft>(() => toDraft(store));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function updateFields(patch: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in patch))));
    setJustSaved(false);
    setSaveError(null);
  }

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    updateFields({ [field]: value });
  }

  /** On leaving a field: show its problem now rather than waiting for Save. */
  function checkField(field: keyof Draft) {
    const result = schema.safeParse(toInput(draft));
    const code = result.success ? undefined : toFieldErrors(result.error)[field];
    setErrors((previous) => ({ ...previous, [field]: code }));
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoUploading(true);
    setSaveError(null);
    try {
      const uploaded = await uploadPhoto(await compressImageToBlob(file, 512));
      setDraft((previous) => ({ ...previous, logoKey: uploaded.key, logoUrl: uploaded.url }));
      setJustSaved(false);
    } catch {
      setSaveError(tApp("photoUploadFailed"));
    } finally {
      setLogoUploading(false);
    }
  }

  /** The QR stays sharp: a larger picture than the logo, so every square still scans. */
  async function handleQrFile(file: File) {
    setQrUploading(true);
    setSaveError(null);
    try {
      const uploaded = await uploadPhoto(await compressImageToBlob(file, QR_PICTURE_SIZE));
      updateFields({ paymentQrKey: uploaded.key, paymentQrUrl: uploaded.url });
    } catch {
      setSaveError(tApp("photoUploadFailed"));
    } finally {
      setQrUploading(false);
    }
  }

  async function handleSave() {
    const result = schema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = toDraft(await api("/store", storeDetailsSchema, { method: "PUT", body: result.data }));
      // Show the cleaned-up values (trimmed, phone in local format) so the form matches what was saved.
      setSaved(next);
      setDraft(next);
      setErrors({});
      setJustSaved(true);
      await refreshStore().catch(() => undefined);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields);
        focusFirstInvalidField(formRef.current);
      } else {
        setSaveError(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  const status = dirty ? t("unsavedChanges") : justSaved ? t("saved") : undefined;

  return (
    <SubPage ref={formRef} title={tApp("shopDetailsTitle")}>
      <SectionJumpLinks label={t("jumpTo")} links={SECTION_IDS.map((id) => ({ id, label: t(`jump_${id}`) }))} />

      <Card className="flex flex-col p-4">
        <FormSection id="details" stacked title={t("sectionShop")} description={t("sectionShopHelp")}>
          <div className="flex items-center gap-4">
            {draft.logoUrl ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo */}
                <img src={draft.logoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                <IconButton icon={X} look="badge" label={t("removeLogo")} onClick={() => updateFields({ logoKey: null, logoUrl: null })} className="absolute -right-3 -top-3" />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
                {draft.shopName.trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <FileButton accept={ACCEPTED_IMAGE_TYPES} busy={logoUploading} invalid={Boolean(errors.logoKey)} onChange={(event) => void handleLogoChange(event)} className="flex-1">
              {logoUploading ? tApp("photoUploading") : t("uploadLogo")}
            </FileButton>
          </div>
          {errors.logoKey && <p className="text-sm text-danger">{errorText(errors.logoKey)}</p>}

          <Input
            label={t("shopNameLabel")}
            value={draft.shopName}
            onChange={(e) => update("shopName", e.target.value)}
            onBlur={() => checkField("shopName")}
            error={errorText(errors.shopName)}
          />

          <div className="flex flex-col gap-1.5">
            <Select
              label={t("businessTypeLabel")}
              value={draft.businessType}
              onChange={(e) => {
                const parsed = businessTypeSchema.safeParse(e.target.value);
                if (parsed.success) update("businessType", parsed.data);
              }}
              options={BUSINESS_TYPES.map((type) => ({ value: type, label: tType(type) }))}
            />
            <p className="text-xs text-muted">{t("businessTypeHint")}</p>
          </div>

          <ReadOnlyField label={t("shopLinkLabel")} value={`/s/${store.slug}`} hint={t("shopLinkNote")} />

          <Input
            label={t("phoneLabel")}
            prefix="+855"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="012 345 678"
            value={draft.phone}
            onChange={(e) => update("phone", e.target.value)}
            onBlur={() => checkField("phone")}
            error={errorText(errors.phone)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("areaLabel")}</span>
            <SegmentedControl
              value={draft.area}
              onChange={(next) => {
                const parsed = deliveryAreaSchema.safeParse(next);
                if (parsed.success) update("area", parsed.data);
              }}
              options={[
                { value: "phnom_penh", label: t("phnomPenh") },
                { value: "province", label: t("otherProvince") },
              ]}
            />
          </div>

          <Input
            label={t("descriptionLabel")}
            placeholder={t("descriptionPlaceholder")}
            maxLength={300}
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            onBlur={() => checkField("description")}
            error={errorText(errors.description)}
          />
        </FormSection>

        <LocationFields values={draft} errors={errors} onChange={updateFields} onCheck={checkField} />

        <FormSection id="payments" stacked title={t("sectionPayments")} description={t("sectionPaymentsHelp")}>
          {!saved.bakongId && (
            <Notice tone="warning" icon={Wallet}>
              {t("bakongMissing")}
            </Notice>
          )}
          <Input
            label={t("bakongIdLabel")}
            placeholder={t("bakongIdPlaceholder")}
            autoCapitalize="none"
            value={draft.bakongId}
            onChange={(e) => update("bakongId", e.target.value)}
            onBlur={() => checkField("bakongId")}
            error={errorText(errors.bakongId)}
          />
          <Switch checked={draft.allowCod} onChange={(allowCod) => update("allowCod", allowCod)} label={tStore("codLabel")} description={tStore("codHint")} />
          {!draft.allowCod && <Notice tone="warning">{tApp("codOffWarning")}</Notice>}
          <PaymentQrField
            previewUrl={draft.paymentQrUrl}
            busy={qrUploading}
            onFile={(file) => void handleQrFile(file)}
            onRemove={() => updateFields({ paymentQrKey: null, paymentQrUrl: null })}
          />
          {errors.paymentQrKey && <p className="text-sm text-danger">{errorText(errors.paymentQrKey)}</p>}
        </FormSection>

        <PricingFields values={draft} band={store.rateBand} errors={errors} onChange={updateFields} onCheck={checkField} />

        <InvoiceFields
          values={draft}
          errors={errors}
          onChange={update}
          shop={{ name: draft.shopName, logoUrl: draft.logoUrl, phone: store.phone, address: draft.address }}
        />

        {saveError && (
          <Notice tone="danger" role="alert" className="mb-3">
            {saveError}
          </Notice>
        )}

        <FormActions
          dirty={dirty && !saving && !logoUploading && !qrUploading}
          onCancel={() => {
            setDraft(saved);
            setErrors({});
            setSaveError(null);
          }}
          onSave={() => void handleSave()}
          saveLabel={saving ? tApp("saving") : t("saveChanges")}
          cancelLabel={t("cancel")}
          status={status}
          className={SELLER_FORM_BAR}
        />
      </Card>
    </SubPage>
  );
}

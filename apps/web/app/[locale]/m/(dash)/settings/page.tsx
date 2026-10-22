"use client";

import {
  BUSINESS_TYPES,
  businessTypeSchema,
  deliveryAreaSchema,
  formatKhmerPhoneLocal,
  storeDetailsSaveSchema,
  toFieldErrors,
  type BusinessType,
  type DeliveryArea,
  type FormErrorCode,
} from "@khmio/shared";
import { Button, Card, Input, PageHeader, SegmentedControl, Select } from "@khmio/ui";
import { ChevronRight, Loader2, LogOut, ReceiptText, Send, SlidersHorizontal, Truck, Upload, Wallet, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, compressImageToBlob } from "@/components/compress-image";
import { FormActions, FormSection, ReadOnlyField, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { SELLER_FORM, SELLER_FORM_BAR } from "@/components/seller-frame/seller-frame";
import { api, ApiError, uploadPhoto, type StoreDetails } from "@/lib/api";
import { useMerchant } from "../merchant-context";

interface Draft {
  shopName: string;
  businessType: BusinessType;
  phone: string;
  area: DeliveryArea;
  description: string;
  bakongId: string;
  logoKey: string | null;
  logoUrl: string | null;
}

function toDraft(store: StoreDetails): Draft {
  return {
    shopName: store.name,
    businessType: store.businessType,
    phone: formatKhmerPhoneLocal(store.phone),
    area: store.area,
    description: store.description,
    bakongId: store.bakongId,
    logoKey: store.logoKey,
    logoUrl: store.logoUrl,
  };
}

// The shop details page (the mockup's Profile → shop section): the standard
// form over storeDetailsSaveSchema, the same check PUT /store runs.
export default function ShopSettingsPage() {
  const t = useTranslations("DashboardProfile");
  const tType = useTranslations("BusinessType");
  const tApp = useTranslations("App");
  const tInvoiceSettings = useTranslations("InvoiceSettings");
  const locale = useLocale();
  const router = useRouter();
  const { store, refreshStore } = useMerchant();
  const errorText = useFormErrorText();
  const formRef = useRef<HTMLDivElement>(null);

  const [saved, setSaved] = useState<Draft>(() => toDraft(store));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const input = (from: Draft) => ({
    shopName: from.shopName,
    businessType: from.businessType,
    phone: from.phone,
    area: from.area,
    description: from.description,
    bakongId: from.bakongId,
    logoKey: from.logoKey,
  });

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setJustSaved(false);
    setSaveError(null);
  }

  /** On leaving a field: show its problem now rather than waiting for Save. */
  function checkField(field: keyof Draft) {
    const result = storeDetailsSaveSchema.safeParse(input(draft));
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

  async function handleSave() {
    const result = storeDetailsSaveSchema.safeParse(input(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = toDraft(await api<StoreDetails>("/store", { method: "PUT", body: input(draft) }));
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

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace(`/${locale}/m/login`);
  }

  const status = dirty ? t("unsavedChanges") : justSaved ? t("saved") : undefined;

  return (
    <div ref={formRef} className={`${SELLER_FORM} gap-5`}>
      <PageHeader title={tApp("shopDetailsTitle")} />

      {/* The shop's settings, each on its own page, reached from here on a laptop and a phone alike. */}
      <nav aria-label={t("moreSettings")} className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("moreSettings")}</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-card">
          {[
            { href: "delivery", icon: Truck, tone: "bg-info/10 text-info", title: t("delivery"), detail: t("deliveryDetail") },
            { href: "store-settings", icon: SlidersHorizontal, tone: "bg-brand/10 text-brand", title: t("storeSettings"), detail: t("storeSettingsDetail") },
            { href: "invoice-settings", icon: ReceiptText, tone: "bg-success/10 text-success", title: tInvoiceSettings("title"), detail: t("invoiceSettingsDetail") },
            { href: "telegram-alerts", icon: Send, tone: "bg-warning/10 text-warning", title: t("telegramAlerts"), detail: t("telegramAlertsDetail") },
          ].map((item) => (
            <Link
              key={item.href}
              href={`/${locale}/m/${item.href}`}
              className="flex min-h-[64px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-border/10"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.detail}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </nav>

      <Card className="flex flex-col p-4">
        <FormSection id="details" stacked title={t("sectionShop")} description={t("sectionShopHelp")}>
          <div className="flex items-center gap-4">
            {draft.logoUrl ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo */}
                <img src={draft.logoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    update("logoKey", null);
                    update("logoUrl", null);
                  }}
                  aria-label={t("removeLogo")}
                  // A 44 px tap area around the small red circle (design-standard: no tap target under 44 px).
                  className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-bg">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
                {draft.shopName.trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <label className="flex min-h-touch flex-1 cursor-pointer items-center justify-center gap-2 rounded-DEFAULT border border-border px-3 text-sm font-medium">
              {logoUploading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {logoUploading ? tApp("photoUploading") : t("uploadLogo")}
              <input type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" disabled={logoUploading} onChange={(event) => void handleLogoChange(event)} />
            </label>
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

        <FormSection id="payments" stacked title={t("sectionPayments")} description={t("sectionPaymentsHelp")}>
          {!saved.bakongId && (
            <p className="flex items-start gap-2 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              {t("bakongMissing")}
            </p>
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
        </FormSection>

        {saveError && (
          <p role="alert" className="mb-3 rounded-DEFAULT border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            {saveError}
          </p>
        )}

        <FormActions
          dirty={dirty && !saving && !logoUploading}
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


      <Button variant="secondary" className="self-start" onClick={() => void signOut()}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {tApp("signOut")}
      </Button>
    </div>
  );
}

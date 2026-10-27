"use client";

import { MAX_MAP_URL_LENGTH, shopMapLink, type FormErrorCode, type ShopLocation } from "@khmio/shared";
import { Input, Switch } from "@khmio/ui";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormSection, useFormErrorText } from "@/components/form-ui";

/**
 * Shop details' "Location and pickup" group (design/screens.md S10): the shop
 * address (printed on invoices, where pickup buyers come), the Google Maps
 * link the buyer's Map button opens — with a link to check it — and pickup
 * on/off with opening hours. The page owns the draft and the checks.
 */
export function LocationFields({
  values,
  errors,
  onChange,
  onCheck,
}: {
  values: ShopLocation;
  errors: Partial<Record<keyof ShopLocation, FormErrorCode>>;
  /** Only the fields that changed. */
  onChange: (patch: Partial<ShopLocation>) => void;
  /** On leaving a field: show its problem now. */
  onCheck: (field: keyof ShopLocation) => void;
}) {
  const t = useTranslations("DashboardProfile");
  const tDelivery = useTranslations("Delivery");
  const errorText = useFormErrorText();
  const mapLink = errors.mapUrl ? null : shopMapLink(values.mapUrl, values.address);

  return (
    <FormSection id="location" stacked title={t("sectionLocation")} description={t("sectionLocationHelp")}>
      <div className="flex flex-col gap-1.5">
        <Input
          label={t("addressLabel")}
          placeholder={tDelivery("pickupAddressPlaceholder")}
          maxLength={200}
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          onBlur={() => onCheck("address")}
          error={errorText(errors.address)}
        />
        <p className="text-xs text-muted">{t("addressHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          label={t("mapUrlLabel")}
          placeholder="https://maps.app.goo.gl/…"
          inputMode="url"
          autoCapitalize="none"
          maxLength={MAX_MAP_URL_LENGTH}
          value={values.mapUrl}
          onChange={(e) => onChange({ mapUrl: e.target.value })}
          onBlur={() => onCheck("mapUrl")}
          error={errorText(errors.mapUrl)}
        />
        <p className="text-xs text-muted">{t("mapUrlHint")}</p>
        {/* The seller checks the pin before buyers rely on it. */}
        {mapLink && (
          <a href={mapLink} target="_blank" rel="noreferrer" className="flex min-h-touch items-center gap-1.5 self-start text-sm font-medium text-brand">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {values.mapUrl.trim() ? t("mapUrlTest") : t("mapSearchTest")}
          </a>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Switch
          checked={values.pickupEnabled}
          onChange={(enabled) => onChange({ pickupEnabled: enabled })}
          label={tDelivery("pickupEnabled")}
          description={tDelivery("sectionPickupHelp")}
        />
        {errors.pickupEnabled && <p className="text-sm text-danger">{errorText(errors.pickupEnabled)}</p>}
      </div>
      {values.pickupEnabled && (
        <Input
          label={tDelivery("pickupHours")}
          placeholder={tDelivery("pickupHoursPlaceholder")}
          maxLength={100}
          value={values.pickupHours}
          onChange={(e) => onChange({ pickupHours: e.target.value })}
          error={errorText(errors.pickupHours)}
        />
      )}
    </FormSection>
  );
}

"use client";

import { MAX_INVOICE_NOTE_LENGTH, type FormErrorCode, type InvoiceDetails } from "@khmio/shared";
import { Input, Textarea } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { FormSection, useFormErrorText } from "@/components/form-ui";
import { InvoiceHeaderPreview } from "@/components/invoice/invoice-header-preview";

/**
 * Shop details' "On your invoices" group (design/screens.md S10): VAT TIN,
 * Telegram and Facebook (also the shop page's buttons), the note at the
 * bottom, and the invoice header as it will print. The page owns the draft.
 */
export function InvoiceFields({
  values,
  errors,
  onChange,
  shop,
}: {
  values: InvoiceDetails;
  errors: Partial<Record<keyof InvoiceDetails, FormErrorCode>>;
  onChange: (field: keyof InvoiceDetails, value: string) => void;
  /** For the preview, as the draft stands. */
  shop: { name: string; logoUrl: string | null; phone: string; address: string };
}) {
  const t = useTranslations("InvoiceSettings");
  const tProfile = useTranslations("DashboardProfile");
  const errorText = useFormErrorText();

  return (
    <FormSection id="invoices" stacked title={t("title")} description={t("help")}>
      <Input
        label={t("taxNumberLabel")}
        placeholder={t("taxNumberPlaceholder")}
        maxLength={40}
        value={values.taxNumber}
        onChange={(e) => onChange("taxNumber", e.target.value)}
        error={errorText(errors.taxNumber)}
      />
      <div className="flex flex-col gap-1.5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("telegramLabel")}
            placeholder={t("telegramPlaceholder")}
            autoCapitalize="none"
            maxLength={100}
            value={values.telegramLink}
            onChange={(e) => onChange("telegramLink", e.target.value)}
            error={errorText(errors.telegramLink)}
          />
          <Input
            label={t("facebookLabel")}
            placeholder={t("facebookPlaceholder")}
            autoCapitalize="none"
            maxLength={100}
            value={values.facebookLink}
            onChange={(e) => onChange("facebookLink", e.target.value)}
            error={errorText(errors.facebookLink)}
          />
        </div>
        <p className="text-xs text-muted">{tProfile("socialHint")}</p>
      </div>
      <Textarea
        label={t("noteLabel")}
        placeholder={t("notePlaceholder")}
        maxLength={MAX_INVOICE_NOTE_LENGTH}
        rows={3}
        counter={`${values.invoiceNote.length} / ${MAX_INVOICE_NOTE_LENGTH}`}
        value={values.invoiceNote}
        onChange={(e) => onChange("invoiceNote", e.target.value)}
        error={errorText(errors.invoiceNote)}
      />
      <InvoiceHeaderPreview
        label={t("preview")}
        name={shop.name}
        logoUrl={shop.logoUrl}
        phone={shop.phone}
        address={shop.address}
        telegram={values.telegramLink}
        facebook={values.facebookLink}
        taxNumber={values.taxNumber}
      />
    </FormSection>
  );
}

"use client";

import { formatKhmerPhoneLocal, invoiceDetailsSchema, MAX_INVOICE_NOTE_LENGTH, toFieldErrors, type FormErrorCode, type InvoiceDetails } from "@khmio/shared";
import { Button, Card, Input, Textarea } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormSection, useFormErrorText } from "@/components/form-ui";
import { api, ApiError, type StoreDetails } from "@/lib/api";

function toDraft(store: StoreDetails): InvoiceDetails {
  return { taxNumber: store.taxNumber, invoiceNote: store.invoiceNote, telegramLink: store.telegramLink, facebookLink: store.facebookLink };
}

/**
 * "On your invoices" (design/screens.md S10): what the seller adds to every
 * invoice and receipt (B7), saved on its own (PUT /store/invoice), with the
 * invoice's header as it will print.
 */
export function InvoiceDetailsCard({ store, onSaved }: { store: StoreDetails; onSaved: () => Promise<void> }) {
  const t = useTranslations("InvoiceSettings");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const [saved, setSaved] = useState(() => toDraft(store));
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function update(field: keyof InvoiceDetails, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  async function save() {
    const result = invoiceDetailsSchema.safeParse(draft);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const next = toDraft(await api<StoreDetails>("/store/invoice", { method: "PUT", body: result.data }));
      setSaved(next);
      setDraft(next);
      setErrors({});
      setMessage(t("saved"));
      await onSaved().catch(() => undefined);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setMessage(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const contacts = [store.phone && formatKhmerPhoneLocal(store.phone), draft.telegramLink.trim(), draft.facebookLink.trim()].filter(Boolean);

  return (
    <Card className="flex flex-col p-4">
      <FormSection id="invoices" stacked title={t("title")} description={t("help")}>
        <Input
          label={t("taxNumberLabel")}
          placeholder={t("taxNumberPlaceholder")}
          value={draft.taxNumber}
          maxLength={40}
          onChange={(event) => update("taxNumber", event.target.value)}
          error={errorText(errors.taxNumber)}
        />
        <Input
          label={t("telegramLabel")}
          placeholder={t("telegramPlaceholder")}
          autoCapitalize="none"
          value={draft.telegramLink}
          maxLength={100}
          onChange={(event) => update("telegramLink", event.target.value)}
          error={errorText(errors.telegramLink)}
        />
        <Input
          label={t("facebookLabel")}
          placeholder={t("facebookPlaceholder")}
          autoCapitalize="none"
          value={draft.facebookLink}
          maxLength={100}
          onChange={(event) => update("facebookLink", event.target.value)}
          error={errorText(errors.facebookLink)}
        />
        <Textarea
          label={t("noteLabel")}
          placeholder={t("notePlaceholder")}
          value={draft.invoiceNote}
          maxLength={MAX_INVOICE_NOTE_LENGTH}
          rows={3}
          counter={`${draft.invoiceNote.length} / ${MAX_INVOICE_NOTE_LENGTH}`}
          onChange={(event) => update("invoiceNote", event.target.value)}
          error={errorText(errors.invoiceNote)}
        />
        <p className="text-xs text-muted">{t("addressNote")}</p>

        {/* The invoice header as it will print: white paper in both themes. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("preview")}</span>
          <div className="flex items-start gap-3 rounded-DEFAULT border border-border bg-paper p-3 font-khmer text-paper-ink">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
              <img src={store.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-brand text-xl font-bold text-paper">
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 text-xs text-paper-muted [overflow-wrap:anywhere]">
              <p className="text-sm font-bold text-paper-ink">{store.name}</p>
              {contacts.length > 0 && <p>{contacts.join(" · ")}</p>}
              {draft.taxNumber.trim() && <p>VAT TIN {draft.taxNumber.trim()}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <span className="mr-auto text-sm text-muted" role="status">
            {dirty ? t("unsaved") : message}
          </span>
          <Button variant="primary" onClick={() => void save()} disabled={!dirty} loading={saving}>
            {t("save")}
          </Button>
        </div>
      </FormSection>
    </Card>
  );
}

"use client";

import { formatKhmerPhoneLocal, MAX_SUPPLIER_LENGTH, MAX_SUPPLIER_NOTE_LENGTH, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Input, Notice } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { api, ApiError, type Supplier, supplierSchema } from "@/lib/api";

/**
 * Add a supplier, or change one (design/screens.md S13 "Suppliers"): a name
 * (one per shop, whatever the case), a phone and a note. Answers with the
 * saved supplier, so a bill being written can pick it at once.
 */
export function SupplierSheet({
  supplier,
  startName = "",
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  /** A new supplier: the name already typed (the bill's supplier picker). */
  startName?: string;
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
}) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const [name, setName] = useState(supplier?.name ?? startName);
  const [phone, setPhone] = useState(supplier?.phone ? formatKhmerPhoneLocal(supplier.phone) : "");
  const [note, setNote] = useState(supplier?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      const body = { name, phone, note };
      onSaved(await api(supplier ? `/suppliers/${supplier.id}` : "/suppliers", supplierSchema, { method: supplier ? "PATCH" : "POST", body }));
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={supplier ? t("editSupplier") : t("addSupplier")}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={!name.trim()} onClick={() => void save()}>
          {t("saveSupplier")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t("supplierName")} placeholder={t("supplierNamePlaceholder")} maxLength={MAX_SUPPLIER_LENGTH} value={name} onChange={(event) => setName(event.target.value)} error={errorText(errors.name)} />
        <Input label={t("supplierPhone")} inputMode="tel" placeholder={t("supplierPhonePlaceholder")} value={phone} onChange={(event) => setPhone(event.target.value)} error={errorText(errors.phone)} />
        <Input label={t("supplierNote")} placeholder={t("supplierNotePlaceholder")} maxLength={MAX_SUPPLIER_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} error={errorText(errors.note)} />
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}

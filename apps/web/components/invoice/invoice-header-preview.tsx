"use client";

import { formatKhmerPhoneLocal } from "@khmio/shared";
import { useTranslations } from "next-intl";

/**
 * The top of the shop's invoice as it will print — white paper in both
 * themes — under the "On your invoices" fields, so the seller sees each
 * change before saving (design/screens.md S10).
 */
export function InvoiceHeaderPreview({
  label,
  name,
  logoUrl,
  phone,
  address,
  telegram,
  facebook,
  taxNumber,
}: {
  label: string;
  name: string;
  logoUrl: string | null;
  /** 855… or "". */
  phone: string;
  /** The shop address, once the page knows it. */
  address?: string;
  telegram: string;
  facebook: string;
  taxNumber: string;
}) {
  const t = useTranslations("Invoice");
  const contacts = [phone && formatKhmerPhoneLocal(phone), telegram.trim(), facebook.trim()].filter(Boolean);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-3 rounded-DEFAULT border border-border bg-paper p-3 font-khmer text-paper-ink">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
          <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-brand text-xl font-bold text-paper">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 text-xs text-paper-muted [overflow-wrap:anywhere]">
          <p className="text-sm font-bold text-paper-ink">{name}</p>
          {address?.trim() && <p>{address.trim()}</p>}
          {contacts.length > 0 && <p>{contacts.join(" · ")}</p>}
          {taxNumber.trim() && <p>{t("taxNumber", { number: taxNumber.trim() })}</p>}
        </div>
      </div>
    </div>
  );
}

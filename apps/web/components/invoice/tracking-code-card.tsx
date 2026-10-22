"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { copyText } from "@/components/share-link";

/** The order's tracking code on the buyer's order page (design/screens.md B6): with their phone it opens the order again, no Telegram needed. */
export function TrackingCodeCard({ code }: { code: string }) {
  const t = useTranslations("Invoice");
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("trackingCardTitle")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-bold tracking-wider tabular-nums">{code}</span>
        <button
          type="button"
          onClick={() => void copyText(code).then(setCopied)}
          className="flex min-h-touch shrink-0 items-center gap-2 rounded-DEFAULT border border-border px-3 text-sm font-medium"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </button>
      </div>
      <p className="text-sm text-muted">{t("trackingCardBody")}</p>
    </section>
  );
}

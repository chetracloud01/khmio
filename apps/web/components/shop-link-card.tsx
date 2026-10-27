"use client";

import { Button, Card } from "@khmio/ui";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { copyText, shareOrCopyLink } from "@/components/share-link";

/**
 * "Your shop link": the address to send, Share and Copy, and a QR code to
 * download and print for the counter. One block for the dashboard home and
 * its mockup. `onShared` is told whenever the link went out (shared, copied
 * or the QR downloaded) — the live page marks the setup step done with it.
 */
export function ShopLinkCard({
  url,
  shopName,
  qrFileName = "shop-qr.png",
  shared = false,
  onShared,
}: {
  url: string;
  shopName: string;
  /** The downloaded QR picture's name, e.g. "<shop link>-qr.png". */
  qrFileName?: string;
  shared?: boolean;
  onShared?: () => void;
}) {
  const t = useTranslations("Share");
  const [qr, setQr] = useState<string | null>(null);
  const [note, setNote] = useState<"copied" | "shared" | "manual" | null>(null);

  useEffect(() => {
    if (!url) return;
    void QRCode.toDataURL(url, { margin: 2, width: 600, errorCorrectionLevel: "M" }).then(setQr);
  }, [url]);

  async function share() {
    const outcome = await shareOrCopyLink(shopName, url);
    if (outcome === "cancelled") return;
    setNote(outcome);
    if (outcome !== "manual") onShared?.();
  }

  async function copy() {
    if (!(await copyText(url))) {
      setNote("manual");
      return;
    }
    setNote("copied");
    onShared?.();
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted">{t("body")}</p>
        </div>
        {shared && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t("shared")}
          </span>
        )}
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">{t("linkLabel")}</span>
        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-h-touch w-full rounded-DEFAULT border border-border bg-bg px-3 text-base text-fg" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => void share()}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t("share")}
        </Button>
        <Button variant="secondary" onClick={() => void copy()}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t("copy")}
        </Button>
      </div>
      {note && (
        <p role="status" className="text-sm text-muted">
          {note === "manual" ? t("manual") : note === "copied" ? t("copied") : t("sharedNow")}
        </p>
      )}
      {qr && (
        <div className="flex items-center gap-3 rounded-DEFAULT border border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a QR code made in the browser */}
          <img src={qr} alt={t("qrAlt")} width={80} height={80} className="h-20 w-20 shrink-0 rounded-DEFAULT bg-white" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-muted">{t("qrBody")}</p>
            <a href={qr} download={qrFileName} onClick={() => onShared?.()} className="flex min-h-touch items-center gap-2 text-sm font-medium text-brand">
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("download")}
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}

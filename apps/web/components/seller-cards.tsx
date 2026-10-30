"use client";

import { parseTrackingCode, type OrderFulfilment, type OrderStatus } from "@khmio/shared";
import { ActionTiles, GroupTitle, IconBadge, PillInput, PillInputButton } from "@khmio/ui";
import { Check, ChevronLeft, Copy, Download, History, Link2, QrCode, Search, Send, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { ORDER_STATUS_TONE, orderStatusIcon } from "@/components/order-ui";
import { copyText, shareOrCopyLink } from "@/components/share-link";
import { readStored, writeStored } from "@/lib/device-storage";

// The seller home's working blocks in the sales card's style (2026-10-22
// review): one rounded card each, a title row with a pill on the right, soft
// inner panels, round icon buttons. "Share your shop" and "Find order by
// code", drawn by the seller dashboard.

/** The order's status as a coloured circle with its icon (orange waiting, blue moving, green done, red stopped). */
export function OrderStatusCircle({ status, fulfilment, label, className }: { status: OrderStatus; fulfilment?: OrderFulfilment; label: string; className?: string }) {
  return <IconBadge icon={orderStatusIcon({ status, fulfilment })} tone={ORDER_STATUS_TONE[status]} shape="circle" label={label} className={className} />;
}

/** "Shared" in green, once the shop's link has gone out. */
export function SharedPill() {
  const t = useTranslations("Share");
  return (
    <span className="flex shrink-0 items-center gap-1 self-start rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      {t("shared")}
    </span>
  );
}

/**
 * The shop's link and its four ways out — QR code, Copy link, Telegram and
 * Other apps (the phone's own share list) — for the header's Share sheet.
 * The QR code opens in place, with a way back.
 */
export function ShareShopPanel({ url, shopName, qrFileName = "shop-qr.png", onShared }: { url: string; shopName: string; qrFileName?: string; onShared?: () => void }) {
  const t = useTranslations("Share");
  const tApp = useTranslations("SellerApp");
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [note, setNote] = useState<"copied" | "shared" | "manual" | null>(null);
  useEffect(() => {
    if (!url) return;
    void QRCode.toDataURL(url, {
      margin: 2,
      width: 600,
      errorCorrectionLevel: "M",
    }).then(setQr);
  }, [url]);

  async function share() {
    const outcome = await shareOrCopyLink(shopName, url);
    if (outcome === "cancelled") return;
    setNote(outcome);
    if (outcome !== "manual") onShared?.();
  }
  async function copy() {
    if (!(await copyText(url))) return setNote("manual");
    setNote("copied");
    onShared?.();
  }
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shopName)}`;
  const shortUrl = url.replace(/^https?:\/\//, "");

  if (showQr) {
    return (
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <button type="button" onClick={() => setShowQr(false)} className="flex min-h-touch items-center gap-1 self-start rounded-full pr-3 text-sm font-medium text-brand">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          {t("back")}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- a QR code made in the browser */}
        {qr && <img src={qr} alt={t("qrAlt")} width={220} height={220} className="h-56 w-56 rounded-2xl bg-white p-2 shadow-card" />}
        <p className="max-w-[34ch] text-sm text-muted">{t("qrBody")}</p>
        {qr && (
          <a href={qr} download={qrFileName} onClick={() => onShared?.()} className="flex min-h-touch items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("download")}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-full bg-canvas py-1 pl-4 pr-1">
        <Link2 className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm" title={url}>
          {shortUrl}
        </span>
        <button type="button" onClick={() => void copy()} className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-full bg-bg px-3 text-sm font-medium shadow-card">
          {note === "copied" ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {note === "copied" ? tApp("copied") : t("copy")}
        </button>
      </div>
      <ActionTiles
        items={[
          { key: "qr", icon: QrCode, label: tApp("qrCode"), look: "primary", onClick: () => setShowQr(true) },
          { key: "copy", icon: Copy, label: t("copy"), onClick: () => void copy() },
          { key: "telegram", icon: Send, label: "Telegram", look: "telegram", href: telegramHref, external: true, onClick: () => onShared?.() },
          { key: "other", icon: Share2, label: t("otherApps"), onClick: () => void share() },
        ]}
      />
      {note && note !== "copied" && (
        <p role="status" className="text-sm text-muted">
          {note === "manual" ? t("manual") : t("sharedNow")}
        </p>
      )}
    </div>
  );
}

const RECENT_CODES_KEY = "khmio.recentFoundCodes";

/**
 * "Find order by tracking code" in the same style: a pill field and a round
 * Find button, and the last codes found as chips (kept on this phone only).
 * `hrefFor` gets the 8-character code and returns the order's page, or null.
 */
export function FindOrderPanel({ hrefFor, prefix }: { hrefFor: (code: string) => string | null; prefix: string }) {
  const t = useTranslations("FindOrder");
  const tApp = useTranslations("SellerApp");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent((readStored(RECENT_CODES_KEY, z.array(z.string())) ?? []).slice(0, 3));
  }, []);

  function find(input: string) {
    const code = parseTrackingCode(input);
    if (!code) return setProblem(t("invalid"));
    const href = hrefFor(code);
    if (!href) return setProblem(t("notFound"));
    const shown = `${prefix}-${code.slice(0, 4)}-${code.slice(4)}`;
    const next = [shown, ...recent.filter((entry) => entry !== shown)].slice(0, 3);
    writeStored(RECENT_CODES_KEY, next); // not kept when storage refuses: the search still works
    router.push(href);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    find(value);
  }

  return (
    <section className="flex flex-col gap-3">
      <form onSubmit={submit} noValidate>
        <PillInput
          id="find-order-panel"
          label={t("title")}
          labelHidden
          icon={<Search />}
          code
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          placeholder={t("placeholder")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          invalid={!!problem}
          action={<PillInputButton type="submit">{t("find")}</PillInputButton>}
        />
      </form>
      {problem ? (
        <p role="alert" className="px-2 text-sm text-danger">
          {problem}
        </p>
      ) : (
        <p className="px-2 text-sm text-muted">{tApp("findOrderHelp")}</p>
      )}
      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <GroupTitle as="span" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {tApp("recentCodes")}
          </GroupTitle>
          <div className="flex flex-wrap gap-2">
            {recent.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setValue(code);
                  find(code);
                }}
                className="flex min-h-touch items-center rounded-full border border-border bg-bg px-4 text-sm font-medium tracking-wider tabular-nums hover:border-brand/40"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

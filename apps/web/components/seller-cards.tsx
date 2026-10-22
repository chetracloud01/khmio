"use client";

import { getOrderTab, parseTrackingCode, type Fulfilment, type OrderStatus } from "@khmio/shared";
import { BottomSheet, cn, type Tone } from "@khmio/ui";
import { Check, ChevronRight, Copy, Download, History, Link2, QrCode, Search, Send, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ORDER_STATUS_TONE, orderStatusIcon } from "@/components/order-ui";
import { copyText, shareOrCopyLink } from "@/components/share-link";

// The seller home's working blocks in the sales card's style (2026-10-22
// review): one rounded card each, a title row with a pill on the right, soft
// inner panels, round icon buttons. "Needs your action", "Share your shop"
// and "Find order by code". The live dashboard and its mockup draw these.

const CARD = "flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-4 shadow-card";
const TONE_CIRCLE: Record<Tone, string> = {
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  brand: "bg-brand/10 text-brand",
  muted: "bg-border/40 text-muted",
};

/** The order's status as a coloured circle with its icon (orange waiting, blue moving, green done, red stopped). */
export function OrderStatusCircle({ status, fulfilment, label, className }: { status: OrderStatus; fulfilment?: Fulfilment; label: string; className?: string }) {
  const Icon = orderStatusIcon({ status, fulfilment });
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE_CIRCLE[ORDER_STATUS_TONE[status]], className)} title={label}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** One order waiting for the seller, already in words; `next` is its next-step button. */
export interface ActionRow {
  key: string;
  href: string;
  number: string;
  buyer: string;
  /** Place · how long ago. */
  details: string;
  total: string;
  status: OrderStatus;
  /** Pickup orders show the shop, not a truck, when ready. */
  fulfilment?: Fulfilment;
  statusLabel: string;
  next: ReactNode;
}

const ACTION_TABS = ["to_confirm", "packing", "sending"] as const;

/** "Needs your action": a count, filter pills by step, and each order as a row with a coloured status circle and a compact next-step pill. */
export function OrdersNeedingAction({ rows, total, allHref, limit = 5 }: { rows: ActionRow[]; total: number; allHref: string; limit?: number }) {
  const t = useTranslations("Dashboard");
  const tApp = useTranslations("SellerApp");
  const tOrders = useTranslations("Orders");
  const [tab, setTab] = useState<"all" | (typeof ACTION_TABS)[number]>("all");
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of rows) {
      const key = getOrderTab(row.status);
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [rows]);
  const shown = rows.filter((row) => tab === "all" || getOrderTab(row.status) === tab).slice(0, limit);
  const pills = [{ value: "all" as const, label: tApp("filterAll"), count: rows.length }, ...ACTION_TABS.filter((key) => counts[key]).map((key) => ({ value: key, label: tOrders(`tab_${key}`), count: counts[key] ?? 0 }))];

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-normal">
          {t("needsActionTitle")}
          {total > 0 && <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-bg tabular-nums">{total}</span>}
        </h2>
        <Link href={allHref} className="flex min-h-touch shrink-0 items-center gap-1 text-sm font-medium text-brand">
          {t("seeAllOrders")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/5 p-3 text-sm font-medium text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("allCaughtUpTitle")}
        </p>
      ) : (
        <>
          {pills.length > 2 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("needsActionTitle")}>
              {pills.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTab(pill.value)}
                  aria-pressed={tab === pill.value}
                  className={cn(
                    "flex min-h-touch shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border pl-4 pr-2 text-sm font-medium",
                    tab === pill.value ? "border-brand bg-brand text-on-brand" : "border-border bg-bg text-fg hover:border-brand/40",
                  )}
                >
                  {pill.label}
                  <span className={cn("min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums", tab === pill.value ? "bg-on-brand/20" : "bg-border/50 text-muted")}>{pill.count}</span>
                </button>
              ))}
            </div>
          )}
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-canvas">
            {shown.map((row) => {
              return (
                // The whole row opens the order (a big tap area); the next-step button sits above that link.
                <li key={row.key} className="relative flex items-center gap-3 p-3 hover:bg-border/20">
                  <OrderStatusCircle status={row.status} fulfilment={row.fulfilment} label={row.statusLabel} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link href={row.href} className="flex min-w-0 items-baseline justify-between gap-2 after:absolute after:inset-0 after:content-['']">
                      <span className="min-w-0 truncate font-semibold">
                        {row.number} <span className="font-normal text-muted">· {row.buyer}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{row.total}</span>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-muted">
                        <span className="sr-only">{row.statusLabel} · </span>
                        {row.details}
                      </span>
                      {/* The next-step button as a compact pill. */}
                      <div className="relative z-10 shrink-0 [&_button]:min-h-touch [&_button]:rounded-full [&_button]:px-4 [&_button]:text-sm">{row.next}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {total > shown.length && tab === "all" && (
            <Link href={allHref} className="flex min-h-touch items-center justify-center gap-1 text-sm font-medium text-brand">
              {t("moreOrders", { count: total - shown.length })}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

/**
 * "Share your shop": the link as one pill with Copy, then round buttons for
 * Share, Copy, QR code and Telegram. The QR opens in a sheet to download and
 * print. `onShared` is told when the link went out (the setup checklist's step).
 */
export function ShareShopCard({ url, shopName, qrFileName = "shop-qr.png", shared = false, onShared }: { url: string; shopName: string; qrFileName?: string; shared?: boolean; onShared?: () => void }) {
  const t = useTranslations("Share");
  const tApp = useTranslations("SellerApp");
  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
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
    if (!(await copyText(url))) return setNote("manual");
    setNote("copied");
    onShared?.();
  }
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shopName)}`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  const round = "flex flex-col items-center gap-1.5 text-xs font-medium leading-normal";
  const circle = "flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors hover:bg-brand/15";

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold leading-normal">{t("title")}</h2>
        {shared && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t("shared")}
          </span>
        )}
      </div>
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
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={() => void share()} className={round}>
          <span className={cn(circle, "bg-brand text-on-brand hover:bg-brand")}>
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </span>
          {t("share")}
        </button>
        <button type="button" onClick={() => void copy()} className={round}>
          <span className={circle}>
            <Copy className="h-5 w-5" aria-hidden="true" />
          </span>
          {t("copy")}
        </button>
        <button type="button" onClick={() => setQrOpen(true)} className={round}>
          <span className={circle}>
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </span>
          {tApp("qrCode")}
        </button>
        <a href={telegramHref} target="_blank" rel="noreferrer" onClick={() => onShared?.()} className={round}>
          <span className={circle}>
            <Send className="h-5 w-5" aria-hidden="true" />
          </span>
          Telegram
        </a>
      </div>
      {note && note !== "copied" && (
        <p role="status" className="text-sm text-muted">
          {note === "manual" ? t("manual") : t("sharedNow")}
        </p>
      )}
      <BottomSheet open={qrOpen} onClose={() => setQrOpen(false)} closeLabel={tApp("close")} title={tApp("qrCode")}>
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
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
      </BottomSheet>
    </section>
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
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(RECENT_CODES_KEY) ?? "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((entry): entry is string => typeof entry === "string").slice(0, 3));
    } catch {
      // No saved codes on this phone: nothing to show.
    }
  }, []);

  function find(input: string) {
    const code = parseTrackingCode(input);
    if (!code) return setProblem(t("invalid"));
    const href = hrefFor(code);
    if (!href) return setProblem(t("notFound"));
    const shown = `${prefix}-${code.slice(0, 4)}-${code.slice(4)}`;
    const next = [shown, ...recent.filter((entry) => entry !== shown)].slice(0, 3);
    try {
      window.localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(next));
    } catch {
      // Not kept: the search still works.
    }
    router.push(href);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    find(value);
  }

  return (
    <section className="flex flex-col gap-3">
      <form onSubmit={submit} noValidate className="flex items-center gap-2 rounded-full border border-border bg-canvas p-1 pl-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <label className="sr-only" htmlFor="find-order-panel">
          {t("title")}
        </label>
        <input
          id="find-order-panel"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          placeholder={t("placeholder")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={problem ? true : undefined}
          className="min-h-touch min-w-0 flex-1 bg-transparent text-base uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:outline-none"
        />
        <button type="submit" className="flex min-h-touch shrink-0 items-center rounded-full bg-brand px-5 text-sm font-semibold text-on-brand">
          {t("find")}
        </button>
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
          <span className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {tApp("recentCodes")}
          </span>
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

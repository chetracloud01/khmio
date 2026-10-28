"use client";

import { BottomSheet, Button, cn, Mio, StatusPill } from "@khmio/ui";
import { Bell, Check, ChevronRight, Copy, Download, FileText, Inbox, MapPin, Phone, Search, Send, Share, SquarePlus, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { copyText } from "@/components/share-link";
import type { ShopState } from "@/components/seller-home";

// The seller app's newer home and app-feel parts (design/screens.md S3, the
// 2026-10-22 seller review): a compact header, swipeable numbers, quick
// actions, installing Khmio as an app, the new-order popup and the offline
// screen, as shared blocks.

/**
 * The top of the seller's home: greeting and shop status, then a search bar
 * that opens "find order by code". "View shop" is in the frame's header (phone)
 * and top bar (laptop).
 */
export function HomeTopBar({ firstName, state, onSearch, codePrefix }: { firstName: string; state: ShopState; onSearch: () => void; codePrefix: string }) {
  const t = useTranslations("Dashboard");
  const tApp = useTranslations("SellerApp");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("greetingMorning", { name: firstName }) : hour < 17 ? t("greetingAfternoon", { name: firstName }) : t("greetingEvening", { name: firstName });
  const pill =
    state.kind === "paused"
      ? { tone: "danger" as const, label: t("statusPaused") }
      : state.kind === "due"
        ? { tone: "warning" as const, label: t("statusDue") }
        : state.kind === "trial"
          ? {
              tone: "brand" as const,
              label: t("statusTrial", { count: state.daysLeft }),
            }
          : { tone: "success" as const, label: t("statusOpen") };
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold leading-normal">{greeting}</h1>
        <StatusPill tone={pill.tone} className="mt-0.5">
          {pill.label}
        </StatusPill>
      </div>
      <div className="flex items-start gap-3">
        {/* Looks like a search field; opens the find-order sheet, where the code is typed. */}
        <button
          type="button"
          onClick={onSearch}
          className="group flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-full border border-border bg-bg pl-4 pr-1.5 text-left shadow-card transition-colors hover:border-brand/40 md:max-w-md"
        >
          <Search className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted">{tApp("findOrderPlaceholder")}</span>
          <span className="hidden shrink-0 rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold tracking-wider text-muted tabular-nums min-[380px]:block">{codePrefix}-····</span>
        </button>
      </div>
    </div>
  );
}

/** The two things a seller does most, as big cards with a bright icon: Add product and Share shop link. */
/** A quick action goes to a page (`href`) or opens something on this one (`onClick`, e.g. the Share sheet). */
export type QuickAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  tone: "teal" | "amber";
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function QuickActions({ items }: { items: QuickAction[] }) {
  const tile = "group flex min-h-[72px] items-center gap-3 rounded-2xl border border-border bg-bg p-3 text-left shadow-card transition-all hover:border-brand/40 hover:shadow-raised active:scale-[0.99] motion-reduce:transition-none";
  return (
    <nav className="grid grid-cols-2 gap-3">
      {items.map((item, index) => {
        // An odd count: the first (the main action) takes the whole row, so none is left alone.
        const className = cn(tile, index === 0 && items.length % 2 === 1 && "col-span-2");
        const content = (
          <>
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[rgb(var(--color-paper))] shadow-raised",
                item.tone === "teal" ? "bg-gradient-to-br from-[rgb(var(--color-action-teal))] to-[rgb(var(--color-paper-brand))]" : "bg-gradient-to-br from-[rgb(var(--color-action-amber))] to-[rgb(var(--color-action-orange))]",
              )}
            >
              <item.icon className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold leading-normal">{item.label}</span>
              <span className="line-clamp-1 text-xs leading-normal text-muted">{item.hint}</span>
            </span>
          </>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} className={className}>
            {content}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={item.onClick} className={className}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}

/** "7 orders need you" at the top of the home, straight to the orders; a quiet "All caught up" when there are none. */
export function NeedsYouBanner({ count, href }: { count: number; href: string }) {
  const t = useTranslations("SellerApp");
  if (count === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm font-medium text-success">
        <Check className="h-4 w-4" aria-hidden="true" />
        {t("allCaughtUp")}
      </p>
    );
  }
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-3 pr-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning text-bg">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-normal">{t("needsYou", { count })}</span>
        <span className="block text-sm leading-normal text-muted">{t("needsYouHint")}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-warning transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

/** "Install Khmio on your phone": a card the seller can close, opening the steps for their phone. */
export function InstallAppCard({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  const t = useTranslations("SellerApp");
  return (
    <section className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-paper-brand to-nav-bg p-4 pr-12 text-nav-fg shadow-raised">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-nav-fg/15 ring-1 ring-nav-fg/25">
        <Download className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-normal">{t("installTitle")}</p>
        <p className="text-sm leading-normal text-nav-fg/85">{t("installBody")}</p>
        <button type="button" onClick={onInstall} className="mt-2 flex min-h-touch items-center rounded-full bg-nav-fg px-4 text-sm font-semibold text-nav-bg">
          {t("installAction")}
        </button>
      </div>
      <button type="button" onClick={onDismiss} aria-label={t("installLater")} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-nav-fg/80 hover:bg-nav-fg/10">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

/** How to install, for the phone in hand: Android gets the browser's own prompt; iPhone needs Share → Add to Home Screen. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("SellerApp");
  const [platform, setPlatform] = useState<"android" | "iphone">("android");
  useEffect(() => {
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setPlatform("iphone");
  }, []);
  const steps: { icon: LucideIcon; text: string }[] =
    platform === "iphone"
      ? [
          { icon: Share, text: t("iphoneStep1") },
          { icon: SquarePlus, text: t("iphoneStep2") },
          { icon: Bell, text: t("iphoneStep3") },
        ]
      : [
          { icon: Download, text: t("androidStep1") },
          { icon: SquarePlus, text: t("androidStep2") },
          { icon: Bell, text: t("androidStep3") },
        ];
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t("close")}
      title={t("installTitle")}
      footer={
        <Button variant="primary" className="w-full" onClick={onClose}>
          {t("installDone")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-paper-brand to-nav-bg">
            <Mio pose="face" size={44} />
          </span>
          <div>
            <p className="font-semibold">Khmio</p>
            <p className="text-sm text-muted">{t("installPreview")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("phoneType")}>
          {(["android", "iphone"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              aria-pressed={platform === value}
              className={cn("min-h-touch rounded-full border text-sm font-medium", platform === value ? "border-brand bg-brand text-on-brand" : "border-border")}
            >
              {value === "android" ? "Android" : "iPhone"}
            </button>
          ))}
        </div>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand">{index + 1}</span>
              <span className="flex flex-1 items-start gap-2 pt-1 text-sm leading-normal">
                <step.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </BottomSheet>
  );
}

/** A short two-note chime for a new order, made in the browser (no sound file to download). */
export function playNewOrderChime() {
  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    [880, 1320].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = audio.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    });
    window.setTimeout(() => void audio.close(), 1200);
  } catch {
    // No sound (blocked or unsupported): the popup still shows.
  }
}

/** The new-order popup at the top of the screen: what came in, with a button straight to it. Closes by itself. */
export function NewOrderToast({ order, onClose }: { order: { number: string; total: string; place: string; href: string } | null; onClose: () => void }) {
  const t = useTranslations("SellerApp");
  useEffect(() => {
    if (!order) return;
    const timer = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(timer);
  }, [order, onClose]);
  if (!order) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <div role="status" aria-live="assertive" className="pointer-events-auto flex w-full max-w-md animate-bump items-center gap-3 rounded-2xl border border-border bg-bg p-3 shadow-raised motion-reduce:animate-none">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-warning motion-reduce:animate-none" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-normal">{t("newOrderTitle", { number: order.number })}</p>
          <p className="truncate text-sm text-muted">
            {order.total} · {order.place}
          </p>
        </div>
        <Link href={order.href} onClick={onClose} className="flex min-h-touch shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-on-brand">
          {t("newOrderView")}
        </Link>
        <button type="button" onClick={onClose} aria-label={t("close")} className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-border/30">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * The order's contact bar (design/screens.md S5): the tracking code as one
 * copyable chip, then Call · Telegram · Copy address · Invoice — what a
 * seller does most with an order, one tap each.
 */
export function OrderContactBar({ phone, address, invoiceHref, trackingCode }: { phone: string; address: string; invoiceHref: string; trackingCode: string }) {
  const t = useTranslations("SellerApp");
  const [copied, setCopied] = useState<"code" | "address" | null>(null);
  const copy = (what: "code" | "address", text: string) =>
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    });
  const tile = "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl text-center text-xs font-medium leading-normal hover:bg-brand/5";
  const icon = "flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand";
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-2 shadow-card">
      <button
        type="button"
        onClick={() => copy("code", trackingCode)}
        className="mx-1 mt-1 flex min-h-touch items-center justify-between gap-2 rounded-full bg-canvas px-3 text-sm"
      >
        <span className="text-muted">{t("trackingCode")}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold tracking-wider tabular-nums">
          {trackingCode}
          {copied === "code" ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4 text-muted" aria-hidden="true" />}
        </span>
      </button>
      <div className="grid grid-cols-4">
        <a href={`tel:+${phone}`} className={tile}>
          <span className={icon}>
            <Phone className="h-5 w-5" aria-hidden="true" />
          </span>
          {t("callBuyer")}
        </a>
        <a href={`https://t.me/+${phone}`} target="_blank" rel="noreferrer" className={tile}>
          <span className={icon}>
            <Send className="h-5 w-5" aria-hidden="true" />
          </span>
          {t("telegramBuyer")}
        </a>
        <button type="button" onClick={() => copy("address", address)} className={tile}>
          <span className={icon}>{copied === "address" ? <Check className="h-5 w-5" aria-hidden="true" /> : <MapPin className="h-5 w-5" aria-hidden="true" />}</span>
          <span aria-live="polite">{copied === "address" ? t("copied") : t("copyAddress")}</span>
        </button>
        <Link href={invoiceHref} className={tile}>
          <span className={icon}>
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          {t("invoice")}
        </Link>
      </div>
    </section>
  );
}

/** Registers the service worker (public/sw.js) that shows the offline page; browsers allow it only on https and localhost. */
export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
}

const INSTALL_DISMISSED_KEY = "khmio.installDismissed";

/**
 * Whether to offer "Install Khmio", and the browser's own install prompt when
 * it has one (Chrome on Android). Never offered inside the installed app, or
 * once the seller closed the card on this phone.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Hidden until checked, so the card never flashes inside the installed app.
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    setInstalled(standalone);
    try {
      setDismissed(window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return {
    show: !installed && !dismissed,
    /** Shows the browser's prompt; false when there isn't one (iPhone, or not yet allowed), so the steps are shown instead. */
    prompt: async (): Promise<boolean> => {
      if (!deferred) return false;
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "accepted") setInstalled(true);
      return true;
    },
    dismiss: () => {
      setDismissed(true);
      try {
        window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      } catch {
        // Not kept on this phone: the card comes back next time.
      }
    },
  };
}

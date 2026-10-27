"use client";

import { cn, KhmioMark } from "@khmio/ui";
import { Check, LayoutGrid } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mockPlatformProducts } from "@/mock/mock-site";

// H4. App switcher (design/screens.md H4): the same small menu in every
// Khmio product and in My Khmio — move between products with one login.
// Products not open yet show "Coming soon" and lead to their website page.

export function AppSwitcher({ current, align = "left" }: { current: "shop" | "hub"; align?: "left" | "right" }) {
  const t = useTranslations("Account");
  const locale = useLocale() === "en" ? "en" : "km";
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const productHref = (id: string) => (id === "shop" ? `/${locale}/mockup/dashboard` : `/${locale}/mockup/site/products/${id}`);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("switcher")}
        title={t("switcher")}
        className={cn("flex h-11 w-11 items-center justify-center rounded-DEFAULT text-muted hover:bg-border/30 hover:text-fg", open && "bg-border/30 text-fg")}
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={cn(
            // On a phone the button can sit anywhere in the header: the menu spans the screen
            // (16 px from each edge) instead of hanging off the button and leaving the screen.
            "fixed inset-x-4 top-20 z-40 rounded-2xl border border-border bg-bg p-2 shadow-raised sm:absolute sm:inset-x-auto sm:top-12 sm:w-72",
            align === "right" ? "sm:right-0" : "sm:left-0",
          )}
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("switcher")}</p>
          <ul className="flex flex-col">
            {mockPlatformProducts.map((product) => {
              const here = current === product.id;
              const live = product.status === "live";
              return (
                <li key={product.id}>
                  <Link
                    href={productHref(product.id)}
                    onClick={() => setOpen(false)}
                    aria-current={here ? "page" : undefined}
                    className={cn("flex min-h-touch items-center gap-3 rounded-DEFAULT px-3 py-2 hover:bg-border/20", here && "bg-brand/10")}
                  >
                    <KhmioMark size={28} className={cn(!live && "opacity-40")} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{product.name}</span>
                      <span className="truncate text-xs text-muted">{product.subtitle[locale]}</span>
                    </span>
                    {here ? (
                      <Check className="h-4 w-4 text-brand" aria-label={t("switcherCurrent")} />
                    ) : (
                      !live && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{t("comingSoon")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href={`/${locale}/mockup/account`}
              onClick={() => setOpen(false)}
              aria-current={current === "hub" ? "page" : undefined}
              className={cn("flex min-h-touch flex-col justify-center rounded-DEFAULT px-3 py-2 hover:bg-border/20", current === "hub" && "bg-brand/10")}
            >
              <span className="text-sm font-semibold">{t("switcherHub")}</span>
              <span className="text-xs text-muted">{t("switcherHubHint")}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
